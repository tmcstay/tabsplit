-- Add 'archived' to splits status check constraint
alter table public.splits drop constraint splits_status_check;

alter table public.splits
  add constraint splits_status_check
  check (status in ('pending', 'draft', 'finalised', 'archived'));
