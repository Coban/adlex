-- Improve error handling and user creation flow

-- First, ensure we have proper permissions for the auth schema
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow user creation during signup" ON users;
DROP POLICY IF EXISTS "Allow reading default organization" ON organizations;

-- Create a more permissive policy for user insertion during signup
CREATE POLICY "Enable insert for authentication" ON users
    FOR INSERT WITH CHECK (true);

-- Allow anyone to read the default organization (needed during user creation)
CREATE POLICY "Enable read access for default organization" ON organizations
    FOR SELECT USING (true);

-- Update the handle_new_user function with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id BIGINT;
    user_email TEXT;
BEGIN
    -- Get email from the new auth user
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');
    
    -- Get or create a default organization for new users
    SELECT id INTO default_org_id 
    FROM organizations 
    WHERE name = 'サンプル組織' 
    LIMIT 1;
    
    -- If no default organization exists, create one
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name, plan, max_checks)
        VALUES ('サンプル組織', 'trial', 200)
        RETURNING id INTO default_org_id;
    END IF;
    
    -- Insert the new user with organization assignment
    INSERT INTO public.users (id, email, organization_id, role)
    VALUES (NEW.id, user_email, default_org_id, 'user')
    ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't prevent auth user creation
        RAISE NOTICE 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres, service_role;
