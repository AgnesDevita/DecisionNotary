import React from 'react';
import {
  ArrowRight,
  Clock,
  Code,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import type { ParsedTrace } from '../types';
import { formatTimestamp } from '../utils/traceParser';
import { cn } from '../utils/cn';

interface TraceVisualizerProps {
  trace: ParsedTrace;
  className?: string;
}

export const TraceVisualizer: React.FC<TraceVisualizerProps> = ({ trace, className }) => {
  const getScoreColor = (score: number | undefined): string => {
    if (score === undefined) return 'text-gray-500';
    if (score >= 0.8) return 'text-notary-success';
    if (score >= 0.5) return 'text-notary-warning';
    return 'text-notary-error';
  };

  const getScoreBg = (score: number | undefined): string => {
    if (score === undefined) return 'bg-gray-500/20';
    if (score >= 0.8) return 'bg-notary-success/20';
    if (score >= 0.5) return 'bg-notary-warning/20';
    return 'bg-notary-error/20';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold gradient-text">Decision Trace</h2>
        {trace.isFailure ? (
          <div className="status-badge bg-notary-error/20 text-notary-error border border-notary-error/30">
            <AlertTriangle className="w-4 h-4" />
            Failure Detected
          </div>
        ) : (
          <div className="status-badge bg-notary-success/20 text-notary-success border border-notary-success/30">
            <CheckCircle className="w-4 h-4" />
            Valid Trace
          </div>
        )}
      </div>

      {/* Trace Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3">
          <p className="text-xs text-gray-500 mb-1">Trace ID</p>
          <p className="text-sm font-mono text-bnb-400">{trace.traceId.slice(0, 12)}...</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-gray-500 mb-1">Agent ID</p>
          <p className="text-sm font-mono text-bnb-400">{trace.agentId.slice(0, 10)}...</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Timestamp
          </p>
          <p className="text-sm">{formatTimestamp(trace.timestamp)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <Code className="w-3 h-3" />
            Tool Calls
          </p>
          <p className="text-sm font-semibold">{trace.toolCalls.length}</p>
        </div>
      </div>

      {/* Scores */}
      {(trace.scores.faithfulness !== undefined ||
        trace.scores.answerRelevance !== undefined) && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Quality Scores
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {trace.scores.faithfulness !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Faithfulness</p>
                <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full', getScoreBg(trace.scores.faithfulness))}>
                  <span className={cn('text-sm font-bold', getScoreColor(trace.scores.faithfulness))}>
                    {(trace.scores.faithfulness * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
            {trace.scores.answerRelevance !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Answer Relevance</p>
                <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full', getScoreBg(trace.scores.answerRelevance))}>
                  <span className={cn('text-sm font-bold', getScoreColor(trace.scores.answerRelevance))}>
                    {(trace.scores.answerRelevance * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
            {trace.scores.overall !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Overall</p>
                <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full', getScoreBg(trace.scores.overall))}>
                  <span className={cn('text-sm font-bold', getScoreColor(trace.scores.overall))}>
                    {(trace.scores.overall * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Flow */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          Decision Flow
        </h3>

        <div className="space-y-3">
          {/* Input Node */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/40">
              <MessageSquare className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 glass-card p-3">
              <p className="text-xs text-gray-500 mb-1">User Input</p>
              <p className="text-sm text-gray-300">
                {typeof trace.input === 'string'
                  ? trace.input
                  : JSON.stringify(trace.input).slice(0, 100)}
              </p>
            </div>
          </div>

          {/* Tool Calls */}
          {trace.toolCalls.map((tool, index) => (
            <React.Fragment key={index}>
              <div className="ml-4 w-0.5 h-6 bg-gradient-to-b from-blue-500/50 to-purple-500/50" />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 border border-purple-500/40">
                  <Code className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 glass-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-purple-400">{tool.name}</p>
                    {tool.duration && (
                      <p className="text-xs text-gray-500">{tool.duration}ms</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Arguments:</p>
                  <pre className="text-xs bg-notary-dark/50 p-2 rounded-lg overflow-x-auto">
                    {JSON.stringify(tool.arguments, null, 2)}
                  </pre>
                  {tool.result && (
                    <>
                      <p className="text-xs text-gray-500 mt-2 mb-1">Result:</p>
                      <pre className="text-xs bg-notary-dark/50 p-2 rounded-lg overflow-x-auto">
                        {JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}

          {/* Reasoning Node */}
          <div className="ml-4 w-0.5 h-6 bg-gradient-to-b from-purple-500/50 to-green-500/50" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 border border-green-500/40">
              <MessageSquare className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1 glass-card p-3">
              <p className="text-xs text-gray-500 mb-1">Reasoning</p>
              <p className="text-sm text-gray-300">{trace.reasoning || 'N/A'}</p>
            </div>
          </div>

          {/* Output Node */}
          <div className="ml-4 w-0.5 h-6 bg-gradient-to-b from-green-500/50 to-bnb-500/50" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-bnb-500/20 flex items-center justify-center flex-shrink-0 border border-bnb-500/40">
              <CheckCircle className="w-4 h-4 text-bnb-400" />
            </div>
            <div className="flex-1 glass-card p-3">
              <p className="text-xs text-gray-500 mb-1">Final Output</p>
              <p className="text-sm text-gray-300">
                {typeof trace.output === 'string'
                  ? trace.output
                  : JSON.stringify(trace.output).slice(0, 200)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Failure Warning */}
      {trace.isFailure && trace.failureReason && (
        <div className="glass-card p-4 border-l-4 border-l-notary-error">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-notary-error flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-notary-error">Failure Detected</p>
              <p className="text-sm text-gray-400 mt-1">{trace.failureReason}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
