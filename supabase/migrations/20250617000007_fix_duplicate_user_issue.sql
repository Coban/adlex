-- Fix handle_new_user function to handle duplicate users and anonymous users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Use INSERT ON CONFLICT to handle potential duplicates
    -- For anonymous users, use NULL email
    INSERT INTO users (id, email)
    VALUES (
        NEW.id, 
        CASE 
            WHEN NEW.is_anonymous THEN NULL
            ELSE NEW.email
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = CASE 
            WHEN NEW.is_anonymous THEN NULL
            ELSE NEW.email
        END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
