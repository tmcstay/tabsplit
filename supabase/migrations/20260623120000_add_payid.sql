-- Add PayID fields to users table for display on results/share pages
alter table public.users add column payid text;
alter table public.users add column payid_label text;

-- Allow public read of an organiser's profile row when a share link exists for their split.
-- This follows the same pattern as existing public read policies on splits/attendees/items.
-- Note: this exposes the full users row (including display_name and phone) for organisers
-- who have finalised at least one split — acceptable for a social bill-splitting app.
create policy "Public can read organiser profile via share link"
  on public.users for select
  using (
    exists (
      select 1 from public.splits s
      join public.share_links sl on sl.split_id = s.id
      where s.organiser_id = users.id
    )
  );
