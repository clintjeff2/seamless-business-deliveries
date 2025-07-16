-- Add presence management functions to delivery communication system

-- Add is_online column to delivery_chat_participants if not exists
ALTER TABLE delivery_chat_participants 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Create function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
    p_chat_id UUID,
    p_user_id UUID,
    p_is_online BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE delivery_chat_participants
    SET 
        is_online = p_is_online,
        last_seen_at = NOW()
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up stale presence (mark users offline after 2 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS VOID AS $$
BEGIN
    UPDATE delivery_chat_participants
    SET is_online = FALSE
    WHERE is_online = TRUE 
    AND last_seen_at < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically mark messages as read when user presence is updated
CREATE OR REPLACE FUNCTION auto_mark_read_on_presence()
RETURNS TRIGGER AS $$
BEGIN
    -- If user comes online, mark unread messages as read
    IF NEW.is_online = TRUE AND (OLD.is_online IS NULL OR OLD.is_online = FALSE) THEN
        UPDATE delivery_messages 
        SET is_read = TRUE, updated_at = NOW()
        WHERE chat_id = NEW.chat_id 
        AND sender_id != NEW.user_id 
        AND is_read = FALSE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-marking messages as read
DROP TRIGGER IF EXISTS trigger_auto_mark_read_on_presence ON delivery_chat_participants;
CREATE TRIGGER trigger_auto_mark_read_on_presence
    AFTER UPDATE OF is_online ON delivery_chat_participants
    FOR EACH ROW
    EXECUTE FUNCTION auto_mark_read_on_presence();

-- Add index for better performance on presence queries
CREATE INDEX IF NOT EXISTS idx_chat_participants_online ON delivery_chat_participants(is_online, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_presence ON delivery_chat_participants(chat_id, is_online, last_seen_at);

-- Create a view for easy chat status with participant info
CREATE OR REPLACE VIEW delivery_chat_status AS
SELECT 
    dc.id as chat_id,
    dc.delivery_id,
    dc.status as chat_status,
    dc.last_message_at,
    json_agg(
        json_build_object(
            'user_id', dcp.user_id,
            'user_type', dcp.user_type,
            'is_online', dcp.is_online,
            'last_seen_at', dcp.last_seen_at,
            'is_typing', dcp.is_typing,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url,
            'phone', p.phone
        )
    ) as participants,
    (
        SELECT COUNT(*)
        FROM delivery_messages dm
        WHERE dm.chat_id = dc.id
        AND dm.is_read = FALSE
    ) as total_unread_messages
FROM delivery_chats dc
LEFT JOIN delivery_chat_participants dcp ON dc.id = dcp.chat_id
LEFT JOIN profiles p ON dcp.user_id = p.id
GROUP BY dc.id, dc.delivery_id, dc.status, dc.last_message_at;