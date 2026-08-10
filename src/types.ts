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
  /** The total number of upvotes the question has received. */
  upvotes: number;
  /** A list of unique session IDs that have upvoted this question to prevent duplicate votes. */
  upvotedBy: string[];
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
  /** The session ID of the user who submitted the question. */
  submissionSessionId?: string;
}

/**
 * Interface representing a topic category for questions.
 */
export interface Category {
  /** A unique identifier for the category (e.g., 'cat-1'). */
  id: string;
  /** The display name of the category (e.g., 'Parenting & Faith'). */
  name: string;
  /** A color name (e.g., from Tailwind CSS) used for theming. */
  color: string;
  /** A short description of the category's topic. */
  description?: string;
}

/**
 * Interface representing the overall conference event details.
 */
export interface ConferenceEvent {
  /** The main title of the event. */
  title: string;
  /** A subtitle for the event or the specific session. */
  subtitle: string;
  /** A short, memorable code for joining the event Q&A. */
  joinCode: string;
  /** If true, users can submit questions anonymously. */
  allowAnonymous: boolean;
  /** If true, users can upvote questions. */
  allowUpvotes: boolean;
  /** If false, new question submissions are blocked by the server. */
  isAcceptingQuestions: boolean;
}

/**
 * Defines the different user interface views available in the application.
 */
export type ViewRole = 'audience' | 'moderator' | 'panel' | 'stage';
