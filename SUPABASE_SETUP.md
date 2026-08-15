# Supabase Setup Guide

## Current Status

✅ **Complete:**
- All API endpoints updated to use Supabase
- Frontend `src/supabaseClient.ts` created for anonymous access
- Backend Supabase client initialized in `server.ts`
- TypeScript compilation passes with zero errors
- In-memory database removed (no data persistence across restarts)
- User isolation implemented (sessionId-based filtering)
- Device metadata capture implemented
- Schema file created (`schema.sql`)

🔧 **Next Steps (Manual):**

1. **Create a Supabase Project**
   - Go to https://supabase.com and sign up/log in
   - Click "New Project"
   - Choose a name, database password, and region
   - Wait for it to initialize

2. **Get Your Credentials**
   - In your Supabase dashboard, go to Settings > API
   - Copy these values:
     - **Project URL** (looks like `https://xxx.supabase.co`)
     - **Anon Key** (public key for frontend)
     - **Service Role Key** (secret key for backend - keep this safe!)

3. **Create `.env` File**
   Create or edit `.env` in the project root:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. **Run the Database Schema**
   - In Supabase, go to SQL Editor
   - Click "New Query"
   - Copy the entire contents of `schema.sql` from the project root
   - Paste it into the SQL editor
   - Click "Run" to execute

5. **Start the Application**
   ```bash
   npm install    # Install dependencies (includes @supabase/supabase-js)
   npm run dev    # Start dev server on http://localhost:3000
   ```

6. **Test the Application**
   - Open http://localhost:3000 in your browser
   - Submit a question (you should get a sessionId automatically)
   - Check that:
     - Question appears in your feed
     - Question persists in Supabase (check SQL Editor > Tables > questions)
     - Different sessionIds see only their own questions
   - Use the Moderator view to change question statuses

## Important Notes

### Environment Variables

- **VITE_SUPABASE_URL**: Frontend and backend both use this
- **VITE_SUPABASE_ANON_KEY**: Only frontend uses this (safe to expose)
- **SUPABASE_SERVICE_ROLE_KEY**: Backend only (server-side only, never send to frontend)

The `VITE_` prefix tells Vite to expose variables to the frontend build. The service role key has NO `VITE_` prefix, so it stays server-side only.

### User Isolation

The application uses `session_id` (stored in localStorage) for user identification:
- No login required for audience members
- Each user gets a unique sessionId on first visit
- RLS policies in Supabase restrict SELECT/UPDATE to own sessionId
- Moderators can bypass restrictions using the service role key

### Row Level Security (RLS)

The schema includes RLS policies that enforce:
- Users can only SELECT questions they created (sessionId match)
- Users can only UPDATE their own questions
- Admins (moderators) can SELECT/UPDATE all questions

To change admin checks, edit the RLS policies in Supabase > Authentication > Policies.

## Troubleshooting

**Error: "Missing Supabase credentials"**
- Check that `.env` file exists in the project root (not in src/)
- Verify all three variables are present and non-empty
- Make sure there are no extra spaces or quotes

**Questions don't persist**
- Check that schema.sql ran successfully in Supabase SQL Editor
- Verify the `questions` table exists: Supabase > Tables > questions
- Check browser console for API errors (F12 > Console)

**RLS "403 Forbidden" errors**
- This happens if RLS is too restrictive
- In Supabase > Authentication > Policies, verify the `session_id` condition
- Temporarily disable RLS for testing: Supabase > Auth > RLS Toggle (off)

**CORS errors**
- In Supabase > API Settings > CORS, add `http://localhost:3000` if needed

## File Reference

- **`server.ts`**: Express backend with all Supabase endpoints
- **`src/supabaseClient.ts`**: Frontend Supabase client (anon key)
- **`supabase-admin.ts`**: Backend Supabase admin client (service role key)
- **`schema.sql`**: Complete database schema (tables, RLS, seed data)
- **`src/useRealTimeQnA.ts`**: React hook managing SSE and API calls
