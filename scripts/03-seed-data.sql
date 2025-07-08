-- Insert categories
INSERT INTO categories (name, slug, description, icon) VALUES
('Restaurants', 'restaurants', 'Food and dining establishments', '🍽️'),
('Electronics', 'electronics', 'Electronic devices and gadgets', '📱'),
('Clothing', 'clothing', 'Apparel and accessories', '👕'),
('Fashion', 'fashion', 'Fashion and style items', '👗');

-- Create some sample profiles (these will be created when users register)
-- The actual user creation happens through Supabase Auth

-- Note: In a real application, you would not insert directly into profiles
-- as they should be created through the auth system
