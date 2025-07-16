-- Row Level Security policies for delivery communication tables

-- Enable RLS on all communication tables
ALTER TABLE delivery_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_chat_participants ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_chats table
-- Users can view chats they're participants in
CREATE POLICY "Users can view their delivery chats" ON delivery_chats
    FOR SELECT USING (
        auth.uid() = customer_id OR 
        auth.uid() = driver_id
    );

-- Users can create chats (handled by trigger, but allow for manual creation)
CREATE POLICY "Authenticated users can create delivery chats" ON delivery_chats
    FOR INSERT WITH CHECK (
        auth.uid() = customer_id OR 
        auth.uid() = driver_id
    );

-- Only participants can update chat status
CREATE POLICY "Participants can update delivery chats" ON delivery_chats
    FOR UPDATE USING (
        auth.uid() = customer_id OR 
        auth.uid() = driver_id
    );

-- Policies for delivery_messages table
-- Users can view messages in chats they're participants in
CREATE POLICY "Users can view messages in their chats" ON delivery_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM delivery_chats dc 
            WHERE dc.id = chat_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );

-- Users can send messages in chats they're participants in
CREATE POLICY "Users can send messages in their chats" ON delivery_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM delivery_chats dc 
            WHERE dc.id = chat_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
            AND dc.status = 'active'
        )
    );

-- Users can update their own messages (for read status, etc.)
CREATE POLICY "Users can update messages in their chats" ON delivery_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM delivery_chats dc 
            WHERE dc.id = chat_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );

-- Policies for delivery_message_reactions table
-- Users can view reactions on messages in their chats
CREATE POLICY "Users can view reactions in their chats" ON delivery_message_reactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM delivery_messages dm
            JOIN delivery_chats dc ON dc.id = dm.chat_id
            WHERE dm.id = message_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );

-- Users can add reactions to messages in their chats
CREATE POLICY "Users can add reactions in their chats" ON delivery_message_reactions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM delivery_messages dm
            JOIN delivery_chats dc ON dc.id = dm.chat_id
            WHERE dm.id = message_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );

-- Users can update/delete their own reactions
CREATE POLICY "Users can manage their own reactions" ON delivery_message_reactions
    FOR ALL USING (auth.uid() = user_id);

-- Policies for delivery_chat_participants table
-- Users can view participant info for their chats
CREATE POLICY "Users can view participants in their chats" ON delivery_chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM delivery_chats dc 
            WHERE dc.id = chat_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );

-- Users can update their own participant record
CREATE POLICY "Users can update their own participant info" ON delivery_chat_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow insert for participant records (handled by trigger)
CREATE POLICY "Allow participant record creation" ON delivery_chat_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM delivery_chats dc 
            WHERE dc.id = chat_id 
            AND (dc.customer_id = auth.uid() OR dc.driver_id = auth.uid())
        )
    );