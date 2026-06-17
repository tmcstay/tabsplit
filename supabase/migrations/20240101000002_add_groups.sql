-- Groups: saved collections of people the organiser splits with regularly
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  organiser_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  saved boolean not null default false,
  created_at timestamptz default now()
);

-- Group members: individual people within a group
create table public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null,
  phone text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Link splits back to the group they were created from
alter table public.splits
  add column group_id uuid references public.groups(id) on delete set null;

-- Expand status to three states: pending → draft → finalised
alter table public.splits
  drop constraint splits_status_check;

alter table public.splits
  add constraint splits_status_check
  check (status in ('pending', 'draft', 'finalised'));

alter table public.splits
  alter column status set default 'pending';

-- RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Groups policies
create policy "Organiser can manage their groups"
  on public.groups for all using (auth.uid() = organiser_id);

-- Group members policies
create policy "Organiser can manage group members"
  on public.group_members for all using (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
      and groups.organiser_id = auth.uid()
    )
  );
