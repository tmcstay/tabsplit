# TabSplit — Session Handoff

## Session Date
2026-07-01 (session 9)

## Completed This Session

### /reset-password page (`src/app/(auth)/reset-password/page.tsx`)
- Client component sitting inside the `(auth)` route group — inherits the `min-h-screen bg-slate-50` centred layout; BottomNav already excluded `/reset-password` from nav chrome.
- Four-state machine: `loading → ready | invalid`, and `ready → success`.
- **Loading state**: teal spinning SVG + "Verifying reset link…" while waiting for `onAuthStateChange`.
- **`PASSWORD_RECOVERY` event**: `supabase.auth.onAuthStateChange` listener set up on mount; when the event fires, clears the 4-second timeout and transitions to `ready`.
- **Invalid state** (4-second timeout, no event): red X icon, "Link invalid or expired" message, "Request a new reset link" (→ `/forgot-password`) and "Back to log in" (→ `/login`) links.
- **Form** (`ready`): two `PasswordInput` fields (same show/hide pattern as `LoginForm.tsx`), client-side validation (min 8 chars, must match), inline red error display, teal "Update password" button.
- **Success state**: green checkmark icon, "Password updated — redirecting…", `router.push('/')` after 1.5 s.
- Build confirmed clean (`npm run build` — no new errors or warnings).

---

## Previous Session (Session 8) — Completed

### Assign Screen — 4 Improvements
1. **Summary bar**: Replaced the old single-line assigned total with a `justify-between` row — left "Assigned: N · $X.XX" (`text-emerald-600`), right "Unassigned: N · $X.XX" (`text-amber-600`), or "All assigned" (`text-slate-400`) when done.

2. **Adjusted items sum**: `adjustedItemsSum = itemsSum − totalDiscountAmount` — discounts are live-computed from the current `assignments` state (per-attendee item share × discount rate). The receipt vs items variance card and `itemsVsReceiptDiff` both use this adjusted figure, so applied discounts are reflected without refreshing.

3. **Transaction fee charge type**: New 5th chip in Add charge modal (grid is now `grid-cols-5`). Sub-mode toggle: Flat ($) uses entered amount directly; % of subtotal computes `itemsSum × rate / 100`. Amount input shows `$` prefix for flat and `%` suffix for percentage. Always assigned to all attendees (no "Split equally" toggle). Labelled "Transaction fee" on the bill.

4. **Attendees sheet** (4 sub-views):
   - **List**: each attendee row has edit (pencil) and remove (trash) icon buttons; "Add attendee" teal link at the bottom
   - **Edit**: existing name/phone/email form (unchanged)
   - **Add**: new name/phone/email form → `addAttendee` server action
   - **Remove confirmation**: shows attendee name, Cancel/Remove buttons → `removeAttendee` server action (clears item_assignments, sets group_id null, then deletes)
   - "Attendees" button on toolbar (renamed from "Edit attendees"); resets all sub-view state on open

### New Server Actions (`src/app/splits/[id]/actions.ts`)
- `addAttendee(splitId, displayName, phone, email)` — inserts new attendee into split
- `removeAttendee(attendeeId)` — deletes item_assignments → sets group_id null → deletes attendee

### Bug Fix — Unassign via Edit
- **Bug**: assign modal Save button was `disabled={assignSelected.length === 0}`, preventing the user from saving zero selections to unassign an item.
- **Fix**: removed the zero-selection guard; button is now `disabled={busy}` only. Button label changes to "Unassign" when the item had existing assignments and the user has deselected all, otherwise "Save".

### Bug Fix — Smart Variance Indicator
- **Old behaviour**: any gap between Items sum and Receipt total showed amber warning.
- **New behaviour** (three states):
  1. **Green** — `adjustedItemsSum` matches receipt total exactly (< $0.02 diff)
  2. **Neutral slate** — gap is fully explained by known charges (`KNOWN_CHARGE_DESCRIPTIONS = ['Tip', 'App fee', 'Service charge', 'Transaction fee']`) and/or discounts; shows info icon + "Includes Tip $8.00 · $5.00 discount" style text
  3. **Amber warning** — gap is genuinely unexplained (OCR missed/misread prices, or item added via "Add item" that doesn't match a known charge label)
- Card background changes to match: emerald-50 / slate-50 / amber-50

---

## Bugs / Issues Encountered This Session

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| JSX parse error: `Expected '</', got ')'` | IIFE inside ternary chain (`?) (() => { return (<>...</>) })()`) breaks JSX parser | Removed IIFE; inlined `attendees.find(...)` directly in JSX expression |
| `prefer-const` ESLint error on `desc` in `handleAddCharge` | Declared as `let` but never reassigned (all branches covered in ternary) | Changed to `const` |

---

## Next Steps (Pick Up From Here)

1. **Confirm multi-recipient group SMS on device** — verify `sms://open?addresses=` format opens a group iMessage thread with both recipients.

2. **Disable Eruda for production** — set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel env vars before public/production release. Currently ON by default on all builds.

3. **Android package path** — `android/app/src/main/java/com/tabsplit/app/` still uses old package structure. Low priority until Android build is needed.

---

## Open Questions / Decisions to Revisit

- **Multi-recipient SMS confirmation** — `sms://open?addresses=` is documented for iOS but not confirmed working on device yet.

- **Contacts on PWA** — "From contacts" / "Import from contacts" buttons visible on web but show "native only" message. Decide whether to hide them on web entirely.

- **Eruda in production** — currently ON by default. Remember to set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel before public release.

- **Android bundle ID** — `android/app/src/main/java/com/tabsplit/app/` uses old package structure. Low priority.

- **Smart variance and "Add item"** — items added via "Add item" (not "Add charge") don't match `KNOWN_CHARGE_DESCRIPTIONS`, so they cause unexplained amber variance. This is intentional for now (OCR miss vs intentional add is indistinguishable), but could be addressed with an `is_charge` flag on items if needed.

---

## Previous Sessions Summary

### Session 7 (2026-06-30)
- Updated `saveItems` to accept and persist `subtotal` to splits table; migration `20260630000000` run
- Assign screen UI overhaul: removed receipt thumbnail, added sticky header with tab switcher (Assign / OCR data), OCR data tab with 7 named fields (Found/Blank/Not found), receipt vs items summary card at top of Assign tab, "View full receipt" row at bottom
- Fixed OCR multi-line field detection: `detectField` now looks ahead up to 2 lines for a price-only line when label and value are on separate lines
- Added Vitest unit tests for `parseReceipt.ts` (4 tests); extracted parser to `src/lib/parseReceipt.ts`

### Session 6 (2026-06-26)
- Debug console.log cleanup from splits/new/actions.ts
- Archive/restore bug fix (lifted state to SplitsPageClient; SplitList now controlled)
- Group SMS greeting bug fix (isGroup flag; full label for groups, first name for individuals; per-member breakdown)
- Merge label format: "Justin M and Tony M" (first name + surname initial, "and" not "&")
- Multi-select group SMS/email picker; multi-recipient via sms://open?addresses= and mailto:

### Session 5 (2026-06-25)
- Splits page three-tab view (Active / Complete / Archived) with hidden-div swipe state preservation
- Home page active-only filter (pending + draft + finalised-unpaid)
- Favourites feature complete across all four attendee screens + Favourites tab on Groups page
- Type safety fix for SplitWithCount / SplitWithPaid cross-file nominal type conflict

### Session 4 (2026-06-24)
- GitHub Packages auth in `.npmrc` — `${NPM_GITHUB_TOKEN}` pattern
- iOS build number auto-increment via `$PROJECT_BUILD_NUMBER` in codemagic.yaml
- CLAUDE.md history audit — filled in 4 missing migrations, auth flow details, BottomNav docs
- Favourites feature groundwork: `favourite_contacts` table, star buttons on attendee screens
- Group share message fix: was using group label instead of individual member name

### Session 3 (2026-06-19)
- Capacitor native build setup (server.url → Vercel, bundle ID app.tabsplit.com, downgraded to 7.6.6)
- Codemagic yaml (ios-workflow, SPM, manual signing, TestFlight publish)
- Discount feature (DB tables, server actions, SplitDetail bottom sheet, results/share page)
- gwfc-brand switched from git+https to GitHub Packages registry

### Session 2 (2026-06-19)
- Full ocean colour palette (zinc → slate/teal) across 21 UI files
- App fee host auto-derivation (removed dropdown)
- Contacts import with email across all three attendee-adding flows
- Results page collapsible cards + Edit button; home page commit SHA display

### Session 1 (2026-06-18 / 2026-06-19)
- Next.js 15.3.3 → 15.3.9 security patch; `generateId()` polyfill; server actions 10MB limit
- Hydration error fix (ClientDate), Safari file input detection, OCR error visibility
- Step 3 button redesign ("Load file" / "Create Split"), Add Charge feature, Eruda console, viewport fixes
