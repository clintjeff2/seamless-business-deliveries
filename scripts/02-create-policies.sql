-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

-- Businesses policies
CREATE POLICY "Anyone can view active businesses" ON businesses
    FOR SELECT USING (is_active = true);

CREATE POLICY "Business owners can manage their businesses" ON businesses
    FOR ALL USING (auth.uid() = owner_id);

-- Items policies
CREATE POLICY "Anyone can view available items" ON items
    FOR SELECT USING (is_available = true);

CREATE POLICY "Business owners can manage their items" ON items
    FOR ALL USING (
        auth.uid() IN (
            SELECT owner_id FROM businesses WHERE id = items.business_id
        )
    );

-- Transport services policies
CREATE POLICY "Anyone can view active transport services" ON transport_services
    FOR SELECT USING (status != 'offline');

CREATE POLICY "Drivers can manage their transport services" ON transport_services
    FOR ALL USING (auth.uid() = driver_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Business owners can view orders for their businesses" ON orders
    FOR SELECT USING (
        auth.uid() IN (
            SELECT owner_id FROM businesses WHERE id = orders.business_id
        )
    );

CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Transport services can read their delivery orders" ON orders
    FOR SELECT USING (
        auth.uid() IN (
            SELECT driver_id
            FROM transport_services
            WHERE id IN (
                SELECT transport_service_id
                FROM deliveries
                WHERE order_id = orders.id
            )
        )
    );

-- Order items policies
CREATE POLICY "Users can view order items for their orders" ON order_items
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create order items for their orders" ON order_items
    FOR INSERT WITH CHECK (
        order_id IN (
            SELECT id FROM orders WHERE user_id = auth.uid()
        )
    );

-- Deliveries policies
CREATE POLICY "Users can view deliveries for their orders" ON deliveries
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Transport drivers can view and update their deliveries" ON deliveries
    FOR ALL USING (
        transport_service_id IN (
            SELECT id FROM transport_services WHERE driver_id = auth.uid()
        )
    );

-- Reviews policies
CREATE POLICY "Anyone can view reviews" ON reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for their orders" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add this missing INSERT policy for profiles
CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Business owners can update orders for their businesses" ON orders
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT owner_id FROM businesses WHERE id = orders.business_id
        )
    ) WITH CHECK (
        auth.uid() IN (
            SELECT owner_id FROM businesses WHERE id = orders.business_id
        )
    );