-- Fix user creation and organization assignment

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id BIGINT;
BEGIN
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
    INSERT INTO users (id, email, organization_id, role)
    VALUES (NEW.id, NEW.email, default_org_id, 'user');
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error and still return NEW to allow auth to proceed
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add policy to allow users to be inserted during signup
CREATE POLICY "Allow user creation during signup" ON users
    FOR INSERT WITH CHECK (true);

-- Ensure organizations can be read by anyone (needed for user creation)
CREATE POLICY "Allow reading default organization" ON organizations
    FOR SELECT USING (name = 'サンプル組織');
