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
- `amber` — unassigned item warnings
- `green` / `emerald` — finalised status, Finalise button, Create Split button, discount lines
- `red` — errors, delete actions
- `violet` — Assign button
- `sky` — Equal button
- `indigo` — Load file button

## Auth Flow
- Email + password (`signInWithPassword` / `signUp`)
- `LoginForm.tsx` has a tab switcher: **Log in** (email + password → `signInWithPassword`) and **Sign up** (email + password + confirm → `signUp` → email confirmation required before first login)
- Password field has show/hide toggle; friendly error messages mapped from Supabase error strings
- Forgot password: `resetPasswordForEmail` → sends reset link to `/reset-password` — **NOTE: `/reset-password` page does not yet exist**; the reset link will 404 after clicking
- Server-side auth check on login page: `getUser()` → redirect to `/` if already authenticated
- Files: `src/app/(auth)/login/page.tsx` (server component, auth guard), `LoginForm.tsx` (client component, tabs + forms), `forgot-password/page.tsx` (client component)

## Database Schema
### Tables
- `users` — auth users with display_name, phone, payid, payid_label
- `groups` — saved collections of people the organiser splits with regularly; `saved` boolean (default false) indicates whether the organiser has chosen to keep the group for future use
- `group_members` — individual people within a group; each has a display_name, optional phone, optional email, and optional link to a user account
- `splits` — a dining event with receipt, organiser, status, and optional `group_id` linking back to the group it was created from
- `attendees` — people in a split, linked to optional user account; has optional email field
- `attendee_groups` — merged attendees within a split (e.g. couples paying together)
- `items` — individual line items exploded from receipt (no quantity field — one row per unit)
- `item_assignments` — which attendee owns which item
- `share_links` — tokenised public links for non-authenticated viewing
- `discounts` — percentage or flat discounts applied to selected attendees; columns: id, split_id, type ('percentage'|'flat'), value numeric(10,2), created_at
- `discount_attendees` — which attendees a discount applies to; columns: id, discount_id, attendee_id; cascade-deletes when discount is removed

### Migrations
- `20240101000000` — initial schema: all core tables (users, splits, attendee_groups, attendees, items, item_assignments, share_links), RLS policies, receipts storage bucket
- `20240101000001` — handle_new_user trigger: mirrors new auth.users rows into public.users (security definer, on conflict do nothing)
- `20240101000002` — adds groups and group_members tables; adds group_id FK to splits; expands status check to include 'pending'
- `20240101000003` — adds email (nullable) to group_members and attendees tables
- `20240101000004` — adds discounts and discount_attendees tables with RLS
- `20260623120000` — adds payid and payid_label (nullable) to users; adds public read policy for organiser profile when a share link exists for their split

### Split Status Flow
Splits move through three states in order:
1. `pending` — group has been set, but no bill uploaded yet (default status on creation)
2. `draft` — bill uploaded and items are being assigned to attendees
3. `finalised` — assignments locked, each person can see their total via share link

Splits can be moved back from `finalised` → `draft` via the Edit button on the results page (`unfinaliseSplit` action deletes the share_link row and resets status).

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
Added via "Add charge" button in SplitDetail. Types: Tip, App fee, Service charge, Custom.

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
  - `saveItems` — inserts OCR-parsed items, updates split status to draft
  - `assignItem(itemId, attendeeIds[])` — replaces assignments for one item
  - `addLineItem(splitId, description, price, attendeeIds | null, sortOrder)` — adds a tip/charge item; null = assign to all, [] = leave unassigned, [...ids] = specific attendees
  - `mergeAttendees` — creates attendee_groups record and links attendees
  - `finaliseSplit` — sets status to finalised, creates share_link token
  - `unfinaliseSplit` — sets status back to draft, deletes share_link row (used by Edit button on results page)
  - `equalSplit` — assigns all items to all attendees equally
  - `applyDiscount(splitId, type, value, attendeeIds[])` — inserts discount + discount_attendees rows
  - `removeDiscount(discountId)` — deletes discount row (cascade removes discount_attendees)
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
- Header action buttons: Assign (violet, opens assign-by-line sheet), Equal (sky), Finalise (emerald when all assigned / slate when not)
- Inline content buttons: "Merge attendees", "Add charge", "Apply discount"
- Add Charge bottom sheet with tip shortcuts and app fee payment mode logic
- Apply Discount bottom sheet: type toggle, value input, attendee multi-select, applied discount chips with remove
- **App fee host**: derived from `attendees.find(a => a.user_id === split.organiser_id)` — no dropdown; shows static display of host name or "Host not listed as an attendee"
- Summary bar fixed above bottom nav showing assigned total and unassigned count
- Modals use z-50, receipt overlay z-[60]
- Sequential `for...of` loop for saving assignments (Promise.all drops excess server action calls)
- Props include `discounts: Tables<'discounts'>[]` and `discountAttendees: Tables<'discount_attendees'>[]`

### NewSplitForm (`src/app/splits/new/NewSplitForm.tsx`)
- 3-step form: title → attendees → receipt
- Step 2 attendees: name + phone + email fields; "Import from contacts" button
- Step 3 has two distinct buttons: "Load file" (indigo, triggers file picker) and "Create Split" (emerald, submits) — they swap based on receipt state
- `handleFileChange`: accepts files with size=0 if they have a name (Safari returns zero-size Files)
- Debug console.logs still present — remove once Safari file detection confirmed working

### Results Page (`src/app/splits/[id]/results/`)
- `page.tsx` — server component; fetches split data (discounts + discount_attendees in two-phase query), renders PersonCard list and header buttons
- `PersonCard.tsx` — **client component**; collapsible card showing person name + total; tap to expand item breakdown with chevron animation; default collapsed; shows emerald discount lines when expanded
- `EditButton.tsx` — **client component**; calls `unfinaliseSplit` then `router.push(/splits/${id})` to reopen the split for editing
- `ShareButton.tsx` — **client component**; uses `navigator.share` or clipboard copy

### SplitList (`src/app/SplitList.tsx`)
- `ClientDate` component defers `Intl.DateTimeFormat` to client via `useEffect` — avoids SSR/client timezone hydration mismatch

## Contacts Import
Available in three places: NewSplitForm step 2, NewGroupForm step 2, GroupDetail edit mode.

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
- Eruda mobile console injected via `next/script` (afterInteractive) when hostname ≠ localhost or includes vercel.app — shows floating debug console on device
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
- Parses receipt text: handles price-on-same-line and price-on-next-line formats, explodes quantities

## Current Status
- Auth complete
- App shell complete (home, profile, bottom nav, saved groups)
- Groups flow complete (create, edit, save toggle, member management, contacts import)
- New split flow complete (3-step, receipt upload, contacts import, email field)
- OCR complete (Google Vision, two-line parsing, quantity explosion)
- Item assignment UI complete (assign, assign-by-line, equal split, merge attendees)
- Extra charges complete (tip with % shortcuts, app fee with auto host derivation, service, custom)
- Discounts complete (percentage and flat, per-attendee, shown on results + share pages)
- Results page complete (collapsible per-person cards, discount lines, edit button to reopen split, share button)
- Public share page complete (with discount lines)
- Capacitor configured: server.url → Vercel, bundle ID app.tabsplit.com, Info.plist usage keys set, SPM scheme file present, all packages at 7.6.6
- Codemagic yaml written — build not yet confirmed successful
- `.npmrc` configured with GitHub Packages registry + `NPM_GITHUB_TOKEN` auth
- iOS build number auto-increment via `$PROJECT_BUILD_NUMBER` in codemagic.yaml
- Deployed to Vercel at https://tabsplit-three.vercel.app
- Next: trigger Codemagic build and verify, remove debug logs from NewSplitForm once Safari confirmed, generate PWA PNG icons, full end-to-end mobile test
