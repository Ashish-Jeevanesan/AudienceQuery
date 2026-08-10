import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Question, Category, ConferenceEvent, QuestionStatus } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database State
let categories: Category[] = [
  { id: 'cat-1', name: 'AI & Innovation', color: 'indigo', description: 'AI agents, LLM tech, and future roadmap' },
  { id: 'cat-2', name: 'Product Strategy', color: 'emerald', description: 'Product roadmap, feature prioritization, and growth' },
  { id: 'cat-3', name: 'Engineering & Scale', color: 'amber', description: 'Architecture, performance, security, and cloud infrastructure' },
  { id: 'cat-4', name: 'Business & Operations', color: 'rose', description: 'Monetization, hiring, culture, and market strategy' },
  { id: 'cat-5', name: 'Open Floor Q&A', color: 'sky', description: 'General questions and open discussion topics' }
];

let conferenceEvent: ConferenceEvent = {
  title: 'TechFuture Summit 2026',
  subtitle: 'Keynote & Leadership Panel Live Q&A',
  joinCode: 'TF2026',
  allowAnonymous: true,
  allowUpvotes: true,
  isAcceptingQuestions: true
};

let questions: Question[] = [
  {
    id: 'q-101',
    text: 'How will autonomous AI agents transform software engineering workflows over the next 2-3 years?',
    authorName: 'Sarah Lin',
    isAnonymous: false,
    categoryId: 'cat-1',
    categoryName: 'AI & Innovation',
    status: 'answering',
    upvotes: 24,
    upvotedBy: ['session-demo-1'],
    isPriority: true,
    moderatorNotes: 'Great opener question for panelist David',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    answeringStartedAt: new Date(Date.now() - 2 * 60000).toISOString()
  },
  {
    id: 'q-102',
    text: 'What are the main security and compliance considerations when deploying multi-agent LLMs in enterprise cloud environments?',
    authorName: 'Marcus Vance',
    isAnonymous: false,
    categoryId: 'cat-3',
    categoryName: 'Engineering & Scale',
    status: 'pushed',
    upvotes: 18,
    upvotedBy: [],
    isPriority: true,
    moderatorNotes: 'Pushed to panel for cybersecurity focus',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString()
  },
  {
    id: 'q-103',
    text: 'What strategies do you recommend for balancing rapid AI feature releases with software stability and code quality?',
    authorName: 'Anonymous Attendee',
    isAnonymous: true,
    categoryId: 'cat-2',
    categoryName: 'Product Strategy',
    status: 'pushed',
    upvotes: 15,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 10 * 60000).toISOString()
  },
  {
    id: 'q-104',
    text: 'Can the panel share key metrics or KPIs used to measure return on investment for generative AI initiatives?',
    authorName: 'Elena Rostova',
    isAnonymous: false,
    categoryId: 'cat-4',
    categoryName: 'Business & Operations',
    status: 'approved',
    upvotes: 11,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 8 * 60000).toISOString()
  },
  {
    id: 'q-105',
    text: 'Will edge computing replace centralized cloud servers for latency-critical real-time applications?',
    authorName: 'Anonymous Attendee',
    isAnonymous: true,
    categoryId: 'cat-3',
    categoryName: 'Engineering & Scale',
    status: 'pending',
    upvotes: 7,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 4 * 60000).toISOString()
  },
  {
    id: 'q-106',
    text: 'How do you foster developer culture and retain top engineering talent during rapid company scaling?',
    authorName: 'Jason K.',
    isAnonymous: false,
    categoryId: 'cat-4',
    categoryName: 'Business & Operations',
    status: 'answered',
    upvotes: 19,
    upvotedBy: [],
    isPriority: false,
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    answeredAt: new Date(Date.now() - 16 * 60000).toISOString()
  }
];

// Server-Sent Events (SSE) Client Connections
let clients: express.Response[] = [];

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

// SSE Stream Setup
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

// REST APIs
app.get('/api/state', (req, res) => {
  res.json({ questions, categories, conferenceEvent });
});

// Submit Question (Audience)
app.post('/api/questions', (req, res) => {
  const { text, authorName, isAnonymous, categoryId, sessionId } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Question text is required' });
  }

  if (!conferenceEvent.isAcceptingQuestions) {
    return res.status(403).json({ error: 'Question submission is currently paused by event moderators' });
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

// Upvote Question
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

// Change Question Status (Moderator or Panelist)
app.patch('/api/questions/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, moderatorNotes } = req.body as { status: QuestionStatus; moderatorNotes?: string };

  const q = questions.find(item => item.id === id);
  if (!q) {
    return res.status(404).json({ error: 'Question not found' });
  }

  // If changing to 'answering', demote any currently answering question to 'answered' or 'pushed'
  if (status === 'answering') {
    questions.forEach(item => {
      if (item.status === 'answering' && item.id !== id) {
        item.status = 'answered';
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

// Edit Question Details (Moderator)
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

// Delete Question (Moderator)
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

// Category Management
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

// Update Event Settings
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

// Reset / Seed Sample Data
app.post('/api/reset', (req, res) => {
  questions = [
    {
      id: 'q-101',
      text: 'How will autonomous AI agents transform software engineering workflows over the next 2-3 years?',
      authorName: 'Sarah Lin',
      isAnonymous: false,
      categoryId: 'cat-1',
      categoryName: 'AI & Innovation',
      status: 'answering',
      upvotes: 24,
      upvotedBy: ['session-demo-1'],
      isPriority: true,
      moderatorNotes: 'Great opener question for panelist David',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      answeringStartedAt: new Date(Date.now() - 2 * 60000).toISOString()
    },
    {
      id: 'q-102',
      text: 'What are the main security and compliance considerations when deploying multi-agent LLMs in enterprise cloud environments?',
      authorName: 'Marcus Vance',
      isAnonymous: false,
      categoryId: 'cat-3',
      categoryName: 'Engineering & Scale',
      status: 'pushed',
      upvotes: 18,
      upvotedBy: [],
      isPriority: true,
      moderatorNotes: 'Pushed to panel for cybersecurity focus',
      createdAt: new Date(Date.now() - 12 * 60000).toISOString()
    },
    {
      id: 'q-103',
      text: 'What strategies do you recommend for balancing rapid AI feature releases with software stability and code quality?',
      authorName: 'Anonymous Attendee',
      isAnonymous: true,
      categoryId: 'cat-2',
      categoryName: 'Product Strategy',
      status: 'pushed',
      upvotes: 15,
      upvotedBy: [],
      isPriority: false,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString()
    },
    {
      id: 'q-104',
      text: 'Can the panel share key metrics or KPIs used to measure return on investment for generative AI initiatives?',
      authorName: 'Elena Rostova',
      isAnonymous: false,
      categoryId: 'cat-4',
      categoryName: 'Business & Operations',
      status: 'approved',
      upvotes: 11,
      upvotedBy: [],
      isPriority: false,
      createdAt: new Date(Date.now() - 8 * 60000).toISOString()
    }
  ];

  broadcastStateUpdate('reset');
  res.json({ success: true, questions });
});

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
    console.log(`Conference Q&A Real-time Server running on http://localhost:${PORT}`);
  });
}

startServer();
