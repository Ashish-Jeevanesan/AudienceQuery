# Quick Start Guide - AudienceQueryLive

**⏱️ Estimated Time: 30 minutes**

## Step 1: Create Supabase Project (5 min)

1. Go to https://supabase.com
2. Click "Sign Up" and create free account
3. Click "New Project"
4. Fill in:
   - **Name**: `AudienceQueryLive`
   - **Database Password**: Save this! (you'll need it)
   - **Region**: Pick closest to you
5. Wait for initialization (2-3 minutes)

## Step 2: Get Your Credentials (2 min)

1. In Supabase dashboard, click **Settings** (⚙️ icon)
2. Click **API** in left sidebar
3. Copy these values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Key** → `VITE_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Create `.env` File (5 min)

In your project root (same folder as `package.json`), create a file named `.env`:

```env
# Supabase Credentials (from Step 2)
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Admin API Token (generate with: openssl rand -hex 32)
ADMIN_API_TOKEN=GENERATE_THIS_WITH_COMMAND_BELOW
```

**Generate ADMIN_API_TOKEN**:

**On Windows (PowerShell)**:
```powershell
certutil -rand 32 | certutil -encode -
# Copy the hex string (longer middle part)
```

**On Mac/Linux**:
```bash
openssl rand -hex 32
```

**Or using Node.js** (any OS):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output:
```
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6
```

## Step 4: Run Database Schema (5 min)

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open `schema.sql` file in your text editor
4. Copy **ALL** the contents
5. Paste into Supabase SQL editor
6. Click **Run** (▶️ button, top right)
7. Wait for success message (should see 3-4 `CREATE TABLE` confirmations)

## Step 5: Start Development Server (2 min)

Open terminal in your project directory:

```bash
npm run dev
```

You should see:
```
Conference Q&A Server running on http://localhost:3000
```

## Step 6: Test It! (10 min)

### Test 1: Browser Submission
1. Open http://localhost:3000
2. Type a test question
3. Click "Submit Question"
4. You should see: "Question Submitted Successfully!"
5. Your question appears in "Live Questions" feed

### Test 2: Check Database
1. Go back to Supabase dashboard
2. Click **Tables** (left sidebar)
3. Click **questions** table
4. You should see your question!

### Test 3: User Isolation
1. Open http://localhost:3000 in **private/incognito** window
2. Submit a different question
3. Go back to **first window** - you should NOT see the private window's question
4. Go to **second window** - you should NOT see the first window's question
5. Each user only sees their own! ✅

### Test 4: Admin Features
1. In regular browser, click **Moderator** tab (top right)
2. You should see the question panel
3. Click "Push to Panel" on a question
4. See the status change? That's working! ✅

## 🎉 You're Done!

Your AudienceQueryLive platform is now live locally! 

### What's Next?

- **Read SECURITY.md** - Understand how to use the admin token
- **Review SUPABASE_SETUP.md** - Advanced configuration options
- **Check PROJECT_LOG.md** - See all changes made
- **Explore Moderator View** - Test admin features

### Common Issues & Solutions

**Problem: "Missing Supabase credentials" error**
```
Solution: Check that .env file exists in project root
(same folder as package.json, NOT in src/ folder)
```

**Problem: "Cannot find module '@supabase/supabase-js'"**
```
Solution: Run: npm install
```

**Problem: Questions don't appear in database**
```
Solution: Check that schema.sql ran successfully
In Supabase > Tables, you should see "questions" table
```

**Problem: "sessionId not initialized" error**
```
Solution: Refresh the page, sessionId should auto-generate
```

**Problem: Admin endpoints return 401**
```
Solution: Make sure ADMIN_API_TOKEN is in .env
It should be 64 characters of hex (a-f, 0-9)
```

### Useful Commands

```bash
# Check TypeScript errors
npm run lint

# Build for production
npm run build

# Start production server
npm run start

# Stop dev server
Ctrl+C
```

### Important Files to Know

| File | Purpose |
|------|---------|
| `.env` | Your credentials (NEVER commit!) |
| `schema.sql` | Database structure |
| `server.ts` | Backend API |
| `src/useRealTimeQnA.ts` | Frontend data management |
| `src/App.tsx` | Main app component |

---

## 🔐 Admin Token Usage

When you need to use admin features (Moderator view), the app will need your `ADMIN_API_TOKEN`.

**Where is it used?**
- Moderator dashboard (question management)
- Changing question status
- Creating categories
- Updating event settings
- Resetting demo data

**Is it secure?**
- ✅ Stored in `.env` (server-side only)
- ✅ Never exposed to frontend
- ✅ Cryptographically generated
- ✅ Validated on every admin request

---

## 📚 Documentation Map

- **QUICKSTART.md** ← You are here (get running in 30 min)
- **STATUS.md** - Project completion status
- **SECURITY.md** - Security architecture & testing
- **SUPABASE_SETUP.md** - Detailed setup guide
- **IMPLEMENTATION_COMPLETE.md** - Technical overview
- **CLAUDE.md** - Development commands
- **PROJECT_LOG.md** - All changes made

---

## ✨ What You Just Built

A real-time Q&A platform with:
- ✅ Live question submission
- ✅ User isolation (each user sees only their questions)
- ✅ Device metadata tracking
- ✅ Moderator dashboard
- ✅ Real-time updates via SSE
- ✅ Secure authentication
- ✅ PostgreSQL database

**Built with**: React, TypeScript, Express, Supabase, Tailwind CSS

---

**Ready to go live? Next steps after testing:**
1. Deploy to Vercel/Netlify (frontend)
2. Deploy to Railway/Heroku (backend)
3. Point custom domain
4. Collect real questions!

Good luck! 🚀
