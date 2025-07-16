-- Add notifications table for real-time communication
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('order_placed', 'order_assigned', 'delivery_accepted', 'delivery_picked_up', 'delivery_in_transit', 'delivery_completed', 'delivery_cancelled', 'new_message', 'system_alert')) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional data like order_id, delivery_id, etc.
    is_read BOOLEAN DEFAULT FALSE,
    priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Create indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Create function to send notification to transport services when order is placed
CREATE OR REPLACE FUNCTION notify_transport_services_new_order()
RETURNS TRIGGER AS $$
DECLARE
    transport_service RECORD;
    notification_title TEXT;
    notification_message TEXT;
    order_data JSONB;
BEGIN
    -- Only notify when order status changes to 'confirmed'
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        -- Prepare order data for notification
        SELECT jsonb_build_object(
            'order_id', NEW.id,
            'business_name', b.name,
            'delivery_address', NEW.delivery_address,
            'total_amount', NEW.total_amount,
            'delivery_latitude', NEW.delivery_latitude,
            'delivery_longitude', NEW.delivery_longitude,
            'customer_phone', p.phone,
            'customer_name', p.full_name
        ) INTO order_data
        FROM businesses b, profiles p
        WHERE b.id = NEW.business_id AND p.id = NEW.user_id;

        notification_title := 'New Delivery Request';
        notification_message := 'New order from ' || (order_data->>'business_name') || ' to ' || NEW.delivery_address;

        -- Notify all available transport services in the area
        FOR transport_service IN 
            SELECT ts.driver_id, ts.service_name, ts.current_latitude, ts.current_longitude
            FROM transport_services ts
            WHERE ts.status = 'available'
            AND ts.current_latitude IS NOT NULL 
            AND ts.current_longitude IS NOT NULL
            -- Add distance filter (within 20km for now)
            AND ST_DWithin(
                ST_Point(ts.current_longitude, ts.current_latitude)::geography,
                ST_Point(NEW.delivery_longitude, NEW.delivery_latitude)::geography,
                20000 -- 20km in meters
            )
        LOOP
            -- Insert notification for each available driver
            INSERT INTO notifications (
                user_id, 
                type, 
                title, 
                message, 
                data, 
                priority,
                expires_at
            ) VALUES (
                transport_service.driver_id,
                'order_placed',
                notification_title,
                notification_message,
                order_data,
                'high',
                NOW() + INTERVAL '10 minutes' -- Expire after 10 minutes
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifying transport services
CREATE TRIGGER trigger_notify_transport_services
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_transport_services_new_order();

-- Create function to notify customer when delivery is assigned
CREATE OR REPLACE FUNCTION notify_delivery_assignment()
RETURNS TRIGGER AS $$
DECLARE
    customer_id UUID;
    driver_name TEXT;
    service_name TEXT;
    notification_data JSONB;
BEGIN
    -- Only notify when delivery status changes to 'accepted'
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        -- Get customer ID from order
        SELECT o.user_id INTO customer_id
        FROM orders o
        WHERE o.id = NEW.order_id;
        
        -- Get driver and service information
        SELECT p.full_name, ts.service_name 
        INTO driver_name, service_name
        FROM transport_services ts
        JOIN profiles p ON p.id = ts.driver_id
        WHERE ts.id = NEW.transport_service_id;
        
        -- Prepare notification data
        notification_data := jsonb_build_object(
            'delivery_id', NEW.id,
            'order_id', NEW.order_id,
            'driver_name', driver_name,
            'service_name', service_name,
            'driver_phone', (SELECT phone FROM profiles p JOIN transport_services ts ON p.id = ts.driver_id WHERE ts.id = NEW.transport_service_id)
        );
        
        -- Notify customer
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            data,
            priority
        ) VALUES (
            customer_id,
            'delivery_accepted',
            'Driver Assigned!',
            driver_name || ' from ' || service_name || ' has accepted your delivery',
            notification_data,
            'high'
        );
        
        -- Notify other transport services that this order is no longer available
        UPDATE notifications 
        SET expires_at = NOW(), is_read = TRUE
        WHERE type = 'order_placed' 
        AND (data->>'order_id') = NEW.order_id::TEXT
        AND user_id != (SELECT driver_id FROM transport_services WHERE id = NEW.transport_service_id);
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for delivery assignment notifications
CREATE TRIGGER trigger_notify_delivery_assignment
    AFTER UPDATE OF status ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION notify_delivery_assignment();

-- Create function to notify status updates
CREATE OR REPLACE FUNCTION notify_delivery_status_updates()
RETURNS TRIGGER AS $$
DECLARE
    customer_id UUID;
    driver_id UUID;
    notification_title TEXT;
    notification_message TEXT;
    notification_type TEXT;
    notification_data JSONB;
BEGIN
    -- Get customer and driver IDs
    SELECT o.user_id INTO customer_id
    FROM orders o
    WHERE o.id = NEW.order_id;
    
    SELECT ts.driver_id INTO driver_id
    FROM transport_services ts
    WHERE ts.id = NEW.transport_service_id;
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'delivery_id', NEW.id,
        'order_id', NEW.order_id,
        'status', NEW.status
    );
    
    -- Determine notification content based on status
    CASE NEW.status
        WHEN 'picked_up' THEN
            notification_type := 'delivery_picked_up';
            notification_title := 'Order Picked Up';
            notification_message := 'Your order has been picked up and is on the way!';
        WHEN 'in_transit' THEN
            notification_type := 'delivery_in_transit';
            notification_title := 'On the Way';
            notification_message := 'Your delivery is now in transit to your location';
        WHEN 'delivered' THEN
            notification_type := 'delivery_completed';
            notification_title := 'Delivery Completed';
            notification_message := 'Your order has been successfully delivered!';
        WHEN 'cancelled' THEN
            notification_type := 'delivery_cancelled';
            notification_title := 'Delivery Cancelled';
            notification_message := 'Your delivery has been cancelled';
        ELSE
            RETURN NEW; -- Don't notify for other statuses
    END CASE;
    
    -- Only notify if status actually changed
    IF OLD.status IS NULL OR OLD.status != NEW.status THEN
        -- Notify customer
        IF customer_id IS NOT NULL THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                data,
                priority
            ) VALUES (
                customer_id,
                notification_type,
                notification_title,
                notification_message,
                notification_data,
                CASE 
                    WHEN NEW.status IN ('delivered', 'cancelled') THEN 'high'
                    ELSE 'normal'
                END
            );
        END IF;
        
        -- Notify driver for certain status changes
        IF driver_id IS NOT NULL AND NEW.status IN ('cancelled') THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                data,
                priority
            ) VALUES (
                driver_id,
                notification_type,
                'Delivery Cancelled',
                'The delivery has been cancelled',
                notification_data,
                'high'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for delivery status notifications
CREATE TRIGGER trigger_notify_delivery_status
    AFTER UPDATE OF status ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION notify_delivery_status_updates();

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NOT NULL THEN
        -- Mark specific notifications as read
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = p_user_id 
        AND id = ANY(p_notification_ids)
        AND is_read = FALSE;
    ELSE
        -- Mark all notifications as read for user
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = p_user_id 
        AND is_read = FALSE;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;