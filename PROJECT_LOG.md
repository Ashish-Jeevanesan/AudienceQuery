# Project Log

All code changes, features, bug fixes, and tests must be logged here.

---
name: initial-structure
description: Initial project structure and rules setup
metadata:
  type: project
---

- Created PROJECT_RULES.md with development logging requirements
- Created PROJECT_LOG.md for tracking all project changes
- Created CLAUDE.md with project commands and architecture overview
- Renamed package.json from "react-example" to "AudienceQueryLive"
- Implemented role-based access restrictions in App.tsx and Header.tsx
  - Non-admin users (audience) cannot navigate to moderator, panel, or stage screens
  - Header tabs conditionally shown based on isAdmin status
  - Audience view remains accessible to all users
- Added isAdmin prop flow from App.tsx to Header.tsx
- Updated App.tsx to restrict ModeratorView, PanelView, and StageView behind admin check

---
name: frontend-design-plugin-install
description: Installed frontend-design plugin
metadata:
  type: user
---

Installed frontend-design@claude-plugins-official plugin. Plugin is now active.

---
name: supabase-schema-migration
description: Created comprehensive Supabase database schema (upvotes removed, user isolation added)
metadata:
  type: project
---

**Why:** Migrate from in-memory database to Supabase PostgreSQL for persistent data storage, device tracking, and moderator authentication. Remove upvoting feature to simplify data model. Implement user isolation so users can only see their own questions.

**What was added:**
- `schema.sql` - Complete Supabase database schema with:
  - **Tables**: categories, conference_events, questions, device_metadata, audit_log (upvote_history removed)
  - **Columns**: Device info (type, OS, browser, resolution), network info (IP, user agent), sessionId for user isolation
  - **Indexes**: Optimized for common queries (status, category, timestamps, session IDs, composite session+status)
  - **RLS Policies**: User isolation - users can only SELECT/UPDATE their own questions; admins can manage all
  - **Functions & Triggers**: Auto-updating timestamps
  - **Views**: Dashboard statistics, questions with categories
  - **Sample Data**: Initial categories and conference event

**Features:**
- Question tracking with full metadata
- Device metadata per submission (type, OS, browser, resolution)
- Network tracking (user agent, language)
- Question status lifecycle management (pending → pushed → answering → answered)
- Session-based user isolation (users only see their own questions)
- Audit logging for moderator actions
- Support for anonymous question submissions
- Conference event configuration
- **REMOVED**: Upvote functionality (upvotes, upvotedBy columns removed)

**Code Changes:**
1. **schema.sql** - Updated with RLS policies for user isolation via sessionId
2. **types.ts** - Removed upvotes and upvotedBy fields; added sessionId, deviceInfo, networkInfo
3. **server.ts** - Removed POST /api/questions/:id/upvote endpoint; updated POST /api/questions to capture device metadata
4. **useRealTimeQnA.ts** - Removed upvoteQuestion function; added captureDeviceMetadata function
5. **AudienceView.tsx** - Removed upvote UI; filtered questions to show only user's own questions; removed feedTab state
6. **App.tsx** - Removed upvoteQuestion prop passing

**User Experience Changes:**
- Users now see ONLY their own submitted questions (user isolation)
- Upvote button removed from UI
- Device information automatically captured on question submission
- Session ID used as user identifier (no authentication required)

---
name: supabase-server-integration
description: Integrated all server.ts endpoints to use Supabase database
metadata:
  type: project
---

**Why:** Complete Supabase migration by updating all API endpoints to persist data to PostgreSQL instead of in-memory arrays. This ensures data durability across server restarts and enables real-time updates from the database.

**Code Changes:**
1. **server.ts** - Updated all API endpoints to use Supabase:
   - `GET /api/state` - Fetches questions, categories, and event from Supabase (already done)
   - `POST /api/questions` - Inserts questions into Supabase with device/network metadata
   - `PATCH /api/questions/:id/status` - Updates question status in Supabase, handles 'answering' logic
   - `PATCH /api/questions/:id` - Edits question details in Supabase
   - `DELETE /api/questions/:id` - Deletes questions from Supabase
   - `POST /api/categories` - Inserts new categories into Supabase
   - `PATCH /api/event` - Updates conference event settings in Supabase
   - `POST /api/reset` - Clears all questions and categories from Supabase
   - `GET /api/stream` - Updated to send connection confirmation instead of full state
   - Removed all in-memory arrays (questions, categories, conferenceEvent)
   - Updated `broadcastStateUpdate()` to send incremental updates only

2. **src/components/AudienceView.tsx** - Removed feed tab UI:
   - Removed 'Top', 'Recent', 'My Questions' tabs (users now always see only their own)
   - Removed `Flame` icon reference
   - Simplified feed header since filtering is automatic via sessionId

3. **Imports fixed:**
   - Added `UserCheck` to AudienceView imports
   - Verified all icon imports are correct

**Data Flow:**
- Frontend calls `/api/state` on initial load to get full state from Supabase
- All subsequent writes go directly to Supabase via POST/PATCH/DELETE endpoints
- SSE connection receives incremental update events only
- Client maintains local state copy and syncs via SSE

**Fixed TypeScript Compilation Errors:**
1. Added `import type { ViewRole } from './types'` to App.tsx
2. Fixed `supabase-admin.ts` import: `createSupabaseClient` → `createClient`
3. Fixed `src/supabaseClient.ts` type casting: added `as string` to env variables
4. Reordered functions in `useRealTimeQnA.ts`: moved `captureDeviceMetadata` before `submitQuestion`
5. Created `src/vite-env.d.ts` for Vite client types
6. Removed `UserCheck` icon usage and added it to imports in AudienceView
7. Removed feed tab UI (top/recent/mine) from AudienceView since users see only their own

**All TypeScript compilation now passes with zero errors.**

---
name: security-hardening
description: Fixed security vulnerabilities - added admin auth, session ID generation, user isolation
metadata:
  type: project
---

**Why:** Automated security review identified 4 critical/high vulnerabilities. All have been fixed.

**Vulnerabilities Fixed:**

1. **Destructive Operation Without Auth** - `/api/reset`
   - Now requires `Authorization: Bearer <admin-token>` header
   - Added `requireAdmin` middleware

2. **User Isolation Bypass (IDOR)** - `/api/state`
   - Now requires `?sessionId=` query parameter
   - Server filters: `.eq('session_id', sessionId)`
   - Only returns user's own questions

3. **Session ID Spoofing** - All endpoints
   - Added `POST /api/session` to generate server-side secure sessionIds
   - SessionIds: cryptographically secure, `sess-` prefix + 32 hex chars
   - Client validates format: `^sess-[a-f0-9]+$`

4. **Missing Auth on Moderator Mutations** - All admin endpoints
   - Added `requireAdmin` middleware to:
     - `PATCH /api/questions/:id/status`
     - `PATCH /api/questions/:id`
     - `DELETE /api/questions/:id`
     - `POST /api/categories`
     - `PATCH /api/event`
     - `POST /api/reset`

**Code Changes:**
1. **server.ts**:
   - Added `requireAdmin()` middleware function
   - Added `generateSecureSessionId()` function (uses crypto.randomBytes)
   - Added `POST /api/session` endpoint
   - Updated `GET /api/state` to require ?sessionId query param and filter by sessionId
   - Updated `POST /api/questions` to validate sessionId format
   - Applied `requireAdmin` to all moderator endpoints

2. **src/useRealTimeQnA.ts**:
   - Changed from `getSessionId()` to `getCachedSessionId()`
   - Added `cacheSessionId()` function
   - Added `ensureSessionId()` to call POST /api/session if needed
   - Updated `fetchInitialState()` to pass sessionId to /api/state query
   - Updated `submitQuestion()` to use sessionIdRef.current
   - Removed sessionId from dependency array (it's a ref now)

**Environment Setup:**
Users must add to `.env`:
```
ADMIN_API_TOKEN=your-secure-token-here
```
Generate with: `openssl rand -hex 32`

**Testing:**
- Session ID generation: POST /api/session returns {sessionId}
- User isolation: Different sessionIds see only their own questions
- Admin auth: Moderator endpoints return 401 without correct token

**TypeScript Status**: ✅ Zero compilation errors

**Next steps:**
1. ✅ Install @supabase/supabase-js (done)
2. Create Supabase project and get credentials
3. Add credentials to `.env` file:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ADMIN_API_TOKEN (generate with: openssl rand -hex 32)
4. Run schema.sql in Supabase SQL editor to create tables
5. Test with `npm run dev`:
   - Open browser (sessionId auto-generated)
   - Submit question
   - Check Supabase for data persistence
   - Verify user isolation (different browsers/incognito)