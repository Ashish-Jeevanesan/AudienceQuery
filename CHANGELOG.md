# Changelog

All notable changes to this project will be documented in this file.

## [2026-08-21] - Multi-Event Support, Role-Based Users (Admin/Moderator/Panelist/Stage)

- **Database**: Replaced the single-row `conference_events` design with a real `events` table — each event owns its own full config (title, subtitle, join code, allow-anonymous, accepting-questions), and exactly one can be `is_live` at a time, enforced by a partial unique index plus an atomic `activate_event()` Postgres function (two independent client-side updates would risk leaving zero or two live events on a crash or a race between two moderators). Added `user_roles` (`admin`/`moderator`/`panelist`/`stage`) and `users` tables, auto-populated by an `on_auth_user_created` trigger whenever an account is created in Supabase Auth. `questions.event_id` was added and backfilled: a "Legacy Event" was created from the old `conference_events` row, marked live, and every existing question assigned to it so nothing was orphaned. `schema.sql` (and the one-off `SECURITY_PATCH.sql`) moved into a new `database/` folder.
- **Roles are now real, restricted logins**: Panelist and Stage accounts sign in and are locked to their one screen (no tab switcher at all) instead of being tabs any admin/moderator could open. Admin and Moderator keep full access to all views, with one addition: only Admin can manage other users' roles. Access control now reads from the `users` table (the source of truth) via a new `requireRole()` server middleware, instead of Supabase Auth's `app_metadata.role`.
- **Live-event enforcement**: Question submission now attaches the currently live event's ID server-side (400s if no event is live). "Push to Panel" is blocked — both in the UI and enforced again on the server — for any question that doesn't belong to the live event, so moderators can review older events' questions without being able to send them to the panel.
- **New Moderator UI**: "Manage Events" (create events, switch which one is live, edit any event's config), "Manage Users" (admin-only; edit username/role), and the old "Conference Settings" drawer slimmed down to "Manage Categories". Added a Live/All-events filter next to the existing category filter, and a badge on questions from a non-live event.
- **Header/login generalized**: the login modal now works for any of the 4 roles (not just moderator-labeled), a Sign-out button was added (there wasn't one before), and Panel/Stage tabs are hidden entirely for logged-out visitors instead of shown-but-disabled.
- **Security hardening** (caught by review before shipping): the new-signup trigger was reading role from `raw_user_meta_data`, which a client can set on itself at signup — fixed to only ever read the service-role-only `raw_app_meta_data`, since the original version would have let anyone self-promote to admin. The `events` table's RLS policy was default-permissive (copied from the older `categories`/`conference_events` style) — fixed to default-deny, since a permissive policy there would let anyone with the public anon key flip the live event directly from a browser. `activate_event()` was also hardened to validate the target event exists before touching anything, after an nonexistent-ID test call during verification revealed it would otherwise silently deactivate the real live event.

## [2026-08-19] - Full Light/Dark Theming for Moderator, Panel and Stage; "AQ" Branding; Stage Responsiveness

- **Removed leftover vote UI**: Cleaned up upvote badges, the "Sort by Votes" option, and `ThumbsUp` icons that were still showing in `ModeratorView`, `PanelView`, and `StageView` even though voting had already been removed from the data model. Also removed a phantom `/upvote` endpoint and a "Community Upvoting" bullet from `README.md` that no longer matched the actual code.
- **Full light/dark QA pass, logged in as admin, across all 4 views** surfaced and fixed several real bugs:
    - `App.tsx`'s root wrapper was hardcoded `bg-slate-100 text-slate-900` instead of theme tokens, so the page canvas never actually went dark.
    - `Footer.tsx` used undefined Tailwind classes (`bg-secondary`, `from/to-brand-primary`) that compiled to nothing, rendering as an unstyled, illegible white block in dark mode.
    - `ModeratorView.tsx`'s metrics cards, filter bar, question cards, edit modal, and settings drawer were hardcoded light-only. Migrated to the existing CSS-variable token system (`bg-surface`, `text-primary/secondary/muted`, `border-divider`).
    - `ModeratorView.tsx`'s category badges (e.g. "Biblical Studies") used light-mode-only colors (dark text on a near-transparent tint) that were nearly illegible on a dark card. Added theme-aware `.cat-badge-*` classes to `index.css` (light + `[data-theme="dark"]` variants) and reused them everywhere a topic color badge appears.
    - The **Moderator Control Panel** top banner was still a permanently hardcoded dark strip regardless of the theme toggle -- converted it (and the Submissions OPEN/PAUSED pill) to the same token system so it now blends with the rest of the page in both themes.
- **Panel and Stage now follow the single global theme toggle instead of their own local switches**:
    - `PanelView.tsx` was always solid dark (a `highContrastMode` toggle just swapped `bg-black` for `bg-slate-950`, both dark) -- removed that toggle entirely and migrated every hardcoded color to the shared theme tokens, so it now responds to the navbar's theme switch like every other view.
    - `StageView.tsx` had its own separate "☀️ Light Mode / 🌙 Dark Mode" button, but only the outer page wrapper actually respected it -- the QR banner, timer badge, category badges, the main "now answering" card, the empty state, and the footer ticker were all hardcoded dark regardless of the toggle. Removed the local toggle and converted every section to the global tokens.
    - Added a shared `.live-spotlight-card` class (a theme-aware indigo-tinted gradient) in `index.css`, used by both Panel's and Stage's "now answering" highlight card so that distinctive visual survives the token conversion in both themes.
- **Stage header responsiveness fix**: the header row used `justify-between` across three flex children (branding / QR banner / controls). Removing Stage's local theme toggle shrank the controls section, which shifted the QR/join-code banner off-center under `justify-between`'s equal-gap math -- and the banner was entirely hidden below the `lg` breakpoint (`hidden lg:flex`), losing the join code for anyone viewing Stage under 1024px wide. Restructured into two rows (branding+fullscreen on top, QR banner in its own `flex justify-center` row below) so it's always centered regardless of sibling widths and never hidden. Verified at 1920px, at the 1024px `lg` boundary, and at a true 390px mobile width (via an iframe, since this environment's browser window won't actually resize below its current size) -- centered and overflow-free at all three.
- **Branding**: Changed the header and footer logo badge from "Q" to "AQ" (tightened tracking to fit both sizes cleanly).

## [2026-08-19] - Stage QR Code, Workflow Reference Pages, Shared Loading State, Favicon

- **Stage QR Code**: The "QR code" on the Stage screen was a decorative icon glyph, not an actual scannable code. Replaced it with a real one (`qrcode.react`) pointing at the site's root URL — the app has no per-role URL routing, so a fresh visit already lands on the audience/question-submission view by default.
- **Workflow Reference Pages**: Added two standalone, light-mode-only HTML pages documenting the system architecture and the question lifecycle as hand-drawn SVG diagrams, served as static files under `public/ref/` at:
    - System Architecture — https://audience-query.vercel.app/ref/tech-diag
    - Question Lifecycle — https://audience-query.vercel.app/ref/user-diag
- **Follow-up Routing Fix**: `PATCH /api/questions/:id/status` (and every other `/api/*` route with 2+ path segments) was 404ing at the Vercel platform level — the `api/[...slug].ts` catch-all filename only matched a single path segment in production, so nested routes never reached the Express app at all. Renamed the function to `api/index.ts` and added an explicit `"/api/:path* -> /api"` rewrite in `vercel.json` so every request under `/api/` reaches the same function regardless of depth or method, instead of depending on catch-all filename semantics that don't behave as expected outside a Next.js project.
- **Shared Loading State**: Audited every DB-backed action (submit question, approve/reject/push, edit, delete, add category, event settings, start/mark answered, reset demo) — most fired the request with zero visual feedback and didn't wait for it to resolve. Added a single tracked-action wrapper in `useRealTimeQnA` (exposed as `isBusy`) and a full-screen `GlobalLoader` overlay shown for the duration of any in-flight action, with the UI refreshed from the server before the loader hides so the update is guaranteed to be on screen, not just assumed via SSE.
    - The moderator Edit Question modal now stays open until the save actually resolves and shows the error in place on failure, instead of closing immediately regardless of outcome.
    - The Event Title/Subtitle fields switched from saving on every keystroke to saving on blur, since autosave-per-character would have fired the loader on every character typed.
- **Favicon**: Added a vector favicon (`public/favicon.svg`) — an indigo badge with "AQ" in white, matching the existing brand color used for the header's "Q" logo.

## [2026-08-19] - Fixed Local Dev Environment and Production Deployment on Vercel

- **Local Dev Fix**: `@supabase/supabase-js` was listed in `package.json` but never actually installed; `npm install` resolved it. Supabase's realtime client requires native `WebSocket` (Node >=22), but the machine was running Node 20.18.1 — switched the active version to the already-installed Node 22.23.1 via `nvm`.
- **Vercel Deployment — Root Cause**: `vercel.json` had never been committed, so the live Vercel deployment was serving a stale, frontend-only build; every `/api/*` request 404'd, which is what caused "Session not initialized" errors when submitting a question.
- **Rebuilt Vercel Deployment Config**:
    - Replaced the legacy `builds`/`routes` config (which requires a pre-built `dist/` to already exist as source, which it doesn't since it's gitignored) with a modern zero-config serverless function at `api/[...slug].ts` that re-exports the Express app.
    - `server.ts` now guards `app.listen()` behind `!process.env.VERCEL` and exports the `app` for reuse by the serverless function.
    - Added an SPA fallback rewrite in `vercel.json`, scoped with a negative lookahead so it doesn't shadow `/api/*` requests.
- **Serverless Compatibility Fixes**:
    - `server.ts` statically imported `vite` (used only for local dev's hot-reload middleware) at module scope, which risked bloating/breaking the serverless function bundle; changed to a dynamic `import('vite')` inside the dev-only branch so it's never touched in production.
    - `src/logger.ts` unconditionally wrote log files to disk; Vercel's serverless filesystem is read-only outside `/tmp`. The logger now skips file I/O when `process.env.VERCEL` is set and relies on console output (which Vercel captures as function logs).
    - Both `api/[...slug].ts` and `server.ts` used extensionless relative imports (e.g. `'../server'`, `'./src/logger'`), which TypeScript's local bundler-mode resolution accepts but Vercel's strict Node ESM runtime does not — added explicit `.js` extensions to fix `ERR_MODULE_NOT_FOUND` crashes.
    - Removed an unnecessary `engines.node: "22.x"` pin from `package.json` — Vercel's project default (Node 24.x) already satisfies the `>=22` requirement, and the pin was only forcing a downgrade and producing a build warning.
- **Verified**: Full flow (session creation → state fetch → question submission) confirmed working end-to-end against the live `https://audience-query.vercel.app` deployment.

## [2026-08-10] - Thematic Refactor and Project Setup

- **Refactored Theme**: Updated the entire application theme from a "Tech Conference" to a "Christian Family Conference" on the topic "To Live is for Christ". This includes all sample data in `server.ts` (questions, categories) and UI text in the frontend components.
- **Added Comments**: Added JSDoc-style comments to all major files, including `server.ts`, React components (`.tsx`), and type definitions (`types.ts`) to improve code clarity and maintainability.
- **Configuration Management**:
    - Added `.env.example` to provide a template for environment variables.
    - Ensured `.env` is included in `.gitignore` to prevent committing secrets.
    - Integrated `dotenv` into `server.ts` to load environment variables.
- **Project Conventions**: Created a `GEMINI.md` file to store project-specific rules and guidelines for future development.
- **Added Changelog**: This `CHANGELOG.md` file was created to track development progress.
