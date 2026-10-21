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
  | 'rejected'   // Rejected by a moderator and hidden from view.
  | 'answer_later'; // Set aside by a moderator to answer personally (e.g. over WhatsApp) instead of live on panel. Stays in this lane -- see Question.moderatorAnswered -- rather than moving on once answered.

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
  /** The moderator's drafted/sent answer, written in the Answer Later tab for questions answered personally (e.g. shared over WhatsApp) instead of live on panel. */
  moderatorAnswerText?: string;
  /** Optional AI-suggested Hindi translation of moderatorAnswerText -- an editable suggestion, same pattern as event titles/category names. Included in the Share message when present. */
  moderatorAnswerTextHi?: string;
  /** Optional AI-suggested Odia translation of moderatorAnswerText -- same pattern as moderatorAnswerTextHi. */
  moderatorAnswerTextOr?: string;
  /** True once the moderator has marked this answer_later question as answered -- the question stays in the Answer Later tab either way, just with this flag set, rather than moving on. */
  moderatorAnswered?: boolean;
  /** ISO 8601 timestamp of when moderatorAnswered was set true. */
  moderatorAnsweredAt?: string;
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
 * The 5 valid application roles, sourced from the `users`/`user_roles`
 * tables (the source of truth for access control -- not Supabase Auth's
 * `app_metadata`, which is vestigial). `management` is scoped to the
 * complaints dashboard at /dashboard only (alongside `admin`) -- it grants
 * no access to the Moderator/Panel/Stage views.
 */
export type UserRole = 'admin' | 'moderator' | 'panelist' | 'stage' | 'management';

/**
 * A row from the `users` table, mirroring a Supabase Auth account, with
 * every role it holds attached. A user can hold any combination of roles
 * (e.g. `['moderator', 'management']`) -- `roles` is never empty for an
 * account that can sign in at all.
 */
export interface AppUser {
  id: string;
  email: string;
  username: string;
  roles: UserRole[];
}

/**
 * Defines the different user interface views available in the application.
 */
export type ViewRole = 'audience' | 'moderator' | 'panel' | 'stage';

/**
 * The server's response to a successful `POST /api/complaints` submission.
 * `ticketNumber` is the only handle the anonymous submitter gets to
 * reference this complaint later -- there is no login and no "my
 * complaints" view, only the public status lookup.
 */
export interface ComplaintSubmissionResult {
  id: string;
  ticketNumber: string;
  createdAt: string;
}

/**
 * A complaint's lifecycle: submitted (open) -> categorized (acknowledged,
 * the first workflow action in the /dashboard management view) ->
 * assigned (given a free-text assignee name) -> resolved (marked done,
 * with an optional photo as proof).
 */
export type ComplaintStatus = 'open' | 'acknowledged' | 'assigned' | 'resolved';

/**
 * Fixed set of complaint categories, chosen at the acknowledgment step.
 * Deliberately a hardcoded list rather than a managed table -- there is no
 * UI (yet) for editing categories, and a fixed list is enough for the
 * dashboard's "simple but effective" workflow.
 */
export const COMPLAINT_CATEGORIES = [
  { value: 'facilities', label: 'Facilities & Maintenance' },
  { value: 'audio_visual', label: 'Audio/Visual & Sound' },
  { value: 'security', label: 'Security & Safety' },
  { value: 'cleanliness', label: 'Cleanliness & Sanitation' },
  { value: 'medical', label: 'Medical / First Aid' },
  { value: 'staff_behavior', label: 'Staff Behavior' },
  { value: 'other', label: 'Other' }
] as const;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number]['value'];

/**
 * A complaint row as seen by the /dashboard management view (admin or
 * management role required server-side).
 */
export interface Complaint {
  id: string;
  ticketNumber: string;
  name: string;
  phone: string;
  complaintText: string;
  status: ComplaintStatus;
  category?: ComplaintCategory;
  assignedTo?: string;
  resolutionPhotoUrl?: string;
  createdAt: string;
  acknowledgedAt?: string;
  assignedAt?: string;
  resolvedAt?: string;
}

/**
 * The public, unauthenticated response to `GET /api/complaints/lookup` --
 * deliberately narrower than `Complaint` (no raw phone/name echoed back,
 * since the caller already knows them -- they had to supply the phone to
 * get this response in the first place).
 */
export interface ComplaintLookupResult {
  ticketNumber: string;
  status: ComplaintStatus;
  category?: ComplaintCategory;
  assignedTo?: string;
  resolutionPhotoUrl?: string;
  createdAt: string;
  acknowledgedAt?: string;
  assignedAt?: string;
  resolvedAt?: string;
}

/**
 * A voting's lifecycle: draft (being set up, not shown at /vote yet) ->
 * open (live at /vote and /vote/stage) -> closed (no longer accepting
 * votes, but its final tally stays visible).
 */
export type VotingStatus = 'draft' | 'open' | 'closed';

/** One selectable choice within a voting (e.g. one participant's song). */
export interface VotingOption {
  id: string;
  label: string;
  photoUrl?: string;
  displayOrder: number;
  /** Only present where the caller is allowed to see live counts (Manage Votings, Monitor, /vote/stage, and the public tally endpoint) -- never echoed back from vote submission itself. */
  voteCount?: number;
}

/**
 * A voting question as seen by admin (Manage Votings) and moderator/admin
 * (Monitor). The public /vote and /vote/stage views get a narrower shape --
 * see `PublicVoting`.
 */
export interface Voting {
  id: string;
  question: string;
  questionHi?: string;
  questionOr?: string;
  status: VotingStatus;
  options: VotingOption[];
  totalVotes: number;
  createdAt: string;
  openedAt?: string;
  closedAt?: string;
}

/**
 * The public, unauthenticated shape of an open voting -- used by /vote (to
 * show the question/options) and /vote/stage (to show live counts). Carries
 * no admin-only fields (no suspicion data, no draft/closed votings).
 */
export interface PublicVoting {
  id: string;
  question: string;
  questionHi?: string;
  questionOr?: string;
  options: VotingOption[];
}

/**
 * One cast vote as seen in the Monitor & Flag screen (admin or moderator).
 * Never exposed publicly -- voter PII (name/phone/DOB/IP) only ever reaches
 * staff reviewing for fraud.
 */
export interface VoteRecord {
  id: string;
  votingId: string;
  optionId: string;
  optionLabel: string;
  voterName: string;
  voterPhone: string;
  voterDob: string;
  deviceFingerprint: string;
  ipAddress?: string;
  suspicionFlags: string[];
  isInvalidated: boolean;
  invalidatedReason?: string;
  invalidatedBy?: string;
  createdAt: string;
}
