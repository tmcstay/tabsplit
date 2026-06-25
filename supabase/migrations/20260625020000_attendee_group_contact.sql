-- Add contact details to attendee_groups
-- Stores the nominated phone/email to use when sending group share messages
alter table public.attendee_groups
  add column if not exists phone text,
  add column if not exists email text;
