/**
 * @file src/types.ts
 * @description This file contains all the core TypeScript types and interfaces
 * used throughout the application, defining the shape of data for questions,
 * categories, events, and other domain-specific entities.
 */

/**
 * Represents the lifecycle status of a question.
 */
export type QuestionStatus = 
  | 'pending'    // Submitted by audience, waiting for moderator review.
  | 'approved'   // Approved by moderator, in the public queue but not yet sent to the panel.
  | 'pushed'     // Pushed by a moderator from the bridge to the Panel members' live interface.
  | 'answering'  // Currently being answered live on stage.
  | 'answered'   // Marked as answered by the panel and moved to history.
  | 'rejected';  // Rejected by a moderator and hidden from view.

/**
 * Interface representing a single audience question.
 * IMPORTANT: Users can only see and access their own questions via RLS policies.
 */
export interface Question {
  /** A unique identifier for the question (e.g., 'q-123'). */
  id: string;
  /** The text content of the question. */
  text: string;
  /** The name of the person who submitted the question. Can be 'Anonymous'. */
  authorName: string;
  /** True if the question was submitted anonymously. */
  isAnonymous: boolean;
  /** The ID of the category this question belongs to (e.g., 'cat-1'). */
  categoryId: string;
  /** The display name of the category (denormalized for convenience). */
  categoryName: string;
  /** The current status in the question lifecycle. */
  status: QuestionStatus;
  /** The ID of the event this question belongs to. Only questions belonging to the live event can be pushed to the panel. */
  eventId: string;
  /** A flag set by moderators to pin a question to the top. */
  isPriority: boolean;
  /** Internal notes visible only to moderators. */
  moderatorNotes?: string;
  /** ISO 8601 timestamp of when the question was created. */
  createdAt: string;
  /** ISO 8601 timestamp of when the panel started answering this question. */
  answeringStartedAt?: string;
  /** ISO 8601 timestamp of when the question was marked as answered. */
  answeredAt?: string;
  /** The session ID of the user who submitted the question. Used for user isolation. */
  sessionId: string;
  /** Device information (type, OS, browser, resolution) for the device that submitted the question. */
  deviceInfo?: {
    deviceType: string;
    os: string;
    browser: string;
    screenResolution: string;
  };
  /** Network information (IP address, user agent) for the device that submitted the question. */
  networkInfo?: {
    ipAddress: string;
    userAgent: string;
  };
}

/**
 * Interface representing a topic category for questions.
 */
export interface Category {
  /** A unique identifier for the category (e.g., 'cat-1'). */
  id: string;
  /** The canonical display name of the category (e.g., 'Parenting & Faith'). Always present, used as the fallback when a translated name is missing. */
  name: string;
  /** Hindi translation of the name, entered by a moderator. Falls back to `name` when absent. */
  nameHi?: string;
  /** Odia translation of the name, entered by a moderator. Falls back to `name` when absent. */
  nameOr?: string;
  /** A color name (e.g., from Tailwind CSS) used for theming. */
  color: string;
  /** A short description of the category's topic. */
  description?: string;
}

/**
 * Interface representing the overall conference event details, as resolved
 * for whichever specific event the current view is showing (Multi-Event
 * Mode: identified by join code, e.g. via the `/e/:joinCode` route -- there
 * is no single "the live event" anymore). Kept as the shape every view
 * already expects (Audience/Panel/Stage).
 */
export interface ConferenceEvent {
  /** The unique identifier of this event. */
  id: string;
  /** The canonical (English) title of the event. Always present, used as the fallback when a translated title is missing. */
  title: string;
  /** Hindi translation of the title, optional; falls back to `title` when absent. */
  titleHi?: string;
  /** Odia translation of the title, optional; falls back to `title` when absent. */
  titleOr?: string;
  /** A subtitle for the event or the specific session. */
  subtitle: string;
  /** Hindi translation of the subtitle, optional; falls back to `subtitle` when absent. */
  subtitleHi?: string;
  /** Odia translation of the subtitle, optional; falls back to `subtitle` when absent. */
  subtitleOr?: string;
  /** A short, memorable code for joining the event Q&A. */
  joinCode: string;
  /** If true, users can submit questions anonymously. */
  allowAnonymous: boolean;
  /** If false, new question submissions are blocked by the server. */
  isAcceptingQuestions: boolean;
  /** ISO 8601 timestamp after which this event no longer accepts questions or appears in the open-events dropdown. Undefined means it never expires. */
  expiresAt?: string;
  /** Server-computed: true once `expiresAt` has passed. Blocks new submissions and dropdown visibility the same way a manually-paused event does, independent of `isAcceptingQuestions`. */
  isExpired: boolean;
  /** Public Storage URL of the event's logo. Undefined means fall back to the default "AQ" branding. */
  logoUrl?: string;
  /** Up to 3 public Storage URLs, in carousel display order. Empty/undefined means no hero banner carousel. */
  bannerUrls?: string[];
}

/**
 * The full shape of an event as seen in the admin/moderator "Manage Events"
 * list -- a superset covering every event, not just the live one. Fetched
 * only via the admin/moderator-gated `/api/events` endpoint, never from the
 * public `/api/state` snapshot (every event's join code lives here).
 */
export interface EventRecord extends ConferenceEvent {
  createdAt: string;
}

/**
 * The public, unauthenticated summary of one event currently accepting
 * questions -- exactly what `GET /api/events/open` returns, and exactly
 * what the "pick an event" dropdown needs to display and select an event.
 * Deliberately narrower than ConferenceEvent: no join-code-gated internals
 * like `allowAnonymous`/`isAcceptingQuestions` (every entry here is already
 * known to be accepting questions, by construction of the endpoint).
 */
export interface OpenEventSummary {
  id: string;
  title: string;
  titleHi?: string;
  titleOr?: string;
  subtitle: string;
  subtitleHi?: string;
  subtitleOr?: string;
  joinCode: string;
}

/**
 * The 4 valid application roles, sourced from the `users`/`user_roles`
 * tables (the source of truth for access control -- not Supabase Auth's
 * `app_metadata`, which is vestigial).
 */
export type UserRole = 'admin' | 'moderator' | 'panelist' | 'stage';

/**
 * A row from the `users` table, mirroring a Supabase Auth account with an
 * application role attached.
 */
export interface AppUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

/**
 * Defines the different user interface views available in the application.
 */
export type ViewRole = 'audience' | 'moderator' | 'panel' | 'stage';
