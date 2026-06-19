-- Discounts table: one row per discount applied to a split
create table discounts (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references splits(id) on delete cascade,
  type text not null check (type in ('flat', 'percentage')),
  value numeric(10,2) not null check (value > 0),
  created_at timestamptz not null default now()
);

-- Join table: which attendees each discount applies to
create table discount_attendees (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references discounts(id) on delete cascade,
  attendee_id uuid not null references attendees(id) on delete cascade
);

alter table discounts enable row level security;
alter table discount_attendees enable row level security;

-- Organiser can read/write discounts for their own splits
create policy "Organiser manages discounts"
  on discounts
  for all
  using (
    exists (
      select 1 from splits
      where splits.id = discounts.split_id
        and splits.organiser_id = auth.uid()
    )
  );

-- Public read for finalised splits via share link (uses existing security definer fn)
create policy "Public read discounts via share link"
  on discounts
  for select
  using (split_has_share_link(split_id));

-- Organiser can read/write discount_attendees for their own splits
create policy "Organiser manages discount_attendees"
  on discount_attendees
  for all
  using (
    exists (
      select 1 from discounts d
      join splits s on s.id = d.split_id
      where d.id = discount_attendees.discount_id
        and s.organiser_id = auth.uid()
    )
  );

-- Public read discount_attendees via share link
create policy "Public read discount_attendees via share link"
  on discount_attendees
  for select
  using (
    exists (
      select 1 from discounts d
      where d.id = discount_attendees.discount_id
        and split_has_share_link(d.split_id)
    )
  );
