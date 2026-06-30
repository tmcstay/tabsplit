# TabSplit — Session Handoff

## Session Date
2026-06-30 (session 7)

## Completed This Session

### OCR Parser Fix — Blank "Tip:" Label
- **Bug**: A blank "Tip:" line on printed receipts was being matched by Strategy 1 (price-on-next-line), pairing it with the nearby total/subtotal value and creating a spurious Tip line item.
- **Fix**: Added `\btip\b` to `skipRe` so "Tip:" lines are never treated as item descriptions. Subtotal now extracted separately. A Tip line item is only created if `Total Inc Tax > Subtotal` (difference = tip amount). If no subtotal found, falls back to `total − sum(items)`.
- Extracted `parseReceiptText` to `src/lib/parseReceipt.ts` for testability.
- Added Vitest (`npm test`) with two test cases: bug fixture (5 items, $113 subtotal, blank Tip:, $113 total → no tip) and regression (total exceeds subtotal → tip = difference).

### Edit / Delete / Add Line Items on Assign Screen
- **Edit**: Pencil icon on each item row opens an "Edit item" bottom sheet — updates description and/or amount via `updateLineItem` server action.
- **Delete**: Trash icon opens a "Remove item" confirmation sheet — clears assignments then deletes the row via `deleteLineItem` server action.
- **Add**: Dashed "Add item" button below the items list opens an "Add item" bottom sheet — creates item unassigned via existing `addLineItem` action.
- All three mutations call `router.refresh()` so Assigned total and unassigned count update immediately.

### Eruda Debug Console (Re-added)
- Installed `eruda` npm package (replaces previous `next/script` CDN approach).
- `src/lib/debug.ts` — exports `initEruda()`: skips if `NEXT_PUBLIC_ENABLE_ERUDA=false`, otherwise dynamically imports and calls `eruda.init()`.
- `src/components/ErudaInit.tsx` — `'use client'` component, calls `initEruda()` in `useEffect`, mounted in `layout.tsx`.
- **Eruda is ON by default** on all builds/deploys. Set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel env vars before any public/production release.

---

## Bugs / Issues Encountered This Session

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Blank "Tip:" on receipt creates $113 Tip item | Strategy 1 paired "Tip:" with next price-only line | Added `\btip\b` to skipRe; tip now inferred from Total−Subtotal only |

---

## Next Steps (Pick Up From Here)

1. **Confirm multi-recipient group SMS on device** — verify `sms://open?addresses=` format opens a group iMessage thread with both recipients.

2. **Build `/reset-password` page** — `forgot-password/page.tsx` sends reset email pointing to `/reset-password`; that route currently 404s. Needs to handle `type=recovery` session, show new password fields, call `supabase.auth.updateUser({ password })`, redirect to `/` on success.

3. **Disable Eruda for production** — set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel env vars before public/production release. Currently ON by default on all builds.

4. **Android package path** — `android/app/src/main/java/com/tabsplit/app/` still uses old package structure. Low priority until Android build is needed.

---

## Open Questions / Decisions to Revisit

- **`/reset-password` page missing** — anyone clicking "Forgot password?" hits a 404 after the reset email. High priority before shipping.

- **Multi-recipient SMS confirmation** — `sms://open?addresses=` is documented for iOS but not confirmed working on device yet.

- **Contacts on PWA** — "From contacts" / "Import from contacts" buttons visible on web but show "native only" message. Decide whether to hide them on web entirely.

- **Eruda in production** — currently ON by default. Remember to set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel before public release.

- **Android bundle ID** — `android/app/src/main/java/com/tabsplit/app/` uses old package structure. Low priority.

- **OCR multi-line parsing accuracy** — real-world receipt accuracy not formally confirmed; price-on-next-line strategy needs more test receipts.

---

## Previous Sessions Summary

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
