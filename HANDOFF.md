# TabSplit — Session Handoff

## Session Date
2026-06-18 / 2026-06-19

## Completed This Session

### Security & Stability
- **Next.js 15.3.3 → 15.3.9** — patched security vulnerability flagged by Vercel on deploy
- **`crypto.randomUUID()` polyfill** — added `src/lib/uuid.ts` with `generateId()` fallback for older Safari; replaced all 6 occurrences across the codebase
- **Server actions body size limit** — raised to 10MB in `next.config.ts` to support receipt image uploads

### Bug Fixes
- **Hydration error on mobile** — `SplitList.tsx` `formatDate` used `Intl.DateTimeFormat` at render time causing server (UTC) / client (AEST) timezone mismatch; replaced with `ClientDate` component that defers formatting to `useEffect`
- **Safari file input detection** — `handleFileChange` in `NewSplitForm.tsx` now treats any file with a non-empty name as valid, even if `size === 0` (Safari behaviour); added detailed console logging to diagnose
- **OCR error visibility** — `/api/ocr` error response now includes `visionStatus` and `visionStatusText` so the upstream Google Vision HTTP code is visible to the client

### Mobile / PWA
- **Eruda mobile console** — injected via `next/script` (afterInteractive); shows on any hostname that isn't `localhost` OR includes `vercel.app`; gives a floating console panel on device for reading logs
- **Viewport fixes** — `html` changed to `h-dvh`, `body` to `h-full overflow-y-auto overscroll-none`; viewport meta updated with `maximumScale: 1`, `viewportFit: 'cover'`
- **globals.css cleanup** — removed `font-family: Arial` override that was shadowing Tailwind's font stack

### UI / Features
- **Step 3 button redesign** — separated into "Load file" (indigo, triggers file picker) and "Create Split" (emerald with checkmark, submits); they swap based on receipt state; was previously one button that toggled its label
- **SplitDetail button colours** — header action buttons now coloured: Assign (violet), Equal (sky), Finalise (emerald when all assigned, zinc when not)
- **Removed raw OCR panels** — removed both the collapsible "Raw OCR output" block in the no-items state and the side panel in the assignment UI; also removed `rawText`/`showRawText` state
- **Add Charge feature** — new `addLineItem` server action + "Add charge" bottom sheet in SplitDetail:
  - **Tip**: shows bill subtotal, quick % buttons (10/15/18/20%)
  - **App fee**: two payment modes — "Host paid total" (assign to all equally) vs "Per person" (exclude selected host from split item; item price = per-person × non-host count; host pays their share directly to provider)
  - **Service charge / Custom**: fixed amount with split-equally toggle
- **Vercel deployment** — project linked and deployed; all subsequent sessions can use `vercel --prod` to deploy

---

## Bugs / Issues Encountered

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Vercel "Vulnerable Next.js" error | Next.js 15.3.3 had security CVE | Upgraded to 15.3.9 |
| Safari button stays "Skip & Create" | File input on Safari returns File with `size=0`, was being treated as invalid | Added name-based fallback check in `handleFileChange` |
| Hydration error on mobile | `Intl.DateTimeFormat` called at SSR render time; server UTC ≠ client AEST | `ClientDate` component defers to `useEffect` |
| Local Windows build flaky | next-pwa + Next.js 15 + Windows has ENOENT errors on bracket-named dirs ([id], [token]) during "Collecting page data" phase — rotates randomly between pages | Vercel (Linux) builds reliably; push and let Vercel build; don't rely on local `npm run build` for final validation |
| `crypto.randomUUID` on older Safari | Safari < 15.4 doesn't support `crypto.randomUUID()` | `generateId()` polyfill in `src/lib/uuid.ts` |
| OCR errors hard to diagnose | Error response only included generic message | Added `visionStatus` + `visionStatusText` to error JSON |

---

## Next Steps (Pick Up From Here)

1. **Confirm Safari receipt detection working** — open the deployed app on an iPhone, go to New Split → Step 3, select a photo, check Eruda console for:
   - `handleFileChange: { name, size, type, lastModified }` — should show the file
   - `setReceipt called with: [filename] [size]` — should show the file
   - If both log correctly and "Create Split" still doesn't appear, there's a React state batching issue to investigate
   
2. **Remove debug console.logs from NewSplitForm** — once Safari receipt detection is confirmed working, clean up:
   - Line 37: `console.log('NewSplitForm render ...')`
   - Line 68: `console.log('handleFileChange:', ...)`
   - Line 72: `console.log('setReceipt called with:', ...)`
   - Line 77: `console.log('handleSubmit fired')`
   - Line 284: `console.log('button clicked')` on the Create Split button

3. **Generate PWA PNG icons** — `public/icons/icon-192.png` and `public/icons/icon-512.png` still need to be generated from `public/icons/icon.svg`. The PWA manifest references them but they may not exist yet. Generate using any SVG→PNG tool or Inkscape/ImageMagick.

4. **Full end-to-end mobile test** — create a split, upload receipt, run OCR, assign items, add a tip and app fee, finalise, verify share link works. Pay attention to:
   - OCR accuracy on a real receipt photo
   - Whether the "Add charge" per-person app fee mode calculates correctly
   - Whether Finalise button correctly gates on all items being assigned

5. **Set Vercel environment variables** (if not done) — check Vercel dashboard → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GOOGLE_VISION_API_KEY`

---

## Open Questions / Decisions to Revisit

- **Eruda in production** — currently Eruda loads on ALL `*.vercel.app` URLs including the production alias `tabsplit-three.vercel.app`. Once debugging is complete, should restrict to non-production preview URLs only (or remove entirely). The condition in `layout.tsx` is the `window.location.hostname` check in the inline script.

- **OCR multi-line parsing** — original CLAUDE.md noted "fix OCR multi-line parsing (price on next line after description)" as a next step. Strategy 1 in `route.ts` handles this case, but real-world accuracy hasn't been confirmed on actual receipts yet.

- **App fee "host not in attendees" case** — when the organiser isn't listed as an attendee (possible if they didn't add themselves), the "Per person" mode host selector shows "Host not listed as attendee" and skips the host exclusion. This is correct behaviour but worth confirming with a real test.

- **PWA install prompt** — PWA manifest and service worker are set up but the install prompt UX hasn't been tested. On iOS it requires "Add to Home Screen" manually; on Android it may show a banner.

- **Capacitor native build** — the Codemagic CI/CD pipeline hasn't been touched this session. Capacitor plugins are installed but the native iOS/Android build hasn't been tested with the current codebase.
