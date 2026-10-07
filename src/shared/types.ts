export type AdapterKind = 'codex-cli' | 'claude-cli' | 'gemini-cli' | 'openai-api' | 'anthropic-api' | 'demo';
export interface Connection {
  id: string;
  name: string;
  kind: AdapterKind;
  available: boolean;
  detail: string;
  executable?: string;
}
export interface Member { id: string; name: string; connectionId: string; model: string; role: string }
export interface TaskSpec { id: string; title: string; description: string; assigneeId: string; dependsOn: string[] }
export interface TeamPlan { summary: string; successCriteria: string[]; roles: { memberId: string; role: string }[]; tasks: TaskSpec[] }
export type TaskStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed';
export interface TeamTask extends TaskSpec { status: TaskStatus; turns: number; output?: string; error?: string }
export interface TeamMessage {
  id: string; fromId: string; toId: string; body: string;
  request: boolean; replyTo?: string; taskId?: string;
  status: 'queued' | 'delivered' | 'answered'; createdAt: string;
}
export interface Artifact { id: string; title: string; body: string; authorId: string; taskId?: string; kind: 'work' | 'final' | 'review'; createdAt: string }
export type RunStatus = 'planning' | 'awaiting_approval' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface Run {
  id: string; title: string; goal: string; status: RunStatus; members: Member[]; leaderId: string;
  plan?: TeamPlan; tasks: TeamTask[]; messages: TeamMessage[]; artifacts: Artifact[];
  sessions: Record<string, string>; turnCount: number; reviewRound: number;
  phase: 'plan' | 'tasks' | 'synthesize' | 'review' | 'done';
  error?: string; createdAt: string; updatedAt: string; version: number;
  mode: 'live' | 'demo'; approvedAt?: string;
}
export interface RunEvent { id: number; runId: string; type: string; message: string; actorId?: string; createdAt: string }
export interface RunDetail { run: Run; events: RunEvent[] }
export interface Bootstrap { connections: Connection[]; runs: Run[]; csrfToken: string; maxConcurrent: number }
export interface CreateRunInput { goal: string; members: Member[]; leaderId: string; mode: 'live' | 'demo' }
export type TurnPurpose = 'plan' | 'task' | 'reply' | 'synthesize' | 'review';
export interface TurnInput {
  runId: string; member: Member; connection: Connection; purpose: TurnPurpose;
  prompt: string; cwd: string; sessionId?: string; signal: AbortSignal;
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
}
