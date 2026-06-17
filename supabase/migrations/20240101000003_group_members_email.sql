ALTER TABLE group_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS email text;
