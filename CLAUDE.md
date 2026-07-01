@AGENTS.md

# TabSplit

## Project Overview
Receipt splitting mobile app for dining groups. One organiser scans/uploads a receipt, assigns line items to attendees, and everyone sees what they owe. No payment processing — just the split calculation and shareable results.

## Tech Stack
- Next.js 15.3.9 App Router, TypeScript, Tailwind CSS v4 (downgraded from v16 due to server action issues with Turbopack)
- Supabase (database, auth, storage)
- Capacitor 7.6.6 (iOS + Android wrapper) — pinned to 7.x to match `@capacitor-community/contacts@7.2.0` SPM version range
- Codemagic (CI/CD)
- Google Vision API (OCR for receipt scanning)
- next-pwa v5.6.0 (PWA support)
- Vercel (hosting, deployed at https://tabsplit-three.vercel.app)

## Key Conventions
- Australian spelling in all copy (organiser, colour, etc.)
- One step at a time
- PowerShell for all file operations
- 95% confidence before making code changes
- Never ask Tony to manually edit files
- Always run `npm run build` before committing and pushing
- Ask before pushing to GitHub or deploying to Vercel (standing permission granted, but confirm each time)
- Local Windows build is flaky with next-pwa + bracket-named dirs (e.g. [id], [token]) — push and let Vercel build instead

## Project Structure
- `/src/app` — App Router pages and layouts
- `/src/app/_components/` — Shared client components used by layout (e.g. `BottomNav.tsx`)
- `/src/components` — Reusable UI components
- `/src/lib` — Supabase client, utilities
- `/src/lib/uuid.ts` — `generateId()` polyfill for `crypto.randomUUID()` (Safari fallback)
- `/src/types` — TypeScript types and interfaces

## Colour Palette
All UI uses an ocean/slate palette. Do not reintroduce zinc or grey.

| Role | Class |
|---|---|
| Primary action buttons | `bg-teal-600 hover:bg-teal-700` (active: `active:bg-teal-700`) |
| Focus rings | `focus:ring-teal-500` |
| Active/checked state (toggles, checkboxes, step dots, nav) | `teal-600` |
| Dark display card (grand total) | `bg-slate-900` |
| Secondary buttons | `bg-slate-100 text-slate-700 hover:bg-slate-200` |
| Page backgrounds | `bg-slate-50` |
| Borders, rings | `border-slate-200`, `ring-slate-200`, `ring-slate-300` |
| Body text | `text-slate-900` |
| Muted text | `text-slate-400`, `text-slate-500` |
| Active nav icon SVG | `stroke="#0d9488"` (teal-600) |
| Muted nav icon SVG | `stroke="#94a3b8"` (slate-400) |
| themeColor | `#0f172a` (slate-900) |

**Preserved colours** (do not change these):
- `amber` — unassigned item warnings; **also** favourites star icon (`text-amber-400` filled, `text-slate-300` unfilled) and "Add to favourites" button (`bg-amber-500`)
- `green` / `emerald` — finalised status, Finalise button, Create Split button, discount lines
- `red` — errors, delete actions
- `violet` — Assign button
- `sky` — Equal button
- `indigo` — Load file button; also "From contacts" import button on Favourites tab
- `teal` (50/100 bg) — "From group" import button on Favourites tab

## Auth Flow
- Email + password (`signInWithPassword` / `signUp`)
- `LoginForm.tsx` has a tab switcher: **Log in** (email + password → `signInWithPassword`) and **Sign up** (email + password + confirm → `signUp` → email confirmation required before first login)
- Password field has show/hide toggle; friendly error messages mapped from Supabase error strings
- Forgot password: `resetPasswordForEmail` → sends reset link to `/reset-password` → `src/app/(auth)/reset-password/page.tsx` handles the recovery token, shows password form, calls `supabase.auth.updateUser({ password })`, redirects to `/` on success
- Server-side auth check on login page: `getUser()` → redirect to `/` if already authenticated
- Files: `src/app/(auth)/login/page.tsx` (server component, auth guard), `LoginForm.tsx` (client component, tabs + forms), `forgot-password/page.tsx` (client component)

## Database Schema
### Tables
- `users` — auth users with display_name, phone, payid, payid_label
- `groups` — saved collections of people the organiser splits with regularly; `saved` boolean (default false) indicates whether the organiser has chosen to keep the group for future use
- `group_members` — individual people within a group; each has a display_name, optional phone, optional email, optional link to a user account, and optional `merge_group_id` / `merge_label` for pre-configured merge pairs (e.g. couples)
- `splits` — a dining event with receipt, organiser, status, optional `group_id`, `total` (receipt grand total), and `subtotal` (receipt subtotal before tip/tax); both set at OCR scan time
- `attendees` — people in a split, linked to optional user account; has optional email field; `paid boolean` (default false) tracks whether each attendee has paid their share
- `attendee_groups` — merged attendees within a split (e.g. couples paying together); has optional `phone` and `email` columns for the nominated group contact when sending share messages
- `items` — individual line items exploded from receipt (no quantity field — one row per unit)
- `item_assignments` — which attendee owns which item
- `share_links` — tokenised public links for non-authenticated viewing
- `discounts` — percentage or flat discounts applied to selected attendees; columns: id, split_id, type ('percentage'|'flat'), value numeric(10,2), created_at
- `discount_attendees` — which attendees a discount applies to; columns: id, discount_id, attendee_id; cascade-deletes when discount is removed
- `favourite_contacts` — saved contacts for quick reuse; columns: id, user_id, display_name, phone (nullable), email (nullable), created_at; RLS: owner read/write only

### Migrations
- `20240101000000` — initial schema: all core tables (users, splits, attendee_groups, attendees, items, item_assignments, share_links), RLS policies, receipts storage bucket
- `20240101000001` — handle_new_user trigger: mirrors new auth.users rows into public.users (security definer, on conflict do nothing)
- `20240101000002` — adds groups and group_members tables; adds group_id FK to splits; expands status check to include 'pending'
- `20240101000003` — adds email (nullable) to group_members and attendees tables
- `20240101000004` — adds discounts and discount_attendees tables with RLS
- `20260623120000` — adds payid and payid_label (nullable) to users; adds public read policy for organiser profile when a share link exists for their split
- `20260625000000` — adds merge_group_id (uuid) and merge_label (text) to group_members; enables pre-configured merge pairs in saved groups
- `20260625010000` — adds 'archived' to splits status check constraint (pending | draft | finalised | archived)
- `20260625020000` — adds phone and email columns to attendee_groups; stores nominated contact for group share messages
- `20260625030000` — adds `paid boolean not null default false` to attendees
- `20260625040000` — adds `favourite_contacts` table with RLS (owner read/write only)
- `20260630000000` — adds `subtotal numeric(10,2)` column to splits (stores receipt subtotal from OCR scan)

### Split Status Flow
Splits move through these states:
1. `pending` — group has been set, but no bill uploaded yet (default status on creation)
2. `draft` — bill uploaded and items are being assigned to attendees
3. `finalised` — assignments locked, each person can see their total via share link
4. `archived` — removed from active view; shown in Archived tab on Splits page

Splits can be moved back from `finalised` → `draft` via the Edit button on the results page (`unfinaliseSplit` action deletes the share_link row and resets status). Archive/restore is handled via swipe-to-reveal actions on SplitList.

## RLS Notes
- splits table had infinite recursion in public read policy — fixed by extracting a security definer function `split_has_share_link(split_id uuid)` that checks share_links without recursion
- Policy now checks: auth.uid() = organiser_id OR split_has_share_link(id)
- discounts and discount_attendees: organiser manages via split ownership check; public read via `split_has_share_link(split_id)` (discount_attendees joins through discount_id → split_id)

## Core User Flow
1. Organiser creates a split, selects or creates a group of people to split with
2. Organiser uploads receipt photo (step 3 of new split form — "Load file" opens picker, "Create Split" submits)
3. Google Vision OCR parses line items — quantities exploded into individual rows
4. Organiser assigns items to attendees (tap to assign, batch "Assign by line", or "Equal" split)
5. Optionally merge attendees into a group (e.g. couples), add extra charges (tip, app fee, service charge), or apply discounts
6. Finalise split — "Finalise" button turns emerald when all items assigned — each person sees their total via shareable link
7. Organiser can tap "Edit" on the results page to reopen the split for editing (unfinalises it)

## Extra Charges (Tips & Fees)
Added via "Add charge" button in SplitDetail. Types: Tip, App fee, Service charge, Custom, Transaction fee.
Add charge modal has 5 chips in a `grid-cols-5` layout.

### Tip
- Shows bill subtotal
- Quick percentage buttons: 10%, 15%, 18%, 20%
- Split equally toggle (assign to all or leave unassigned)

### App Fee — two payment modes
- **Host paid total**: Full fee assigned to all attendees equally. Each person reimburses the host their share.
- **Per person**: Total fee ÷ attendees = per-person amount. Host is automatically derived from `split.organiser_id` matched against `attendees.user_id` — no dropdown. Item price saved = per-person × non-host count. Non-hosts each owe their share in the split; host pays their portion directly to the app provider.
  - Example: $1 fee, 4 people, host = Alice → item = $0.75 assigned to 3 non-hosts ($0.25 each). Alice pays $0.25 directly.
  - Edge case: if organiser isn't listed as an attendee, `hostAttendee` is null and all attendees are charged equally.

### Service charge / Custom
- Fixed amount, split equally toggle

### Transaction fee
- Two sub-modes toggled by chips: **Flat ($)** — enter dollar amount directly; **% of subtotal** — enter percentage, computed as `itemsSum × pct / 100`
- Amount input shows `$` prefix for flat, `%` suffix for percentage
- Always assigned to all attendees equally (no "Split equally" toggle shown)
- Labelled "Transaction fee" on the bill; identified as a known charge in variance display

## Discounts
Added via "Apply discount" inline button in SplitDetail (alongside "Merge attendees" and "Add charge").

### Types
- **Percentage**: reduces each selected attendee's total by the given % of their current total at time of application
- **Flat**: total discount amount distributed proportionally by each attendee's share of the combined item total among selected attendees only

### UI
- Bottom sheet modal: percentage/flat toggle chips, value input ($-prefixed for flat, %-suffixed for percentage), attendee multi-select with "Select all" button
- Applied discounts shown as emerald chips below the inline buttons (`{value}% off · {names}` or `${value} off · {names}`), with × to remove
- Apply button disabled until value > 0 and at least one attendee selected

### Calculation (results page + share page)
Discounts applied after item totals are accumulated, before grouping (attendee_groups):
- Percentage: `discountAmount = round(attendeeTotal * pct * 100) / 100`; subtract from total
- Flat: `sum = total of all selected attendees; discountAmount = round(value * (rawTotal/sum) * 100) / 100`; subtract from each
- Discount lines rendered in `bg-emerald-50` / `text-emerald-700` with `−$X.XX` format

## Server Actions
- `src/app/splits/[id]/actions.ts`:
  - `saveItems(splitId, items, total?, subtotal?)` — inserts OCR-parsed items, updates split status to draft, persists `total` and `subtotal` to splits row
  - `assignItem(itemId, attendeeIds[])` — replaces assignments for one item; pass `[]` to unassign
  - `addLineItem(splitId, description, price, attendeeIds | null, sortOrder)` — adds a tip/charge item; null = assign to all, [] = leave unassigned, [...ids] = specific attendees
  - `mergeAttendees` — creates attendee_groups record and links attendees
  - `unmergeGroup(groupId)` — unlinks attendees from group, deletes attendee_groups row
  - `finaliseSplit` — sets status to finalised, creates share_link token
  - `unfinaliseSplit` — sets status back to draft, deletes share_link row (used by Edit button on results page)
  - `equalSplit` — assigns all items to all attendees equally
  - `applyDiscount(splitId, type, value, attendeeIds[])` — inserts discount + discount_attendees rows
  - `removeDiscount(discountId)` — deletes discount row (cascade removes discount_attendees)
  - `updateAttendee(attendeeId, { display_name, phone, email })` — edits attendee contact details
  - `addAttendee(splitId, displayName, phone, email)` — inserts a new attendee into a split
  - `removeAttendee(attendeeId)` — clears item_assignments, sets group_id to null, then deletes the attendee row
  - `updateLineItem(itemId, description, price)` — edits a line item's description and price
  - `deleteLineItem(itemId)` — removes item_assignments then deletes the item row
  - `markPaid(splitId, entityId, paid, isGroup)` — marks attendee or attendee_group as paid/unpaid
- `src/app/splits/new/actions.ts` — `createSplit` (FormData, includes receipt upload and email field on attendees)
- `src/app/splits/actions.ts` — `deleteSplit`

## Key Components

### BottomNav (`src/app/_components/BottomNav.tsx`)
- Client component rendered by root `layout.tsx`
- Two tabs: Home (`/`) and Profile (`/profile`); active tab highlighted via `usePathname`
- Returns `null` on `/login` and `/callback` so auth pages have no nav chrome
- SVG icons: active uses teal-600 stroke, inactive uses slate-400 stroke

### SplitDetail (`src/app/splits/[id]/SplitDetail.tsx`)
- Handles both states: no-items-yet (scan receipt) and item assignment UI
- Sticky header contains: back button + title, header action buttons row (Assign/Equal/Finalise), summary bar, tab switcher
- Header action buttons: Assign (violet, opens assign-by-line sheet), Equal (sky), Finalise (emerald when all assigned / slate when not)
- **Summary bar**: `justify-between` — left "Assigned: N · $X.XX" in `text-emerald-600`, right "Unassigned: N · $X.XX" in `text-amber-600` (or "All assigned" in slate-400 when done)
- **Tab switcher**: `activeTab: 'assign' | 'ocr'` — "Assign" tab shows item list + toolbar, "OCR data" tab shows 7 detected fields + skipped lines + raw OCR text
- Inline content toolbar (Assign tab only): "Merge attendees", "Add charge", "Apply discount", "Attendees"
- `defaultMergeLabel(ids)` auto-generates merge label as "Justin M and Tony M" (first name + surname initial if available, "and" not "&"); user can override before saving
- Add Charge bottom sheet: 5 chips (Tip / App fee / Service / Custom / Tx fee), type-specific content panels, amount input with $-prefix or %-suffix for tx fee
- Apply Discount bottom sheet: type toggle, value input, attendee multi-select, applied discount chips with remove
- **App fee host**: derived from `attendees.find(a => a.user_id === split.organiser_id)` — no dropdown; shows static display of host name or "Host not listed as an attendee"
- **Attendees sheet** (4 sub-views): list view (edit pencil + trash per row, "Add attendee" link), edit form, add form, remove confirmation
- **Receipt vs items summary card**:
  - `adjustedItemsSum = itemsSum − totalDiscountAmount` (discounts are live-computed from current assignment state)
  - `itemsVsReceiptDiff = adjustedItemsSum − receiptTotal`
  - Three-state variance indicator: green "Items match total" / neutral slate "Includes Tip $X · $Y discount" (when gap is fully explained by `KNOWN_CHARGE_DESCRIPTIONS` items + discounts) / amber warning for genuinely unexplained variance
  - `KNOWN_CHARGE_DESCRIPTIONS = ['Tip', 'App fee', 'Service charge', 'Transaction fee']`
- **Unassign via edit**: assign modal Save button is always enabled (even with zero selected); shows "Unassign" label when deselecting an already-assigned item
- Modals use z-50, receipt overlay z-[60]
- Sequential `for...of` loop for saving assignments (Promise.all drops excess server action calls)
- Props include `discounts: Tables<'discounts'>[]` and `discountAttendees: Tables<'discount_attendees'>[]`

### OCR Data Tab (`src/app/splits/[id]/SplitDetail.tsx` — OCR tab)
- Shown when `activeTab === 'ocr'`; only populated after scanning the receipt in the current session (ephemeral — lost on refresh)
- Displays 7 detected receipt fields using `ReceiptFields` from `src/lib/parseReceipt.ts`:
  - Subtotal, Total ex tax, GST, Total Inc Tax, To pay, Tip, Total
  - Found → `text-sm font-semibold text-gwfc-blue` with value; Blank → `italic text-slate-400`; Not found → `text-slate-300 "—"`
- Also shows: skipped lines (struck-through), raw OCR text (monospace)
- "View full receipt" row always shown at bottom of main content (outside tab content) when `signedReceiptUrl` is set

### OCR Parser (`src/lib/parseReceipt.ts`)
- Exports: `LineItem`, `FieldResult` (`found | blank | not_found`), `ReceiptFields` (7 named fields), `ParseResult`, `parseReceiptText(text)`
- Item zone restriction: only parses lines between "Description" header and first "Subtotal" line to avoid footer pollution
- `detectField(rawLines, labelRe, maxLook=2)` — checks same line for price, then looks ahead up to 2 lines for a price-only line; stops if real text (>3 chars) intervenes; returns `blank` if label found but no price, `not_found` if label absent
- 7 fields detected: subtotal (`\bsubtotal\b`), totalExTax, gst, totalIncTax, toPay, tip (`^\s*tip\b`), total (`^\s*total\s*:?\s*$` — exact match only, won't catch "Total Inc Tax")
- Derived `subtotal = subtotal ?? totalExTax`, `total = totalIncTax ?? toPay ?? total`
- Tip inference: if `total > subtotal`, creates Tip line item for the difference; falls back to `total − sum(items)` if no subtotal
- Unit tests: `src/lib/__tests__/parseReceipt.test.ts` — 4 tests via Vitest (`npm test`)

### NewSplitForm (`src/app/splits/new/NewSplitForm.tsx`)
- 3-step form: title → attendees → receipt
- Step 2 attendees: name + phone + email fields; "Import from contacts" button; star button on each attendee row (left of name)
- Step 3 has two distinct buttons: "Load file" (indigo, triggers file picker) and "Create Split" (emerald, submits) — they swap based on receipt state
- `handleFileChange`: accepts files with size=0 if they have a name (Safari returns zero-size Files); confirmed working on device
- Star buttons use `favMap` (keyed by `display_name.toLowerCase().trim()`) with optimistic updates; temp ID replaced by real after server action

### Results Page (`src/app/splits/[id]/results/`)
- `page.tsx` — server component; fetches split data (discounts + discount_attendees in two-phase query), renders PersonCard list and header buttons
- `PersonCard.tsx` — **client component**; collapsible card showing person name + total; tap to expand item breakdown with chevron animation; default collapsed; shows emerald discount lines when expanded; star (favourite) button always visible in card header (right side, after expand chevron) for non-group entries; Mark paid + Resend buttons in expanded row
- `EditButton.tsx` — **client component**; calls `unfinaliseSplit` then `router.push(/splits/${id})` to reopen the split for editing
- `ShareButton.tsx` — **client component**; uses `navigator.share` or clipboard copy

### Favourite Star Button Pattern
Used in four places: NewSplitForm step 2, NewGroupForm step 2, GroupDetail edit mode, PersonCard on results page.

Attendee row layout: `[★ star] [name/contact flex-1] [× delete]` — star is always LEFT of name, far from the delete button.

```typescript
// favMap: Map<display_name.toLowerCase().trim(), favourite_contacts.id>
// Optimistic toggle: add temp ID immediately, replace with real ID after server action
// On error: roll back
async function handleToggleFav(name, phone, email) { ... }
function starBtn(name, phone, email) { ... } // returns amber filled / slate outline button
```

Server actions: `addFavourite(name, phone, email): Promise<string>` (returns real ID), `removeFavourite(id): Promise<void>` — both in `src/app/favourites/actions.ts`

### SplitList (`src/app/SplitList.tsx`)
- `ClientDate` component defers `Intl.DateTimeFormat` to client via `useEffect` — avoids SSR/client timezone hydration mismatch
- Exports `SplitWithCount` type (`Tables<'splits'> & { attendees: { paid: boolean }[] }`) — must be imported at call sites to avoid cross-file type mismatch errors on Vercel
- Swipe-to-reveal: Archive/Restore (slate/teal) and Delete (red) action buttons
- **Architecture**: two exports:
  - `SplitList` — controlled; receives `splits` + `onArchive`, `onRestore`, `onDelete` callbacks; owns only swipe `openId` state
  - `SplitListWithState` — stateful wrapper used by the home page; holds its own `useState(initialSplits)` and handles mutations locally

### SplitsPageClient (`src/app/splits/SplitsPageClient.tsx`)
- Client component for the Splits page; receives all splits from server, holds master `useState<SplitWithPaid[]>` and derives three filtered lists
- Exports `SplitWithPaid` type — must be imported in `splits/page.tsx` (same cross-file type rule)
- **Active**: `pending`, `draft`, or `finalised` where not all attendees have paid
- **Complete**: `finalised` AND all attendees paid (`attendees.length > 0 && attendees.every(a => a.paid)`)
- **Archived**: `status === 'archived'`
- Uses hidden-div approach (all three `SplitList` instances mounted simultaneously, toggled with `hidden` class) to preserve swipe state across tab switches
- Archive/restore/delete mutations update master state → all three tabs re-derive immediately (no navigation needed)

### ShareWithEveryone (`src/app/splits/[id]/results/ShareWithEveryone.tsx`)
- "Share with everyone" bottom sheet; Link / Email / SMS method switcher
- `GroupMember` interface: `{ display_name, phone, email, total }` — `total` is the individual's share within the group
- `buildMessage(displayName, total, isGroup, memberBreakdown?)`:
  - Groups: greeting uses full group label (e.g. "Hey Justin M and Tony M"); includes per-member breakdown lines
  - Individuals: greeting uses first name only (`displayName.split(' ')[0]`)
- Multi-select picker for merged groups with 2+ contactable members: teal checkboxes, all pre-selected, per-member amount shown; "Send SMS to group thread" / "Send email to both" button
- Multi-recipient SMS: single → `sms:${phone}?body=...`; multiple → `sms://open?addresses=${phones.join(',')}&body=...` (iOS group thread)
- Multi-recipient email: `mailto:${emails.join(',')}?subject=...&body=...`

### GroupsPageClient (`src/app/groups/GroupsPageClient.tsx`)
- Client component for the Groups page; Groups/Favourites tab switcher
- **Groups tab**: lists saved groups (GroupCard → `/groups/[id]`), "New Group" button at bottom
- **Favourites tab**:
  - Lists `FavouriteCard` entries (amber star icon, × remove button with optimistic delete)
  - "From contacts" button (indigo) — opens `ContactPicker` on native; shows "native only" message on web
  - "From group" button (teal) — opens `GroupPicker` sheet listing saved groups; tapping a group loads its members into `ContactPicker` for multi-select; hidden if no saved groups
  - "Add manually" form — name + optional phone + optional email + amber "Add to favourites" button
  - All additions are optimistic (temp ID replaced by real ID after server action)
- `GroupWithMembers` type exported: `Tables<'groups'> & { group_members: GroupMember[] }` — query fetches `group_members(id, display_name, phone, email)` (not count)
- `GroupPicker` — inline bottom sheet component; shows each group's member count and how many are already saved

## Contacts Import
Available in four places: NewSplitForm step 2, NewGroupForm step 2, GroupDetail edit mode, GroupsPageClient Favourites tab.

Pattern used in all three:
```typescript
// tryImportContacts() — module-level async function
// 1. Check Capacitor.isNativePlatform() — returns null if not native
// 2. Call Contacts.requestPermissions() — shows system permission dialog
// 3. Call Contacts.getContacts({ projection: { name, phones, emails } })
// 4. Map to { id, display_name, phone, email }

// handleImportContacts() — component handler
// 1. Check isNative inline — if false, show "only available in native app" message for 3s
// 2. Call tryImportContacts() — returns null if permission denied
// 3. Append contacts to list, deduplicating by display_name
```

- Uses `@capacitor-community/contacts` (NOT `@capacitor/contacts`)
- On web/PWA: shows "Contact import is only available in the native app." message (3 second timeout)
- On native: requests permission via `requestPermissions()` before `getContacts()`
- Imports email from contact cards (`c.emails?.[0]?.address`) alongside name and phone
- `NSContactsUsageDescription` is confirmed set in `ios/App/App/Info.plist`

## Home Page
- Shows short git commit SHA (7 chars) below the TabSplit title using `process.env.VERCEL_GIT_COMMIT_SHA`
- Only visible on Vercel deploys (env var not set in local dev)

## Mobile / PWA
- `src/lib/uuid.ts` — `generateId()` polyfills `crypto.randomUUID()` for older Safari
- `layout.tsx` viewport: `maximumScale: 1` (prevents iOS zoom on input focus), `viewportFit: 'cover'` (notch/safe area)
- `html`: `h-dvh` (dynamic viewport height), `body`: `h-full overflow-y-auto overscroll-none`
- Eruda mobile debug console — floating icon bottom-right, visible on all builds. Installed as `eruda` npm package. `src/lib/debug.ts` exports `initEruda()` (skips if `NEXT_PUBLIC_ENABLE_ERUDA=false`). `src/components/ErudaInit.tsx` is a `'use client'` component that calls it in a `useEffect`, mounted from `layout.tsx`. **ON by default** — set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel env vars before any public/production release.
- PWA manifest at `/public/manifest.json`; icons at `/public/icons/icon-192.png`, `/public/icons/icon-512.png` (PNGs still need generating from icon.svg)
- Server actions body size limit: 10MB (`next.config.ts` experimental.serverActions.bodySizeLimit)

## Capacitor
- Version: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli` all at `^7.6.6`
  - Pinned to 7.x because `@capacitor-community/contacts@7.2.0` requires `capacitor-swift-pm` in range `7.0.0..<8.0.0`; Capacitor 8.x ships SPM `8.x` which conflicts
- **Strategy**: `server.url` pointing at live Vercel deployment (`https://tabsplit-three.vercel.app`) — static export is NOT used because Next.js server actions and OCR API routes require a server
  - `webDir: 'out'` is kept in `capacitor.config.ts` (unused when `server.url` is set; required by Capacitor CLI to not error)
- **Bundle ID**: `app.tabsplit.com` (reversed domain convention)
  - Set in `capacitor.config.ts` (`appId`), `android/app/build.gradle` (`namespace`, `applicationId`), `ios/App/App.xcodeproj/project.pbxproj` (both Debug and Release `PRODUCT_BUNDLE_IDENTIFIER`)
- Uses Swift Package Manager (SPM), not CocoaPods — Capacitor 6+ generates `ios/App/CapApp-SPM/Package.swift` via `npx cap sync`; no Podfile exists

### Capacitor Plugins
- `@capacitor/camera` — receipt photo and camera roll access
- `@capacitor-community/contacts` — add attendees from phone contacts (NOT `@capacitor/contacts`)

## iOS Native
- `ios/App/App/Info.plist` contains:
  - `NSContactsUsageDescription`: "TabSplit uses your contacts to quickly add people to a bill split."
  - `NSCameraUsageDescription`: "TabSplit uses your camera to scan receipts."
  - `NSPhotoLibraryUsageDescription`: "TabSplit needs access to your photo library to select receipt images."
- `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` — shared Xcode scheme; required for Codemagic CI builds
  - BlueprintIdentifier: `504EC3031FED79650016851F`, BuildableName: `App.app`
  - ArchiveAction buildConfiguration: Release

## Codemagic (`codemagic.yaml`)
- Workflow: `ios-workflow` — builds and uploads to TestFlight
- Machine: `mac_mini_m2`
- Node: `22.11.0`, Xcode: `latest`
- **No CocoaPods step** — Capacitor 7 uses SPM exclusively
- Signing: manual via `ios_signing_manual` variable group
  - Variables: `CM_CERTIFICATE` (base64 P12), `CM_CERTIFICATE_PASSWORD`, `CM_PROVISIONING_PROFILE` (base64 mobileprovision)
  - Signing script decodes to `/tmp/certificate.p12` and `~/Library/MobileDevice/Provisioning Profiles/profile.mobileprovision`, initialises a build keychain, then runs `xcode-project use-profiles`
- Build number: auto-incremented via `agvtool new-version -all $PROJECT_BUILD_NUMBER` — Codemagic's `$PROJECT_BUILD_NUMBER` increments on every build, preventing App Store Connect duplicate build number rejections
- Build: `xcode-project build-ipa --project "ios/App/App.xcodeproj" --scheme "App"`
- Artifacts: `build/ios/ipa/*.ipa`
- Publishing: App Store Connect integration (`app_store_connect` auth block), `submit_to_testflight: true`
- Env vars used: `XCODE_PROJECT: "ios/App/App.xcodeproj"`, `XCODE_SCHEME: "App"`, `BUNDLE_ID: "app.tabsplit.com"`

### Codemagic Script Order
1. Install npm dependencies (`npm ci`)
2. Capacitor sync (`npx cap sync ios`)
3. Increment build number (`agvtool new-version -all $PROJECT_BUILD_NUMBER`)
4. Set up manual code signing
5. Build ipa for distribution

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_VISION_API_KEY` (server-side only)
- `VERCEL_GIT_COMMIT_SHA` — auto-injected by Vercel at build time; used on home page
- `NPM_GITHUB_TOKEN` — GitHub Personal Access Token with `read:packages` scope; required by `.npmrc` to pull `@tmcstay/gwfc-brand` from GitHub Packages; must be set in Vercel env vars and Codemagic `npm_auth` variable group

## GitHub Packages / .npmrc
- `.npmrc` configures `@tmcstay` scope to use GitHub Packages registry
- Auth token read from `NPM_GITHUB_TOKEN` env var via `${NPM_GITHUB_TOKEN}` — npm expands `${}` in `.npmrc` files natively
- This works in Vercel (set as env var) and Codemagic (set in `npm_auth` variable group)
- Do NOT hardcode the token in `.npmrc` — it is committed to git

## OCR Route (`src/app/api/ocr/route.ts`)
- POST — accepts `{ image: base64string }`
- Calls Google Vision DOCUMENT_TEXT_DETECTION
- On error returns `{ error, visionStatus, visionStatusText, detail }` so client can see upstream HTTP code
- Parses receipt text via `parseReceiptText` from `src/lib/parseReceipt.ts`
- Returns `{ items, total, subtotal, rawLines, excluded, fields, rawText }` — full OCR data including all 7 detected fields and raw lines for the OCR data tab

## Current Status
- Auth complete
- App shell complete (home, profile, bottom nav, saved groups)
- Groups flow complete (create, edit, save toggle, member management, contacts import)
- New split flow complete (3-step, receipt upload, contacts import, email field)
- OCR complete (Google Vision, two-line parsing, quantity explosion, 7 named fields with Found/Blank/Not found states)
- Item assignment UI complete (assign, assign-by-line, equal split, merge attendees, edit/delete/add items, unassign via edit)
- Extra charges complete (tip with % shortcuts, app fee with auto host derivation, service, custom, transaction fee)
- Discounts complete (percentage and flat, per-attendee, shown on results + share pages)
- Assign screen complete: tab switcher (Assign/OCR data), summary bar (Assigned N·$X / Unassigned N·$X), receipt vs items variance card with smart three-state indicator, Attendees sheet (view/edit/add/remove), `adjustedItemsSum` accounts for discounts
- Results page complete (collapsible per-person cards, discount lines, edit button to reopen split, share button, star/favourite button on each person)
- Public share page complete (with discount lines)
- Favourites complete: `favourite_contacts` table, star toggle on all attendee-adding screens (left of name), Favourites tab on Groups page with from-contacts + from-group pickers + manual add form
- Splits page tabbed view complete: Active / Complete (all paid) / Archived tabs; `SplitsPageClient` with hidden-div approach
- Home page shows only active splits (pending/draft + finalised-unpaid); excludes completed/archived
- Capacitor configured: server.url → Vercel, bundle ID app.tabsplit.com, Info.plist usage keys set, SPM scheme file present, all packages at 7.6.6
- Codemagic yaml written — build not yet confirmed successful
- `.npmrc` configured with GitHub Packages registry + `NPM_GITHUB_TOKEN` auth
- iOS build number auto-increment via `$PROJECT_BUILD_NUMBER` in codemagic.yaml
- Deployed to Vercel at https://tabsplit-three.vercel.app
- Debug console.logs removed from `splits/new/actions.ts`; Safari receipt detection confirmed working on device
- Codemagic build confirmed; `NPM_GITHUB_TOKEN` set in Vercel and Codemagic; PWA PNG icons generated
- Archive/restore now reflects immediately across all tabs (lifted state into SplitsPageClient)
- Share SMS/email: groups get full label greeting + per-member breakdown; individuals get first name only
- Merge label format updated to "Justin M and Tony M" (first name + surname initial, "and" not "&")
- Multi-select picker for group SMS/email; multi-recipient via sms://open?addresses= and mailto:
- `subtotal` column added to splits table (migration 20260630000000, confirmed run)
- OCR parser extracted to `src/lib/parseReceipt.ts` with Vitest unit tests (4 tests passing)
- Next: confirm multi-recipient group SMS works on device; set `NEXT_PUBLIC_ENABLE_ERUDA=false` in Vercel env vars before public/production release
