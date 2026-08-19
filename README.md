# AudienceQuery

A real-time, interactive Q&A platform designed for live events, conferences, and panels. It empowers audience members to submit questions, while giving moderators and panelists the tools to manage, prioritize, and display them seamlessly.

## System Architecture

```
[ Audience Mobile ] ────(Submit)────> [ Express SSE Server ] ──(Broadcast)──> [ Moderator Bridge ]
                                              │                                         │
                                              │                                  (Push to Panel)
                                              ▼                                         ▼
                                  [ Projected Stage Display ] <──(Live On-Stage)─── [ Panel Members ]
```

## Reference Diagrams

Visual references for how the system actually works, deployed alongside the app:

- [System Architecture](https://audience-query.vercel.app/ref/tech-diag) — where a request goes: browser → Vercel edge (static) / serverless function (API + SSE) → Supabase.
- [Question Lifecycle](https://audience-query.vercel.app/ref/user-diag) — who moves a question, and to where, across Audience → Moderator → Panel → Stage.

## Key Functional Views & Features

### 📱 Audience Submission Interface (`/audience`)
- **Mobile-Optimized Submission**: Audience members can submit questions with custom names or anonymously with custom category tags.
- **Live Status Badges**: Audience members track their submitted questions through stages: In Review → Pushed to Panel → Answering Live 🎙️ → Answered.

### 🛡️ Backend Moderator Bridge Dashboard (`/moderator`)
- **Command Central**: Bridges incoming audience questions and stage panelists.
- **Categorized Inbox**: Filter by Inbox Pending, Pushed to Panel, Approved Public Feed, Live/Answered, and Rejected.
- **One-Touch Actions**:
    - **Push to Panel**: Sends selected questions directly to the panel members' screen queue.
    - **Priority Star**: Pin urgent or high-value questions to top of queues.
    - **Edit & Refine**: Inline text editing, re-categorizing, and internal moderator notes.
- **Conference Settings**: Pause/resume question submissions and add custom event categories dynamically.

### 🎙️ Panel Members' Live Screen (`/panel`)
- **High-Legibility Stage View**: Designed for tablets/laptops on the panel desk with high-contrast text sizing.
- **Live Answering Control**: Click "Start Answering Live" to instantly feature a question on the main auditorium stage screen.
- **Live Timer**: Tracks elapsed answering time per question.
- **Mark as Completed**: One-click completion clearing the active stage display and moving the question to historical logs.

### 📺 Projected Stage Screen (`/stage`)
- **Widescreen Auditorium Projection**: High-impact stage view showing the currently active question in bold typography with speaker & category badges.
- **Upcoming Queue Ticker**: Displays upcoming panel questions waiting in line.
- **Audience Access Badge**: Displays the event join code and QR code overlay for easy seat scanning.
- **Presentation Mode**: Fullscreen support (F11) with dark/light stage lighting themes.

## Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Real-time Communication**: Server-Sent Events (SSE)
- **Styling**: `lucide-react` for icons, `motion` for animations.
- **Development**: `tsx` for live-reloading the backend, `esbuild` for production builds.

## Getting Started

### Prerequisites
- Node.js (v18 or later recommended)
- npm or yarn

### 1. Installation

Clone the repository and install the dependencies:
```bash
git clone <repository-url>
cd AudienceQuery
npm install
```

### 2. Running in Development Mode

This command starts the Vite frontend and the Express backend server with live-reloading.
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

### 3. Building for Production

This command builds the React frontend and compiles the Express server for production use.
```bash
npm run build
```
The output will be in the `dist` folder.

### 4. Running in Production Mode

This command starts the server using the pre-built files from the `dist` directory.
```bash
npm run start
```
The production application will be running at `http://localhost:3000`.

## Project Structure

```
.
├── dist/                # Production build output
├── src/
│   ├── components/      # React components for different views
│   ├── App.tsx          # Main React application component
│   ├── main.tsx         # React entry point
│   ├── types.ts         # TypeScript type definitions
│   └── useRealTimeQnA.ts # Custom hook for SSE connection
├── server.ts            # Express.js backend server logic
├── package.json         # Project dependencies and scripts
└── vite.config.ts       # Vite configuration
```

## API Endpoints

The core of the application is an Express server that provides a REST API and a Server-Sent Events (SSE) stream for real-time updates.

- `GET /api/stream`: Establishes an SSE connection to receive live state updates.
- `GET /api/state`: Retrieves the complete current state of questions, categories, and event settings.
- `POST /api/questions`: Submits a new question.
- `PATCH /api/questions/:id/status`: Updates the status of a question (e.g., 'pending', 'pushed', 'answering').
- `PATCH /api/questions/:id`: Edits the details of a question.
- `POST /api/reset`: Resets the in-memory data to a sample set (for demonstration purposes).

This project uses an in-memory "database", so all data will be reset if the server restarts.
