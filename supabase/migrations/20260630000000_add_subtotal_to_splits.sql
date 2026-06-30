-- adds subtotal to splits so the Assign screen can compare sum(items) to the
-- printed receipt subtotal and flag mismatches immediately
ALTER TABLE splits ADD COLUMN IF NOT EXISTS subtotal numeric(10,2);
