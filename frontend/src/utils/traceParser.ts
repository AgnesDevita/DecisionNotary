/**
 * Parses a Langfuse Trace JSON and extracts relevant decision information
 * This is a client-side parser that can work with real Langfuse export format
 */
import type { LangfuseTrace, ParsedTrace, ToolCall } from '../types';

export function parseTraceJson(jsonString: string): ParsedTrace | null {
  try {
    const trace: LangfuseTrace = JSON.parse(jsonString);

    // Extract tool calls from observations
    const toolCalls: ToolCall[] = [];
    let reasoning = '';

    trace.observations.forEach((obs) => {
      if (obs.name.includes('tool') || obs.name.includes('function')) {
        toolCalls.push({
          name: obs.name,
          arguments: (obs.data?.input as Record<string, unknown>) || {},
          result: obs.data?.output,
          duration: new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime(),
        });
      }

      // Extract reasoning from generation or span observations
      if (obs.name.toLowerCase().includes('reason') || obs.type === 'generation') {
        reasoning += obs.data?.output
          ? String(obs.data.output)
          : `${obs.name}: ${JSON.stringify(obs.data?.input || '')}\n`;
      }
    });

    // Determine if this is a failure trace (low scores)
    const scores = trace.scores || {};
    const isFailure =
      (scores.answerRelevance !== undefined && scores.answerRelevance < 0.5) ||
      (scores.faithfulness !== undefined && scores.faithfulness < 0.5);

    const failureReason = isFailure
      ? scores.answerRelevance === 0
        ? 'Zero answer relevance detected'
        : scores.faithfulness !== undefined && scores.faithfulness < 0.5
          ? 'Low faithfulness score detected'
          : 'Quality threshold not met'
      : undefined;

    return {
      traceId: trace.id,
      agentId: trace.agentId,
      timestamp: trace.timestamp,
      toolCalls,
      reasoning: reasoning.trim(),
      scores,
      input: trace.observations.find((o) => o.type === 'span' && o.name.toLowerCase().includes('input'))?.data
        ?.input,
      output: trace.observations.find((o) => o.type === 'generation')?.data?.output,
      isFailure,
      failureReason,
    };
  } catch (error) {
    console.error('Failed to parse trace JSON:', error);
    return null;
  }
}

/**
 * Validates if the JSON appears to be a Langfuse trace
 */
export function isValidTraceJson(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    return (
      typeof parsed === 'object' &&
      (parsed.id !== undefined || parsed.trace_id !== undefined) &&
      (parsed.agentId !== undefined || parsed.agent_id !== undefined || parsed.observations !== undefined)
    );
  } catch {
    return false;
  }
}

/**
 * Formats a timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generates a mock trace for testing when real data isn't available
 */
export function generateMockTrace(failureMode = false): LangfuseTrace {
  return {
    id: `trace_${Date.now()}`,
    timestamp: new Date().toISOString(),
    agentId: '0x' + Math.random().toString(16).slice(2, 42),
    sessionId: 'session_' + Math.random().toString(36).slice(2, 15),
    userId: 'user_' + Math.random().toString(36).slice(2, 8),
    observations: [
      {
        id: 'obs_1',
        type: 'span',
        name: 'user_input',
        startTime: new Date(Date.now() - 5000).toISOString(),
        endTime: new Date(Date.now() - 4800).toISOString(),
        data: {
          input: 'What is the current price of BNB?',
        },
      },
      {
        id: 'obs_2',
        type: 'span',
        name: 'tool_call:price_oracle',
        startTime: new Date(Date.now() - 4800).toISOString(),
        endTime: new Date(Date.now() - 3000).toISOString(),
        data: {
          input: { token: 'BNB', currency: 'USD' },
          output: { price: 598.42, timestamp: Date.now() },
        },
      },
      {
        id: 'obs_3',
        type: 'generation',
        name: 'reasoning',
        startTime: new Date(Date.now() - 3000).toISOString(),
        endTime: new Date(Date.now() - 1000).toISOString(),
        data: {
          input: 'Price data retrieved, formulating response...',
          output:
            'The current price of BNB is $598.42 USD. This information was retrieved from the price oracle tool.',
        },
      },
    ],
    scores: failureMode
      ? { answerRelevance: 0.0, faithfulness: 0.3, overall: 0.15 }
      : { answerRelevance: 0.95, faithfulness: 0.98, overall: 0.965 },
    metadata: {
      model: 'gpt-4',
      temperature: 0.1,
    },
  };
}
