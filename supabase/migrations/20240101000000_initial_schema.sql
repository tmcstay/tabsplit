-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  display_name text,
  created_at timestamptz default now()
);

-- Splits
create table public.splits (
  id uuid primary key default uuid_generate_v4(),
  organiser_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  receipt_url text,
  total numeric(10,2),
  status text not null default 'draft' check (status in ('draft', 'finalised')),
  created_at timestamptz default now()
);

-- Attendee groups (couples etc)
create table public.attendee_groups (
  id uuid primary key default uuid_generate_v4(),
  split_id uuid not null references public.splits(id) on delete cascade,
  label text not null,
  created_at timestamptz default now()
);

-- Attendees
create table public.attendees (
  id uuid primary key default uuid_generate_v4(),
  split_id uuid not null references public.splits(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  display_name text not null,
  phone text,
  group_id uuid references public.attendee_groups(id) on delete set null,
  created_at timestamptz default now()
);

-- Items (one row per unit, quantities exploded)
create table public.items (
  id uuid primary key default uuid_generate_v4(),
  split_id uuid not null references public.splits(id) on delete cascade,
  description text not null,
  price numeric(10,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Item assignments
create table public.item_assignments (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.items(id) on delete cascade,
  attendee_id uuid not null references public.attendees(id) on delete cascade,
  created_at timestamptz default now(),
  unique(item_id, attendee_id)
);

-- Share links
create table public.share_links (
  id uuid primary key default uuid_generate_v4(),
  split_id uuid not null references public.splits(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.splits enable row level security;
alter table public.attendee_groups enable row level security;
alter table public.attendees enable row level security;
alter table public.items enable row level security;
alter table public.item_assignments enable row level security;
alter table public.share_links enable row level security;

-- Users policies
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);

-- Splits policies
create policy "Organiser can manage their splits"
  on public.splits for all using (auth.uid() = organiser_id);

-- Attendee groups policies
create policy "Organiser can manage attendee groups"
  on public.attendee_groups for all using (
    exists (
      select 1 from public.splits
      where splits.id = attendee_groups.split_id
      and splits.organiser_id = auth.uid()
    )
  );

-- Attendees policies
create policy "Organiser can manage attendees"
  on public.attendees for all using (
    exists (
      select 1 from public.splits
      where splits.id = attendees.split_id
      and splits.organiser_id = auth.uid()
    )
  );

-- Items policies
create policy "Organiser can manage items"
  on public.items for all using (
    exists (
      select 1 from public.splits
      where splits.id = items.split_id
      and splits.organiser_id = auth.uid()
    )
  );

-- Item assignments policies
create policy "Organiser can manage item assignments"
  on public.item_assignments for all using (
    exists (
      select 1 from public.items
      join public.splits on splits.id = items.split_id
      where items.id = item_assignments.item_id
      and splits.organiser_id = auth.uid()
    )
  );

-- Share links policies
create policy "Organiser can manage share links"
  on public.share_links for all using (
    exists (
      select 1 from public.splits
      where splits.id = share_links.split_id
      and splits.organiser_id = auth.uid()
    )
  );

create policy "Anyone can read share links by token"
  on public.share_links for select using (true);

-- Public read via share token for splits
create policy "Public can read splits via share token"
  on public.splits for select using (
    exists (
      select 1 from public.share_links
      where share_links.split_id = splits.id
    )
  );

-- Public read via share token for attendees, items, assignments
create policy "Public can read attendees via share token"
  on public.attendees for select using (
    exists (
      select 1 from public.share_links
      where share_links.split_id = attendees.split_id
    )
  );

create policy "Public can read items via share token"
  on public.items for select using (
    exists (
      select 1 from public.share_links
      where share_links.split_id = items.split_id
    )
  );

create policy "Public can read item assignments via share token"
  on public.item_assignments for select using (
    exists (
      select 1 from public.items
      join public.share_links on share_links.split_id = items.split_id
      where items.id = item_assignments.item_id
    )
  );

-- Storage bucket for receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

create policy "Organiser can upload receipts"
  on storage.objects for insert with check (
    bucket_id = 'receipts' and auth.uid() is not null
  );

create policy "Organiser can read own receipts"
  on storage.objects for select using (
    bucket_id = 'receipts' and auth.uid() is not null
  );
