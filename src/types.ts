export type QuestionStatus = 
  | 'pending'    // Submitted by audience, waiting for moderator review
  | 'approved'   // Approved by moderator, in audience public view
  | 'pushed'     // Pushed by moderator bridge to Panel members' interface
  | 'answering'  // Currently being answered live by panel (shown on stage)
  | 'answered'   // Marked as answered by panel
  | 'rejected';  // Rejected by moderator

export interface Question {
  id: string;
  text: string;
  authorName: string;
  isAnonymous: boolean;
  categoryId: string;
  categoryName: string;
  status: QuestionStatus;
  upvotes: number;
  upvotedBy: string[]; // session IDs that upvoted
  isPriority: boolean;
  moderatorNotes?: string;
  createdAt: string;
  answeringStartedAt?: string;
  answeredAt?: string;
  submissionSessionId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface ConferenceEvent {
  title: string;
  subtitle: string;
  joinCode: string;
  allowAnonymous: boolean;
  allowUpvotes: boolean;
  isAcceptingQuestions: boolean;
}

export type ViewRole = 'audience' | 'moderator' | 'panel' | 'stage';
