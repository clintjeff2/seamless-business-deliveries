-- Migration to add original_distance_km column to deliveries table
-- Run this if you already have an existing database

-- Add the missing column
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS original_distance_km DECIMAL(8, 2);

-- Update existing records to set original_distance_km to current distance_km value
UPDATE deliveries SET original_distance_km = distance_km WHERE original_distance_km IS NULL;