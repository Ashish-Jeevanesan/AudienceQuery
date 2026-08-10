/**
 * @file server.ts
 * @description This file sets up an Express.js server for a real-time Q&A application.
 * It uses Server-Sent Events (SSE) for broadcasting updates and manages an in-memory "database"
 * for questions, categories, and event details. It also includes a Vite middleware for development.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { Question, Category, ConferenceEvent, QuestionStatus } from './src/types';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- In-Memory Database State ---

/**
 * @type {Category[]}
 * @description In-memory storage for conference topic categories.
 */
let categories: Category[] = [
  { id: 'cat-1', name: 'Parenting & Faith', color: 'indigo', description: 'Guidance on raising children in a Christian household.' },
  { id: 'cat-2', name: 'Marriage & Spirituality', color: 'emerald', description: 'Strengthening the spiritual bond between spouses.' },
  { id: 'cat-3', name: 'Youth & Purpose', color: 'amber', description: 'Helping young individuals find their purpose in Christ.' },
  { id: 'cat-4', name: 'Biblical Studies', color: 'rose', description: 'Deep dives into scripture and its application in daily life.' },
  { id: 'cat-5', name: 'Open Discussion', color: 'sky', description: 'General questions and open discussion topics.' }
];

/**
 * @type {ConferenceEvent}
 * @description In-memory storage for the main conference event details.
 */
let conferenceEvent: ConferenceEvent = {
  title: 'To Live is for Christ',
  subtitle: 'Christian Family Conference 2026',
  joinCode: 'LIVE4C',
  allowAnonymous: true,
  allowUpvotes: true,
  isAcceptingQuestions: true
};

/**
 * @type {Question[]}
 * @description In-memory storage for audience questions.
 */
let questions: Question[] = [
  {
    id: 'q-101',
    text: 'How can we effectively teach our young children about the concept of grace in a way they can understand?',
    authorName: 'Maria S.',
    isAnonymous: false,
    categoryId: 'cat-1',
    categoryName: 'Parenting & Faith',
    status: 'answering',
    upvotes: 24,
    upvotedBy: ['session-demo-1'],
    isPriority: true,
    moderatorNotes: 'Excellent opening question for Pastor John.',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    answeringStartedAt: new Date(Date.now() - 2 * 60000).toISOString()
  },
  {
    id: 'q-102',
    text: 'What are some practical daily habits my spouse and I can adopt to keep God at the center of our marriage?',
    authorName: 'David & Emily',
    isAnonymous: false,
    categoryId: 'cat-2',
    categoryName: 'Marriage & Spirituality',
    status: 'pushed',
    upvotes: 18,
    upvotedBy: [],
    isPriority: true,
    moderatorNotes: 'Push to panel for the marriage segment.',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString()
  },
  {
    id: 'q-103',
    text: 'My teenager is questioning their faith. How can I support them without being judgmental or pushing them away?',
    authorName: 'Anonymous',
    isAnonymous: true,
    categoryId: 'cat-3',
    categoryName: 'Youth & Purpose',
    status: 'pushed',
    upvotes: 15,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString()
  },
  {
    id: 'q-104',
    text: 'Can the panel explain the historical context of the book of Romans and its primary message for us today?',
    authorName: 'Frank T.',
    isAnonymous: false,
    categoryId: 'cat-4',
    categoryName: 'Biblical Studies',
    status: 'approved',
    upvotes: 11,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 8 * 60000).toISOString()
  },
  {
    id: 'q-105',
    text: 'What does it mean to "die to self" in our daily lives as parents, spouses, and professionals?',
    authorName: 'Anonymous',
    isAnonymous: true,
    categoryId: 'cat-5',
    categoryName: 'Open Discussion',
    status: 'pending',
    upvotes: 7,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 4 * 60000).toISOString()
  }
];


// --- Server-Sent Events (SSE) Logic ---

/**
 * @type {express.Response[]}
 * @description A list of all currently connected SSE clients (browsers).
 */
let clients: express.Response[] = [];

/**
 * Broadcasts the latest state to all connected SSE clients.
 * @param {string} type - The type of event that occurred (e.g., 'question:created').
 * @param {any} [data] - Optional data associated with the event.
 */
function broadcastStateUpdate(type: string, data?: any) {
  const payload = JSON.stringify({
    type,
    data,
    state: { questions, categories, conferenceEvent },
    timestamp: new Date().toISOString()
  });

  clients.forEach(client => {
    client.write(`data: ${payload}\n\n`);
  });
}

// --- API Endpoints ---

/**
 * @route GET /api/stream
 * @description Establishes an SSE connection. The client receives a full state dump immediately
 * and subsequent updates as they happen.
 */
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial full state immediately
  res.write(`data: ${JSON.stringify({
    type: 'init',
    state: { questions, categories, conferenceEvent },
    timestamp: new Date().toISOString()
  })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

/**
 * @route GET /api/state
 * @description Retrieves a snapshot of the current application state.
 */
app.get('/api/state', (req, res) => {
  res.json({ questions, categories, conferenceEvent });
});

/**
 * @route POST /api/questions
 * @description Submits a new question from an audience member.
 */
app.post('/api/questions', (req, res) => {
  const { text, authorName, isAnonymous, categoryId, sessionId } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Question text is required' });
  }

  if (!conferenceEvent.isAcceptingQuestions) {
    return res.status(403).json({ error: 'Question submission is currently paused.' });
  }

  const category = categories.find(c => c.id === categoryId) || categories[0];

  const newQuestion: Question = {
    id: `q-${Date.now()}`,
    text: text.trim(),
    authorName: isAnonymous ? 'Anonymous Attendee' : (authorName?.trim() || 'Attendee'),
    isAnonymous: !!isAnonymous,
    categoryId: category.id,
    categoryName: category.name,
    status: 'pending',
    upvotes: 0,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date().toISOString(),
    submissionSessionId: sessionId
  };

  questions.unshift(newQuestion);
  broadcastStateUpdate('question:created', newQuestion);

  res.status(201).json(newQuestion);
});

/**
 * @route POST /api/questions/:id/upvote
 * @description Toggles an upvote for a specific question.
 */
app.post('/api/questions/:id/upvote', (req, res) => {
  const { id } = req.params;
  const { sessionId } = req.body;

  const q = questions.find(item => item.id === id);
  if (!q) {
    return res.status(404).json({ error: 'Question not found' });
  }

  if (sessionId && q.upvotedBy.includes(sessionId)) {
    // Toggle remove upvote
    q.upvotedBy = q.upvotedBy.filter(s => s !== sessionId);
    q.upvotes = Math.max(0, q.upvotes - 1);
  } else {
    // Add upvote
    q.upvotes += 1;
    if (sessionId) {
      q.upvotedBy.push(sessionId);
    }
  }

  broadcastStateUpdate('question:upvoted', q);
  res.json(q);
});

/**
 * @route PATCH /api/questions/:id/status
 * @description Updates the status of a question (e.g., from 'pending' to 'pushed').
 * Handles logic for ensuring only one question is 'answering' at a time.
 */
app.patch('/api/questions/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, moderatorNotes } = req.body as { status: QuestionStatus; moderatorNotes?: string };

  const q = questions.find(item => item.id === id);
  if (!q) {
    return res.status(404).json({ error: 'Question not found' });
  }

  // If changing to 'answering', demote any currently answering question
  if (status === 'answering') {
    questions.forEach(item => {
      if (item.status === 'answering' && item.id !== id) {
        item.status = 'answered'; // Or 'pushed' depending on desired logic
        item.answeredAt = new Date().toISOString();
      }
    });
    q.answeringStartedAt = new Date().toISOString();
  } else if (status === 'answered') {
    q.answeredAt = new Date().toISOString();
  }

  q.status = status;
  if (moderatorNotes !== undefined) {
    q.moderatorNotes = moderatorNotes;
  }

  broadcastStateUpdate('question:status_changed', q);
  res.json(q);
});

/**
 * @route PATCH /api/questions/:id
 * @description Allows a moderator to edit the details of a question.
 */
app.patch('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const { text, categoryId, isPriority, moderatorNotes } = req.body;

  const q = questions.find(item => item.id === id);
  if (!q) {
    return res.status(404).json({ error: 'Question not found' });
  }

  if (text !== undefined) q.text = text.trim();
  if (categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      q.categoryId = cat.id;
      q.categoryName = cat.name;
    }
  }
  if (isPriority !== undefined) q.isPriority = !!isPriority;
  if (moderatorNotes !== undefined) q.moderatorNotes = moderatorNotes;

  broadcastStateUpdate('question:updated', q);
  res.json(q);
});

/**
 * @route DELETE /api/questions/:id
 * @description Allows a moderator to delete a question.
 */
app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const index = questions.findIndex(q => q.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Question not found' });
  }

  const deleted = questions.splice(index, 1)[0];
  broadcastStateUpdate('question:deleted', deleted);
  res.json({ success: true, deletedId: id });
});

/**
 * @route POST /api/categories
 * @description Allows a moderator to add a new category.
 */
app.post('/api/categories', (req, res) => {
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    color: color || 'sky',
    description: description || ''
  };

  categories.push(newCat);
  broadcastStateUpdate('category:created', newCat);
  res.status(201).json(newCat);
});

/**
 * @route PATCH /api/event
 * @description Updates general conference settings.
 */
app.patch('/api/event', (req, res) => {
  const { title, subtitle, isAcceptingQuestions, allowAnonymous, allowUpvotes } = req.body;
  if (title !== undefined) conferenceEvent.title = title;
  if (subtitle !== undefined) conferenceEvent.subtitle = subtitle;
  if (isAcceptingQuestions !== undefined) conferenceEvent.isAcceptingQuestions = isAcceptingQuestions;
  if (allowAnonymous !== undefined) conferenceEvent.allowAnonymous = allowAnonymous;
  if (allowUpvotes !== undefined) conferenceEvent.allowUpvotes = allowUpvotes;

  broadcastStateUpdate('event:updated', conferenceEvent);
  res.json(conferenceEvent);
});

/**
 * @route POST /api/reset
 * @description Resets the in-memory data to the original sample set.
 */
app.post('/api/reset', (req, res) => {
    // This function body can be used to re-seed the original data if needed.
    // For now, we'll just send success.
    broadcastStateUpdate('reset');
    res.json({ success: true });
});


// --- Server Initialization ---

/**
 * Starts the Express server.
 * In development, it uses Vite's middleware for hot-reloading the frontend.
 * In production, it serves the static built files from the 'dist' directory.
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Conference Q&A Server running on http://localhost:${PORT}`);
  });
}

startServer();
