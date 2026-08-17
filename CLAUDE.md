# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Frontend Design System

### Typography
- **Body**: Bricolage Grotesque
- **Display**: Fraunces
- **Mono**: JetBrains Mono
- Use weight extremes: 200 vs 800, not 400 vs 600
- Size jumps of 3x+, not 1.5x increments

### Color & Theme
- Single dominant color with one sharp accent
- All colors live in CSS variables in `src/index.css`
- Forbidden: purple-to-blue gradients on white backgrounds
- Commit to intentional, distinctive color choices

### Backgrounds
- Layered CSS gradients or geometric patterns over solid colors
- Hero sections must have atmospheric depth
- Avoid flat single-color backgrounds in prominent areas

### Motion
- CSS-only transitions for non-interactive elements
- Motion (Framer Motion) for React component animations
- One well-orchestrated page-load reveal beats scattered micro-interactions

### Components
- Always use shadcn/ui primitives where they exist (Button, Card, Dialog, Form)
- Never hand-roll components that exist in shadcn registry
- Tailwind classes only - no inline styles, no CSS modules
- Build with distinctive, intentional design, not generic AI aesthetics

## Commands

### Development

- `npm install` - Install dependencies
- `npm run dev` - Start Vite frontend and Express backend with live-reloading (localhost:3000)
- `npm run build` - Build React frontend and compile Express server for production
- `npm run start` - Start production server (output in `dist` folder)
- `npm run lint` - Run TypeScript type checking (`tsc --noEmit`)

### Testing

There are no test scripts configured in package.json. To add tests, use a testing framework like Jest or Vitest and add scripts to package.json.

## Architecture Overview

This is a real-time Q&A platform for live events with 4 user roles:

### Roles & Access

- **audience**: Can submit questions and upvote. Only has access to the Audience view.
- **moderator** (admin): Full access to all views including moderator dashboard, panel queue, and stage view. Moderators manage questions, categories, and event settings.
- **panel**: Limited access - primarily sees the panel queue and live answering interface.
- **stage**: Projected screen showing the currently answered question and queue.

### Data Flow

```
[Audience Mobile] → [Express SSE Server] → [All Connected Clients]
                                              │
                                              ▼
                                    [Projected Stage Display]
```

### Key Files

- `src/App.tsx` - Main router component that renders views based on `activeRole`
- `src/components/Header.tsx` - Top navigation with role-based tab visibility
- `src/components/AudienceView.tsx` - Question submission and live feed for audience
- `src/components/ModeratorView.tsx` - Moderator dashboard with question management
- `src/components/PanelView.tsx` - Panelist screen with timer and answering controls
- `src/components/StageView.tsx` - Projected stage display with question ticker
- `server.ts` - Express backend with SSE, API endpoints, and in-memory data store
- `src/useRealTimeQnA.ts` - Custom hook managing SSE connection, state, and API functions
- `src/types.ts` - TypeScript interfaces: Question, Category, ConferenceEvent, QuestionStatus, ViewRole

### Real-Time Communication

- Uses Server-Sent Events (SSE) via `/api/stream` for broadcasting updates
- Initial state loaded from `/api/state`
- All API endpoints prefixed with `/api/`

### Recent Changes

- Project renamed from `react-example` to `AudienceQueryLive`
- Added role-based access restrictions: non-admin users (audience) cannot navigate to moderator, panel, or stage screens without moderator privileges
- Header navigation tabs are conditionally shown/hidden based on `isAdmin` status