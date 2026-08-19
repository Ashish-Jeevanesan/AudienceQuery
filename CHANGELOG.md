# Changelog

All notable changes to this project will be documented in this file.

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
