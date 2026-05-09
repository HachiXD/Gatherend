-- Add enum values in their own migration so PostgreSQL commits them before
-- later migrations use them in INSERT/UPDATE statements.
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'FORUM';
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'WIKI';
