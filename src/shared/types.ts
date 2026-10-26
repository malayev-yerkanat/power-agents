export type AdapterKind = 'codex-cli' | 'claude-cli' | 'gemini-cli' | 'openai-api' | 'anthropic-api' | 'demo';
export interface Connection {
  id: string;
  name: string;
  kind: AdapterKind;
  available: boolean;
  detail: string;
  executable?: string;
}
export interface ModelOption { id: string; name: string }
export interface ModelCatalog {
  connectionId: string;
  models: ModelOption[];
  status: 'ready' | 'unavailable' | 'error';
  note: string;
}
export interface Member { id: string; name: string; connectionId: string; model: string; role: string }
export interface TaskSpec { id: string; title: string; description: string; assigneeId: string; dependsOn: string[] }
export interface TeamPlan { summary: string; successCriteria: string[]; roles: { memberId: string; role: string }[]; tasks: TaskSpec[] }
export type TaskStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed';
export interface TeamTask extends TaskSpec {
  status: TaskStatus; turns: number; output?: string; error?: string;
  /** Board facts the latest result relied on, with the version it saw. */
  usedFacts?: Record<string, number>;
}
export interface TeamMessage {
  id: string; fromId: string; toId: string; body: string;
  request: boolean; replyTo?: string; taskId?: string;
  status: 'queued' | 'delivered' | 'answered'; createdAt: string;
}
/** A value one participant owns (a price, a gram weight, a promo term) that everyone else reads instead of asking. */
export interface SharedFact { key: string; value: string; ownerId: string; version: number; updatedAt: string }
/** A file a task wrote in its folder, relative to that folder. */
export interface ArtifactFile { path: string; bytes: number }
export interface Artifact {
  id: string; title: string; body: string; authorId: string; taskId?: string; kind: 'work' | 'final' | 'review'; createdAt: string;
  files?: ArtifactFile[]; omittedFiles?: number;
}
export type RunStatus = 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
/** A provider call the platform started and has not yet seen finish. */
export interface InFlightCall { id: string; memberId: string; purpose: TurnPurpose; taskId?: string; requestId?: string; startedAt: string }
export interface Run {
  id: string; title: string; goal: string; status: RunStatus; members: Member[]; leaderId: string;
  plan?: TeamPlan; tasks: TeamTask[]; messages: TeamMessage[]; artifacts: Artifact[];
  sessions: Record<string, string>; turnCount: number; reviewRound: number;
  phase: 'plan' | 'tasks' | 'synthesize' | 'review' | 'done';
  facts?: SharedFact[];
  inFlight?: InFlightCall[];
  /** Calls a server restart cut off: their outcome is unknown, so they repeat only after the user confirms. */
  interrupted?: InFlightCall[];
  error?: string; createdAt: string; updatedAt: string; version: number;
  mode: 'live' | 'demo'; approvedAt?: string;
}
export interface RunEvent { id: number; runId: string; type: string; message: string; actorId?: string; createdAt: string }
export type RunSummary = Pick<Run, 'id' | 'title' | 'status' | 'mode' | 'createdAt' | 'updatedAt' | 'version'>;
export interface RunSummaryPage { runs: RunSummary[]; nextCursor?: string; totalRuns: number }
export interface EventHistoryPage { events: RunEvent[]; before?: number }
export interface RunDetail { run: Run; events: RunEvent[]; eventsBefore?: number }
export interface Bootstrap extends RunSummaryPage { connections: Connection[]; csrfToken: string; maxConcurrent: number; eventCursor: number }
export interface CreateRunInput { goal: string; members: Member[]; leaderId: string; mode: 'live' | 'demo' }
export type TurnPurpose = 'plan' | 'task' | 'reply' | 'synthesize' | 'review';
export interface TurnInput {
  runId: string; member: Member; connection: Connection; purpose: TurnPurpose;
  prompt: string; cwd: string; sessionId?: string; signal: AbortSignal;
  /** Task turns may edit files inside `cwd` only; every other turn reads. */
  writable?: boolean;
  /** Extra folders the turn may read, such as dependency results. */
  readDirs?: string[];
  onProgress: (text: string) => void;
}
export interface TurnResult { text: string; sessionId?: string }
export type TurnRunner = (input: TurnInput) => Promise<TurnResult>;
export interface AgentEnvelope {
  summary: string;
  status: 'done' | 'working' | 'waiting';
  messages: { toId: string; body: string; request: boolean; replyTo?: string }[];
  artifact?: { title: string; body: string };
  verdict?: 'pass' | 'changes_requested';
  /** Review only: the tasks whose owners must revise, with a concrete remark each. */
  revisions?: { taskId: string; remark: string }[];
  /** Shared facts this participant publishes or, as their owner, updates. */
  facts?: { key: string; value: string }[];
  /** Keys of board facts this task result relies on; a later change to one reopens the task. */
  usesFacts?: string[];
}
