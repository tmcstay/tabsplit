alter table public.attendees
  add column if not exists paid boolean not null default false;
