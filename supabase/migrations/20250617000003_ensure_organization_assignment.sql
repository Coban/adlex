-- Ensure all existing users have organization assignments

-- First, make sure we have a default organization
DO $$
DECLARE
    default_org_id BIGINT;
BEGIN
    -- Check if default organization exists
    SELECT id INTO default_org_id
    FROM organizations 
    WHERE name = 'サンプル組織' 
    LIMIT 1;
    
    -- Create if it doesn't exist
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name, plan, max_checks, used_checks)
        VALUES ('サンプル組織', 'trial', 200, 0);
        RAISE NOTICE 'Created default organization';
    ELSE
        RAISE NOTICE 'Default organization already exists with ID: %', default_org_id;
    END IF;
END $$;

-- Update any users without organization assignment
DO $$
DECLARE
    default_org_id BIGINT;
    orphaned_users_count INTEGER;
BEGIN
    -- Get the default organization ID
    SELECT id INTO default_org_id 
    FROM organizations 
    WHERE name = 'サンプル組織' 
    LIMIT 1;
    
    -- Count users without organization
    SELECT COUNT(*) INTO orphaned_users_count
    FROM users 
    WHERE organization_id IS NULL;
    
    RAISE NOTICE 'Found % users without organization assignment', orphaned_users_count;
    
    -- Update users without organization
    IF default_org_id IS NOT NULL THEN
        UPDATE users 
        SET organization_id = default_org_id 
        WHERE organization_id IS NULL;
        
        RAISE NOTICE 'Updated orphaned users to use organization %', default_org_id;
    END IF;
END $$;

-- Ensure the trigger function has proper error handling and logging
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_org_id BIGINT;
    user_email TEXT;
BEGIN
    RAISE NOTICE 'handle_new_user triggered for user: %', NEW.id;
    
    -- Get email from the new auth user
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', 'unknown@example.com');
    RAISE NOTICE 'User email: %', user_email;
    
    -- Get or create a default organization for new users
    SELECT id INTO default_org_id 
    FROM organizations 
    WHERE name = 'サンプル組織' 
    LIMIT 1;
    
    RAISE NOTICE 'Found organization: %', default_org_id;
    
    -- If no default organization exists, create one
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name, plan, max_checks, used_checks)
        VALUES ('サンプル組織', 'trial', 200, 0)
        RETURNING id INTO default_org_id;
        
        RAISE NOTICE 'Created new organization: %', default_org_id;
    END IF;
    
    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        RAISE NOTICE 'User % already exists in users table', NEW.id;
        RETURN NEW;
    END IF;
    
    -- Insert the new user with organization assignment
    INSERT INTO public.users (id, email, organization_id, role)
    VALUES (NEW.id, user_email, default_org_id, 'user');
    
    RAISE NOTICE 'Successfully created user % with organization %', NEW.id, default_org_id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't prevent auth user creation
        RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
