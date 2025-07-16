-- Add delivery communication tables
-- Create delivery_chats table for chat sessions
CREATE TABLE delivery_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('active', 'ended', 'archived')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One chat per delivery
    UNIQUE(delivery_id)
);

-- Create indexes for delivery_chats
CREATE INDEX idx_delivery_chats_customer ON delivery_chats(customer_id);
CREATE INDEX idx_delivery_chats_driver ON delivery_chats(driver_id);
CREATE INDEX idx_delivery_chats_status ON delivery_chats(status);
CREATE INDEX idx_delivery_chats_last_message ON delivery_chats(last_message_at DESC);

-- Create delivery_messages table for individual messages
CREATE TABLE delivery_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES delivery_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_type TEXT CHECK (sender_type IN ('customer', 'driver', 'system')) NOT NULL,
    message_type TEXT CHECK (message_type IN ('text', 'image', 'location', 'system_notification')) DEFAULT 'text',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- For storing extra data like coordinates, image urls, etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for delivery_messages
CREATE INDEX idx_delivery_messages_chat ON delivery_messages(chat_id, created_at DESC);
CREATE INDEX idx_delivery_messages_sender ON delivery_messages(sender_id);
CREATE INDEX idx_delivery_messages_unread ON delivery_messages(chat_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_delivery_messages_type ON delivery_messages(message_type);

-- Create delivery_message_reactions table for message reactions
CREATE TABLE delivery_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES delivery_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type TEXT CHECK (reaction_type IN ('like', 'thumbs_up', 'thumbs_down', 'heart', 'laugh')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One reaction per user per message
    UNIQUE(message_id, user_id)
);

-- Create indexes for delivery_message_reactions
CREATE INDEX idx_message_reactions_message ON delivery_message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON delivery_message_reactions(user_id);

-- Create delivery_chat_participants table for tracking participant info
CREATE TABLE delivery_chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES delivery_chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_type TEXT CHECK (user_type IN ('customer', 'driver')) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_typing BOOLEAN DEFAULT FALSE,
    typing_updated_at TIMESTAMPTZ,
    notification_settings JSONB DEFAULT '{"push": true, "sound": true}',
    
    -- One record per user per chat
    UNIQUE(chat_id, user_id)
);

-- Create indexes for delivery_chat_participants
CREATE INDEX idx_chat_participants_chat ON delivery_chat_participants(chat_id);
CREATE INDEX idx_chat_participants_user ON delivery_chat_participants(user_id);
CREATE INDEX idx_chat_participants_typing ON delivery_chat_participants(is_typing, typing_updated_at) WHERE is_typing = TRUE;

-- Create function to automatically create chat when delivery is accepted
CREATE OR REPLACE FUNCTION create_delivery_chat()
RETURNS TRIGGER AS $$
DECLARE
    customer_user_id UUID;
    driver_user_id UUID;
    new_chat_id UUID;
BEGIN
    -- Only create chat when status changes to 'accepted' or 'picked_up'
    IF NEW.status IN ('accepted', 'picked_up') AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'picked_up', 'in_transit', 'delivered')) THEN
        -- Get customer ID from the order
        SELECT o.customer_id INTO customer_user_id
        FROM orders o
        WHERE o.id = NEW.order_id;
        
        -- Get driver ID from transport service
        SELECT ts.driver_id INTO driver_user_id
        FROM transport_services ts
        WHERE ts.id = NEW.transport_service_id;
        
        -- Create chat if both customer and driver exist
        IF customer_user_id IS NOT NULL AND driver_user_id IS NOT NULL THEN
            -- Insert new chat
            INSERT INTO delivery_chats (delivery_id, customer_id, driver_id)
            VALUES (NEW.id, customer_user_id, driver_user_id)
            ON CONFLICT (delivery_id) DO NOTHING
            RETURNING id INTO new_chat_id;
            
            -- Add participants
            INSERT INTO delivery_chat_participants (chat_id, user_id, user_type)
            VALUES 
                (new_chat_id, customer_user_id, 'customer'),
                (new_chat_id, driver_user_id, 'driver')
            ON CONFLICT (chat_id, user_id) DO NOTHING;
            
            -- Add system welcome message
            INSERT INTO delivery_messages (chat_id, sender_id, sender_type, message_type, content)
            VALUES (
                new_chat_id,
                driver_user_id,
                'system',
                'system_notification',
                'Chat started! Driver and customer can now communicate about this delivery.'
            );
        END IF;
    END IF;
    
    -- End chat when delivery is completed or cancelled
    IF NEW.status IN ('delivered', 'cancelled') AND OLD.status NOT IN ('delivered', 'cancelled') THEN
        UPDATE delivery_chats 
        SET status = 'ended', ended_at = NOW()
        WHERE delivery_id = NEW.id AND status = 'active';
        
        -- Add system completion message
        INSERT INTO delivery_messages (chat_id, sender_id, sender_type, message_type, content)
        SELECT 
            dc.id,
            NEW.transport_service_id,
            'system',
            'system_notification',
            CASE 
                WHEN NEW.status = 'delivered' THEN 'Delivery completed successfully! Thank you for using our service.'
                ELSE 'Delivery was cancelled. Chat will be archived.'
            END
        FROM delivery_chats dc
        WHERE dc.delivery_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic chat creation
CREATE TRIGGER trigger_create_delivery_chat
    AFTER UPDATE OF status ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION create_delivery_chat();

-- Create function to update last_message_at when new message is sent
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE delivery_chats 
    SET last_message_at = NEW.created_at 
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating last message timestamp
CREATE TRIGGER trigger_update_chat_last_message
    AFTER INSERT ON delivery_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_last_message();

-- Create function to automatically mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_read(
    p_chat_id UUID,
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE delivery_messages 
    SET is_read = TRUE, updated_at = NOW()
    WHERE chat_id = p_chat_id 
    AND sender_id != p_user_id 
    AND is_read = FALSE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Update participant's last seen timestamp
    UPDATE delivery_chat_participants
    SET last_seen_at = NOW()
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to update typing status
CREATE OR REPLACE FUNCTION update_typing_status(
    p_chat_id UUID,
    p_user_id UUID,
    p_is_typing BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE delivery_chat_participants
    SET 
        is_typing = p_is_typing,
        typing_updated_at = NOW()
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;