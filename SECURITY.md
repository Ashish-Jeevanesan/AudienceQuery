# Security Implementation Guide

## Overview

This document outlines the security measures implemented in the AudienceQueryLive application to protect against common vulnerabilities.

## Security Issues & Fixes

### 1. ✅ Destructive Operation Without Authentication

**Issue**: `/api/reset` endpoint could delete all data without any authentication.

**Fix Implemented**:
- Added `requireAdmin` middleware to `/api/reset`
- Requires `Authorization: Bearer <admin-token>` header
- Token checked against `ADMIN_API_TOKEN` environment variable

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/reset \
  -H "Authorization: Bearer your-admin-token-here"
```

### 2. ✅ User Isolation Bypass (IDOR)

**Issue**: `GET /api/state` returned ALL questions to all users, bypassing user isolation.

**Fix Implemented**:
- Added required `sessionId` query parameter to `/api/state`
- Server-side filtering: `.eq('session_id', sessionId)`
- RLS policies in Supabase enforce additional protection

**How It Works**:
```
User A submits question → sessionId = "sess-abc123"
                       ↓
GET /api/state?sessionId=sess-abc123 → Returns ONLY User A's questions

User B submits question → sessionId = "sess-xyz789"
                       ↓
GET /api/state?sessionId=sess-xyz789 → Returns ONLY User B's questions
```

### 3. ✅ Session ID Spoofing

**Issue**: Client could submit any sessionId and impersonate another user.

**Fix Implemented**:
- `POST /api/session` generates cryptographically secure server-side sessionId
- SessionIds start with `sess-` followed by 32 random hex characters
- Frontend calls `/api/session` on first visit (cached in localStorage)
- SessionId validation: `^sess-[a-f0-9]+$` regex check

**Architecture**:
```
First Visit:
1. Frontend starts, checks localStorage for sessionId
2. None found → calls POST /api/session
3. Server generates: "sess-a1b2c3d4e5f6...xyz"
4. Frontend stores in localStorage
5. All API calls include this sessionId

Subsequent Visits:
1. Frontend checks localStorage
2. Finds cached sessionId → uses it
3. No new session generated (reduces server load)
```

### 4. ✅ Missing Authorization on Moderator Mutations

**Issue**: Any client could change question statuses, create categories, or modify settings.

**Fix Implemented**:
- Added `requireAdmin` middleware to all moderator endpoints:
  - `PATCH /api/questions/:id/status`
  - `PATCH /api/questions/:id`
  - `DELETE /api/questions/:id`
  - `POST /api/categories`
  - `PATCH /api/event`
  - `POST /api/reset`

**Moderator Request Format**:
```bash
curl -X PATCH http://localhost:3000/api/questions/q-123/status \
  -H "Authorization: Bearer your-admin-token-here" \
  -H "Content-Type: application/json" \
  -d '{"status": "answering"}'
```

## Configuration

### 1. Admin Token Setup

Create/edit `.env` file in project root:

```env
# Supabase Credentials
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin API Token (for moderator operations)
ADMIN_API_TOKEN=your-secure-admin-token-here
```

**Generate a Strong Admin Token**:
```bash
# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL:
openssl rand -hex 32

# Output example:
# a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6
```

### 2. Frontend Configuration

The frontend automatically:
- Calls `POST /api/session` on first visit to get a sessionId
- Caches sessionId in `localStorage.qna_session_id`
- Passes sessionId to `GET /api/state` as a query parameter

**Development Note**: If you clear localStorage, a new sessionId will be generated.

### 3. Moderator Authentication

Moderators must include the admin token in request headers:

```javascript
// Example: Update question status from frontend
const adminToken = prompt('Enter admin token:');
const response = await fetch('/api/questions/q-123/status', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'answering' })
});
```

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│              AudienceQueryLive Security Model             │
└──────────────────────────────────────────────────────────┘

┌─ Audience Users ─────────────────────────────────────────┐
│                                                           │
│  1. First Visit:                                         │
│     POST /api/session → Server generates sessionId       │
│     └─→ cached in localStorage                           │
│                                                           │
│  2. Submit Question:                                     │
│     POST /api/questions                                  │
│     ├─ sessionId (from localStorage)                     │
│     ├─ device metadata                                   │
│     └─ network metadata                                  │
│                                                           │
│  3. View Questions:                                      │
│     GET /api/state?sessionId=sess-abc...                 │
│     └─→ Returns ONLY own questions                       │
└──────────────────────────────────────────────────────────┘

┌─ Moderators ─────────────────────────────────────────────┐
│                                                           │
│  All Admin Endpoints Require:                            │
│  Authorization: Bearer <admin-token>                     │
│                                                           │
│  Protected Endpoints:                                    │
│  ├─ PATCH /api/questions/:id/status                      │
│  ├─ PATCH /api/questions/:id                             │
│  ├─ DELETE /api/questions/:id                            │
│  ├─ POST /api/categories                                 │
│  ├─ PATCH /api/event                                     │
│  └─ POST /api/reset (DESTRUCTIVE)                        │
└──────────────────────────────────────────────────────────┘

┌─ Database Layer (Supabase) ──────────────────────────────┐
│                                                           │
│  Row-Level Security (RLS):                               │
│  - Questions table:                                      │
│    ├─ Users see only: session_id = their_session_id     │
│    └─ Admins see: all rows (service_role key)            │
│                                                           │
│  Service Role Key:                                       │
│  - Used ONLY on backend                                  │
│  - Never exposed to frontend                             │
│  - Bypasses RLS for admin operations                     │
└──────────────────────────────────────────────────────────┘
```

## Testing Security

### Test 1: Session ID Generation

```bash
# Request 1: Generate a new session
curl -X POST http://localhost:3000/api/session
# Response: {"sessionId": "sess-a1b2c3d4..."}

# Request 2: Use this sessionId to get state
curl "http://localhost:3000/api/state?sessionId=sess-a1b2c3d4..."
# Response: {"questions": [...only own questions...], ...}
```

### Test 2: Session Isolation

```bash
# Browser A: Get questions with sessionId=sess-aaa111
GET /api/state?sessionId=sess-aaa111
# Returns: [question from user A]

# Browser B: Get questions with sessionId=sess-bbb222
GET /api/state?sessionId=sess-bbb222
# Returns: [question from user B]

# Attacker tries: Get user A's questions
GET /api/state?sessionId=sess-aaa111
# But they don't have user A's sessionId (it's secure, server-generated)
# And even if they guess it, RLS policies block unauthorized access
```

### Test 3: Unauthorized Moderator Action

```bash
# Without admin token:
curl -X PATCH http://localhost:3000/api/questions/q-123/status \
  -H "Content-Type: application/json" \
  -d '{"status": "answering"}'
# Response: 401 Unauthorized: Invalid or missing admin token

# With wrong admin token:
curl -X PATCH http://localhost:3000/api/questions/q-123/status \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"status": "answering"}'
# Response: 401 Unauthorized: Invalid or missing admin token

# With correct admin token:
curl -X PATCH http://localhost:3000/api/questions/q-123/status \
  -H "Authorization: Bearer a1b2c3d4..." \
  -H "Content-Type: application/json" \
  -d '{"status": "answering"}'
# Response: 200 {"id": "q-123", "status": "answering", ...}
```

### Test 4: Destructive Operation Protection

```bash
# Without token: /api/reset is protected
curl -X POST http://localhost:3000/api/reset
# Response: 401 Unauthorized

# With token:
curl -X POST http://localhost:3000/api/reset \
  -H "Authorization: Bearer a1b2c3d4..."
# Response: 200 {"success": true, "message": "Database has been reset..."}
```

## Environment Variables Reference

| Variable | Purpose | Exposed to Frontend? | Required? |
|----------|---------|---------------------|-----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Yes | ✅ Required |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | ✅ Yes | ✅ Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | ❌ No (server only) | ✅ Required |
| `ADMIN_API_TOKEN` | Moderator auth token | ❌ No (server only) | ⚠️ Dev mode optional |

## Best Practices

### 1. Admin Token Management

✅ **DO**:
- Generate a cryptographically secure token
- Store in `.env` (never commit to git)
- Rotate periodically
- Use different tokens for different environments
- Log admin actions in audit_log table

❌ **DON'T**:
- Use simple passwords like "admin123"
- Commit `.env` to version control
- Share tokens via email or chat
- Reuse tokens across environments
- Log tokens in console

### 2. Session ID Handling

✅ **DO**:
- Trust server-generated sessionIds
- Validate sessionId format on backend
- Enforce sessionId in RLS policies
- Cache in browser localStorage
- Regenerate if user logs out

❌ **DON'T**:
- Generate sessionIds on client
- Accept sessionId from request body without validation
- Expose sessionId in URLs (use query params for state calls only)
- Share sessionId across devices

### 3. Admin Operations

✅ **DO**:
- Require Authorization header for all admin endpoints
- Log who made changes and when (audit_log table)
- Have a confirmation step for destructive operations
- Rate-limit admin endpoints if possible
- Monitor for suspicious activity

❌ **DON'T**:
- Trust admin token from cookies alone
- Allow bulk deletions without confirmation
- Skip logging for "internal" operations
- Mix user and admin logic in same route handlers

## Future Security Improvements

1. **JWT-Based Authentication**
   - Replace bearer tokens with signed JWTs
   - Include user roles in JWT claims
   - Add token expiration

2. **CSRF Protection**
   - Implement SameSite cookies
   - Add CSRF token to state-changing requests

3. **Rate Limiting**
   - Limit /api/questions submissions per sessionId
   - Limit /api/reset to once per hour with confirmation

4. **Audit Logging**
   - Log all moderator actions (already in schema)
   - Create dashboard to review logs

5. **API Key Rotation**
   - Implement key rotation mechanism
   - Warn when keys are stale

6. **Encryption**
   - Encrypt sensitive network metadata before storage
   - Use HTTPS only (already required in production)

## Compliance Notes

- **GDPR**: User data (questions) can be deleted by users
- **CCPA**: Questions are tied to sessionId, not personally identifiable
- **Data Retention**: Consider auto-deleting old questions

---

**Last Updated**: 2026-08-16  
**Status**: ✅ Security hardened, ready for production setup
