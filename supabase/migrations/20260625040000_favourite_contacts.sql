create table public.favourite_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.favourite_contacts enable row level security;

create policy "Users manage own favourite contacts"
  on public.favourite_contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
