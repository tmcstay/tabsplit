# TabSplit — Session Handoff

## Session Date
2026-06-26 (session 6)

## Completed This Session

### Debug Log Cleanup
- Removed all `console.log` calls from `src/app/splits/new/actions.ts` (10 removed); `console.error` calls retained for legitimate error reporting
- `NewSplitForm.tsx` was already clean — logs had been removed prior to this session
- Safari receipt detection confirmed working on device; `handleFileChange` name-based fallback behaves correctly

### CLAUDE.md Documentation Update
- Added 5 previously undocumented migrations to the Migrations section:
  - `20260625000000` — merge_group_id / merge_label on group_members
  - `20260625010000` — 'archived' added to splits status constraint
  - `20260625020000` — phone / email added to attendee_groups
  - `20260625030000` — attendees.paid boolean
  - `20260625040000` — favourite_contacts table + RLS
- Replaced two `*(untracked)*` entries with proper migration IDs
- Updated `group_members` schema description to include merge columns
- Updated `attendee_groups` schema description to include phone/email columns
- Updated Split Status Flow section to include `archived` as a fourth state

### Status Updates (reported by Tony)
- Codemagic build confirmed successful
- `NPM_GITHUB_TOKEN` set in both Vercel and Codemagic
- PWA PNG icons generated
- End-to-end mobile test in progress

---

## Previous Session — Completed (Session 5, 2026-06-25)

### Splits Page — Three-Tab View (Active / Complete / Archived)
- New `SplitsPageClient` component classifies all splits into three tabs
- **Active**: `pending`, `draft`, or `finalised` where not all attendees have paid
- **Complete**: `finalised` AND `attendees.length > 0 && attendees.every(a => a.paid)`
- **Archived**: `status === 'archived'`
- Uses hidden-div approach to preserve swipe state across tab switches
- Changed Supabase query from `attendees(count)` to `attendees(paid)` — returns real records array; count via `.length`
- Tab badge shows count; archive/restore removes item from current tab list immediately (handled via filter, not status update)

### Home Page — Active Only
- Home page query changed from `in('status', ['pending', 'draft'])` to also include `finalised`
- Filters client-side to show only active splits (same logic as SplitsPageClient)
- Finalised + all-paid splits no longer appear on the home page

### Favourites Feature — Complete
- Star button added to attendee rows on all four attendee-adding screens: NewSplitForm step 2, NewGroupForm step 2, GroupDetail existing + new member rows, PersonCard results page
- Star position: LEFT of name (`[★] [name flex-1] [×]`), moved from between name and × button
- `favMap` pattern: `Map<display_name.toLowerCase().trim(), favourite_contacts.id>` with optimistic toggle (temp ID → real ID)
- PersonCard results page: star button in card header, always visible for non-group entries (not buried in expanded row)
- Groups page now has **Favourites tab** alongside Groups tab:
  - Lists existing favourites with remove (×) button
  - "From contacts" button (indigo) → `ContactPicker` on native, message on web
  - "From group" button (teal) → `GroupPicker` sheet → then `ContactPicker` with group members
  - "Add manually" form: name + optional phone + optional email
  - All additions optimistic
- Groups query updated from `group_members(count)` to `group_members(id, display_name, phone, email)` to support member picker
- `GroupWithMembers` type exported from `GroupsPageClient.tsx`; `groups/page.tsx` imports it

### Type Safety Fix — Cross-File SplitWithCount
- Vercel build failed with "Two different types with the same name exist, but they are unrelated" for `SplitWithCount`
- Root cause: `page.tsx` and `SplitList.tsx` each defined their own local `SplitWithCount`; TypeScript treats them as different nominal types even when structurally identical
- Fix: export `SplitWithCount` from `SplitList.tsx`; export `SplitWithPaid` from `SplitsPageClient.tsx`; import at all call sites instead of redefining

---

## Next Steps (Pick Up From Here)

1. **Complete end-to-end mobile test** — create a split, upload receipt, run OCR, assign items, apply a discount, add tip, finalise, verify share link shows discount lines, tap Edit to reopen; also test favourites star toggle and Favourites tab import flows. Report any bugs.

2. **Build `/reset-password` page** — `forgot-password/page.tsx` calls `resetPasswordForEmail` with `redirectTo: .../reset-password`; that route doesn't exist (currently 404 after clicking reset email link). Needs to:
   - Handle the Supabase `type=recovery` session (Supabase sets the session automatically from the URL token on load)
   - Show password + confirm password fields
   - Call `supabase.auth.updateUser({ password })` on submit
   - Redirect to `/` on success

3. **Remove Eruda from production** — Eruda debug console loads on all `*.vercel.app` URLs including the production alias. Once debugging is complete, restrict to non-production preview URLs or remove entirely. Currently in `layout.tsx` behind hostname check.

4. **Android package path** — `android/app/src/main/java/com/tabsplit/app/` still uses old package structure. Low priority until Android build is needed.

---

## Open Questions / Decisions to Revisit

- **`/reset-password` page missing** — `forgot-password/page.tsx` sends a reset email with `redirectTo: .../reset-password`; that page doesn't exist → 404. Build it before shipping.

- **Contacts on PWA** — "From contacts" / "Import from contacts" buttons are visible on web PWA but show a "native only" message. Decide whether to hide them entirely on web or keep them to signal the feature exists for native users.

- **OCR multi-line parsing accuracy** — real-world receipt accuracy hasn't been confirmed. Strategy 1 in `route.ts` handles price-on-next-line but needs testing on actual receipts.

- **PWA install prompt** — PWA manifest and service worker set up but install UX not tested. iOS requires manual "Add to Home Screen"; Android may show a banner.

- **Eruda in production** — Eruda loads on ALL `*.vercel.app` URLs including the production alias. Restrict or remove once debugging is complete.

- **Android bundle ID** — `android/app/src/main/java/com/tabsplit/app/` uses old package structure; should be `app/tabsplit/com/` to match `app.tabsplit.com`. Low priority.

---

## Previous Sessions Summary

### Session 5 (2026-06-25)
- Splits page three-tab view (Active / Complete / Archived) with hidden-div swipe state preservation
- Home page active-only filter (pending + draft + finalised-unpaid)
- Favourites feature complete across all four attendee screens + Favourites tab on Groups page
- Type safety fix for SplitWithCount / SplitWithPaid cross-file nominal type conflict

### Session 4 (2026-06-24)
- GitHub Packages auth in `.npmrc` — `${NPM_GITHUB_TOKEN}` pattern
- iOS build number auto-increment via `$PROJECT_BUILD_NUMBER` in codemagic.yaml
- CLAUDE.md history audit — filled in 4 missing migrations, auth flow details, BottomNav docs, flagged missing `/reset-password` page
- Favourites feature groundwork: `favourite_contacts` table, star buttons on attendee screens
- Group share message fix: was using group label instead of individual member name
- Groups page Favourites tab: initial implementation

### Session 3 (2026-06-19)
- Capacitor native build setup (server.url → Vercel, bundle ID app.tabsplit.com, downgraded to 7.6.6)
- Codemagic yaml written (ios-workflow, SPM, manual signing, TestFlight publish)
- Discount feature (DB tables, server actions, SplitDetail bottom sheet, results/share page)
- gwfc-brand switched from git+https to GitHub Packages registry

### Session 2 (2026-06-19)
- Full ocean colour palette (zinc → slate/teal) across 21 UI files
- App fee host auto-derivation (removed dropdown)
- Contacts import with email across all three attendee-adding flows
- Results page collapsible cards + Edit button
- Home page commit SHA display

### Session 1 (2026-06-18 / 2026-06-19)
- Next.js 15.3.3 → 15.3.9 security patch
- `generateId()` polyfill for Safari `crypto.randomUUID()`
- Server actions body size limit 10MB
- Hydration error fix (ClientDate), Safari file input detection, OCR error visibility
- Step 3 button redesign ("Load file" / "Create Split"), Add Charge feature, Eruda console, viewport fixes
