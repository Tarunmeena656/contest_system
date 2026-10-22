export type Role = 'user' | 'vip' | 'admin';
export type ContestStatus = 'upcoming' | 'active' | 'ended';
export type AccessLevel = 'normal' | 'vip';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type QuestionType = 'single-select' | 'multi-select' | 'true-false';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  access_level: AccessLevel;
  difficulty: Difficulty;
  tags: string[];
  prize: string | null;
  start_time: string;
  end_time: string;
  finalized_at: string | null;
  winner_user_id: string | null;
  status: ContestStatus;
  can_participate: boolean;
}

export interface Participation {
  id: string;
  contest_id: string;
  user_id: string;
  joined_at: string;
  submitted_at: string | null;
  score: number | null;
}

export interface ContestDetail extends Contest {
  question_count: number;
  participant_count: number;
  my_participation: Participation | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  points: number;
  position: number;
  // only present for admins
  correct_answers?: string[];
  explanation?: string | null;
}

export interface Answer {
  questionId: string;
  selected: string[];
}

export interface SubmitResult {
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  rank: number;
  submittedAt: string;
}

export interface AnswerReview {
  question_id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correct_answers: string[];
  explanation: string | null;
  points: number;
  selected: string[];
  is_correct: boolean;
}

export interface ContestResult {
  contest: Contest;
  participation: Participation;
  answers: AnswerReview[];
}

export interface LeaderboardRow {
  user_id: string;
  name: string;
  score: number;
  submitted_at: string;
  rank: number;
}

export interface Leaderboard extends Page<LeaderboardRow> {
  contest: Pick<Contest, 'id' | 'name' | 'status' | 'prize' | 'finalized_at' | 'winner_user_id'>;
  me: LeaderboardRow | null;
}

export interface OverallRow {
  user_id: string;
  name: string;
  total_score: number;
  contests_played: number;
  prizes_won: number;
  rank: number;
}

export interface Overall extends Page<OverallRow> {
  me: OverallRow | null;
}

export interface HistoryItem {
  contest_id: string;
  name: string;
  access_level: AccessLevel;
  prize: string | null;
  start_time: string;
  end_time: string;
  finalized_at: string | null;
  winner_user_id: string | null;
  score: number;
  joined_at: string;
  submitted_at: string;
  rank: number;
  question_count: number;
  status: ContestStatus;
  won: boolean;
}

export interface InProgressItem {
  contest_id: string;
  name: string;
  access_level: AccessLevel;
  prize: string | null;
  start_time: string;
  end_time: string;
  joined_at: string;
  question_count: number;
  status: ContestStatus;
  missed: boolean;
}

export interface Prize {
  id: string;
  prize: string;
  awarded_at: string;
  contest_id: string;
  contest_name: string;
}

export interface SearchFilters {
  status: ContestStatus | null;
  accessLevel: AccessLevel | null;
  difficulty: Difficulty | null;
  topics: string[];
  hasPrize: boolean | null;
  startsWithinDays: number | null;
}

export interface SearchResult extends Page<Contest> {
  query: string;
  filters: SearchFilters;
  cached: boolean;
  relaxed: boolean;
}

export interface GeneratedQuestion {
  type: QuestionType;
  text: string;
  options: string[];
  correct_answers: string[];
  explanation: string | null;
  points: number;
  difficulty?: string;
  topic?: string;
}

export interface GenerateResponse {
  provider: string;
  requested: number;
  generated: number;
  rejected: number;
  saved: boolean;
  questions: GeneratedQuestion[];
}

export interface FinalizeResult {
  contestId: string;
  winnerUserId: string | null;
  prize: string | null;
}
