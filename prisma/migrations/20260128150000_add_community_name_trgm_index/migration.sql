-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index using trigram ops for Community.name
CREATE INDEX IF NOT EXISTS "Community_name_trgm_idx" 
ON "Community" USING gin (name gin_trgm_ops);
