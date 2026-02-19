// Core trace data structures (Langfuse-compatible)
export interface LangfuseTrace {
  id: string;
  timestamp: string;
  agentId: string;
  sessionId: string;
  userId?: string;
  observations: Observation[];
  scores?: TraceScores;
  metadata?: Record<string, unknown>;
}

export interface Observation {
  id: string;
  type: 'span' | 'generation' | 'event';
  name: string;
  startTime: string;
  endTime: string;
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  parentObservationId?: string;
  data?: {
    input?: unknown;
    output?: unknown;
    metadata?: Record<string, unknown>;
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  duration?: number;
}

export interface TraceScores {
  faithfulness?: number;
  answerRelevance?: number;
  contextRecall?: number;
  overall?: number;
}

// Agent reputation system (ERC-8004 compatible)
export interface AgentIdentity {
  address: string; // ERC-8004 identity address
  name: string;
  owner: string;
  createdAt: string;
}

export interface AgentReputation {
  agent: AgentIdentity;
  totalDecisions: number;
  correctDecisions: number;
  incorrectDecisions: number;
  accuracyRate: number;
  consistencyScore: number;
  reputationScore: number;
  rank: number;
  trend: 'up' | 'down' | 'neutral';
}

// On-chain certificate
export interface DecisionCertificate {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  traceId: string;
  agentId: string;
  ipfsHash?: string;
  verified: boolean;
  network: 'bnb' | 'opbnb';
}

// Outcome resolution
export type DecisionOutcome = 'correct' | 'incorrect' | 'pending';

export interface ResolvedOutcome {
  traceId: string;
  outcome: DecisionOutcome;
  resolvedAt: string;
  resolvedBy: string;
  reason?: string;
}

// UI State
export interface ParsedTrace {
  traceId: string;
  agentId: string;
  timestamp: string;
  toolCalls: ToolCall[];
  reasoning: string;
  scores: TraceScores;
  input: unknown;
  output: unknown;
  isFailure: boolean;
  failureReason?: string;
}

export interface CommitStatus {
  status: 'idle' | 'committing' | 'success' | 'error';
  txHash?: string;
  error?: string;
  certificate?: DecisionCertificate;
}
