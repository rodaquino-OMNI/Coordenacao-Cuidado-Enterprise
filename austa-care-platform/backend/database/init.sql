-- Initialize Austa Care Database
-- This file is executed when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set default timezone
SET timezone = 'America/Sao_Paulo';

-- Create initial schema (Prisma will handle detailed migrations)
-- This is just to ensure the database is ready

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Austa Care database initialized successfully';
END $$;
