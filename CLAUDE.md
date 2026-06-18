@AGENTS.md

# TabSplit

## Project Overview
Receipt splitting mobile app for dining groups. One organiser scans/uploads a receipt, assigns line items to attendees, and everyone sees what they owe. No payment processing — just the split calculation and shareable results.

## Tech Stack
- Next.js 15.3.3 App Router, TypeScript, Tailwind CSS (downgraded from 16 due to server action issues with Turbopack)
- Supabase (database, auth, storage)
- Capacitor (iOS + Android wrapper)
- Codemagic (CI/CD)
- Google Vision API (OCR for receipt scanning)

## Key Conventions
- Australian spelling in all copy (organiser, colour, etc.)
- One step at a time
- Full file rewrites only — no partial edits
- PowerShell for all file operations
- 95% confidence before making code changes
- Never ask Tony to manually edit files

## Project Structure
- `/src/app` — App Router pages and layouts
- `/src/components` — Reusable UI components
- `/src/lib` — Supabase client, utilities
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
2. Organiser uploads receipt photo or selects from camera roll
3. Google Vision OCR parses line items — quantities exploded into individual rows
4. Organiser assigns items to attendees (tap to assign, batch assign, or equal split)
5. Optionally merge attendees into a group (e.g. couples)
6. Finalise split — each person sees their total via shareable link

## Capacitor Plugins
- `@capacitor/camera` — receipt photo and camera roll access
- `@capacitor-community/contacts` — add attendees from phone contacts

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_VISION_API_KEY` (server-side only)

## Current Status
- Auth complete (email + password)
- App shell complete (home, profile, bottom nav, saved groups section)
- Groups flow complete (create, edit, save toggle, member management with international phone + email)
- New split flow complete (3-step form, group pre-population, receipt upload)
- OCR complete (Google Vision API, two-line format parsing, quantity explosion)
- Item assignment UI built (assign, equal split, merge attendees, finalise)
- Results page and public share page built
- Next step: test full end-to-end flow and fix OCR multi-line parsing (price on next line after description)
