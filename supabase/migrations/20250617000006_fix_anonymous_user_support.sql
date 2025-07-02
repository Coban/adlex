-- Allow NULL email for anonymous users
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
