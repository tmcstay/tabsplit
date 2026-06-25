-- Add merge group support to group_members
-- Members sharing the same merge_group_id are merged (e.g. a couple paying together)
-- merge_label stores the display name for the merged group (e.g. "Alice & Bob")

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS merge_group_id uuid,
  ADD COLUMN IF NOT EXISTS merge_label text;
