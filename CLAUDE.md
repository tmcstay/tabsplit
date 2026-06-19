@AGENTS.md

# TabSplit

## Project Overview
Receipt splitting mobile app for dining groups. One organiser scans/uploads a receipt, assigns line items to attendees, and everyone sees what they owe. No payment processing — just the split calculation and shareable results.

## Tech Stack
- Next.js 15.3.9 App Router, TypeScript, Tailwind CSS v4 (downgraded from v16 due to server action issues with Turbopack)
- Supabase (database, auth, storage)
- Capacitor (iOS + Android wrapper)
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
- `/src/components` — Reusable UI components
- `/src/lib` — Supabase client, utilities
- `/src/lib/uuid.ts` — `generateId()` polyfill for `crypto.randomUUID()` (Safari fallback)
- `/src/types` — TypeScript types and interfaces

## Auth Flow
- Email + password (signInWithPassword / signUp)
- Forgot password via resetPasswordForEmail
- Server-side auth check on login page redirects authenticated users to /
- Files: src/app/(auth)/login/page.tsx, LoginForm.tsx, forgot-password/page.tsx

## Database Schema
### Tables
- `users` — auth users with display_name and phone
- `groups` — saved collections of people the organiser splits with regularly; `saved` boolean (default false) indicates whether the organiser has chosen to keep the group for future use
- `group_members` — individual people within a group; each has a display_name, optional phone, optional email, and optional link to a user account
- `splits` — a dining event with receipt, organiser, status, and optional `group_id` linking back to the group it was created from
- `attendees` — people in a split, linked to optional user account; has optional email field
- `attendee_groups` — merged attendees within a split (e.g. couples paying together)
- `items` — individual line items exploded from receipt (no quantity field — one row per unit)
- `item_assignments` — which attendee owns which item
- `share_links` — tokenised public links for non-authenticated viewing

### Migrations
- `20240101000003` — adds email (nullable) to group_members and attendees tables

### Split Status Flow
Splits move through three states in order:
1. `pending` — group has been set, but no bill uploaded yet (default status on creation)
2. `draft` — bill uploaded and items are being assigned to attendees
3. `finalised` — assignments locked, each person can see their total via share link

## RLS Notes
- splits table had infinite recursion in public read policy — fixed by extracting a security definer function `split_has_share_link(split_id uuid)` that checks share_links without recursion
- Policy now checks: auth.uid() = organiser_id OR split_has_share_link(id)

## Core User Flow
1. Organiser creates a split, selects or creates a group of people to split with
2. Organiser uploads receipt photo (step 3 of new split form — "Load file" opens picker, "Create Split" submits)
3. Google Vision OCR parses line items — quantities exploded into individual rows
4. Organiser assigns items to attendees (tap to assign, batch "Assign by line", or "Equal" split)
5. Optionally merge attendees into a group (e.g. couples), or add extra charges (tip, app fee, service charge)
6. Finalise split — "Finalise" button turns emerald when all items assigned — each person sees their total via shareable link

## Extra Charges (Tips & Fees)
Added via "Add charge" button in SplitDetail. Types: Tip, App fee, Service charge, Custom.

### Tip
- Shows bill subtotal
- Quick percentage buttons: 10%, 15%, 18%, 20%
- Split equally toggle (assign to all or leave unassigned)

### App Fee — two payment modes
- **Host paid total**: Full fee assigned to all attendees equally. Each person reimburses the host their share.
- **Per person**: Total fee ÷ attendees = per-person amount. Host is excluded from the split item (select host from attendee list). Item price saved = per-person × non-host count. Non-hosts each owe their share in the split; host pays their portion directly to the app provider.
  - Example: $1 fee, 4 people, host = Alice → item = $0.75 assigned to 3 non-hosts ($0.25 each). Alice pays $0.25 directly.

### Service charge / Custom
- Fixed amount, split equally toggle

## Server Actions
- `src/app/splits/[id]/actions.ts`:
  - `saveItems` — inserts OCR-parsed items, updates split status to draft
  - `assignItem(itemId, attendeeIds[])` — replaces assignments for one item
  - `addLineItem(splitId, description, price, attendeeIds | null, sortOrder)` — adds a tip/charge item; null = assign to all, [] = leave unassigned, [...ids] = specific attendees
  - `mergeAttendees` — creates attendee_groups record and links attendees
  - `finaliseSplit` — sets status to finalised, creates share_link token
  - `equalSplit` — assigns all items to all attendees equally
- `src/app/splits/new/actions.ts` — `createSplit` (FormData, includes receipt upload)
- `src/app/splits/actions.ts` — `deleteSplit`

## Key Components
### SplitDetail (`src/app/splits/[id]/SplitDetail.tsx`)
- Handles both states: no-items-yet (scan receipt) and item assignment UI
- Header action buttons: Assign (violet, opens assign-by-line sheet), Equal (sky), Finalise (emerald when all assigned / zinc when not)
- Inline content buttons: "Merge attendees", "Add charge"
- Add Charge bottom sheet with tip shortcuts and app fee payment mode logic
- Summary bar fixed above bottom nav showing assigned total and unassigned count
- Modals use z-50, receipt overlay z-[60]
- Sequential `for...of` loop for saving assignments (Promise.all drops excess server action calls)

### NewSplitForm (`src/app/splits/new/NewSplitForm.tsx`)
- 3-step form: title → attendees → receipt
- Step 3 has two distinct buttons: "Load file" (indigo, triggers file picker) and "Create Split" (emerald, submits) — they swap based on receipt state
- `handleFileChange`: accepts files with size=0 if they have a name (Safari returns zero-size Files)
- Debug console.logs still present — remove once Safari file detection confirmed working

### SplitList (`src/app/SplitList.tsx`)
- `ClientDate` component defers `Intl.DateTimeFormat` to client via `useEffect` — avoids SSR/client timezone hydration mismatch

## Mobile / PWA
- `src/lib/uuid.ts` — `generateId()` polyfills `crypto.randomUUID()` for older Safari
- `layout.tsx` viewport: `maximumScale: 1` (prevents iOS zoom on input focus), `viewportFit: 'cover'` (notch/safe area)
- `html`: `h-dvh` (dynamic viewport height), `body`: `h-full overflow-y-auto overscroll-none`
- Eruda mobile console injected via `next/script` (afterInteractive) when hostname ≠ localhost or includes vercel.app — shows floating debug console on device
- PWA manifest at `/public/manifest.json`; icons at `/public/icons/icon-192.png`, `/public/icons/icon-512.png` (PNGs still need generating from icon.svg)
- Server actions body size limit: 10MB (`next.config.ts` experimental.serverActions.bodySizeLimit)

## Capacitor Plugins
- `@capacitor/camera` — receipt photo and camera roll access
- `@capacitor-community/contacts` — add attendees from phone contacts (NOT `@capacitor/contacts`)

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_VISION_API_KEY` (server-side only)

## OCR Route (`src/app/api/ocr/route.ts`)
- POST — accepts `{ image: base64string }`
- Calls Google Vision DOCUMENT_TEXT_DETECTION
- On error returns `{ error, visionStatus, visionStatusText, detail }` so client can see upstream HTTP code
- Parses receipt text: handles price-on-same-line and price-on-next-line formats, explodes quantities

## Current Status
- Auth complete
- App shell complete (home, profile, bottom nav, saved groups)
- Groups flow complete (create, edit, save toggle, member management)
- New split flow complete (3-step, receipt upload)
- OCR complete (Google Vision, two-line parsing, quantity explosion)
- Item assignment UI complete (assign, assign-by-line, equal split, merge attendees)
- Extra charges complete (tip with % shortcuts, app fee with host/individual modes, service, custom)
- Results page and public share page built
- Deployed to Vercel at https://tabsplit-three.vercel.app
- Next: remove debug logs from NewSplitForm once Safari receipt detection confirmed, generate PWA PNG icons, full end-to-end mobile test
