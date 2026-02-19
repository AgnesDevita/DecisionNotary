import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import type { ParsedTrace, DecisionOutcome } from '../types';
import { resolveOutcome } from '../utils/blockchain';

interface OutcomeResolverProps {
  trace: ParsedTrace | null;
  onOutcomeResolved: (traceId: string, outcome: DecisionOutcome) => void;
  className?: string;
}

export const OutcomeResolver: React.FC<OutcomeResolverProps> = ({
  trace,
  onOutcomeResolved,
  className,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<DecisionOutcome>('pending');
  const [reason, setReason] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);

  const handleResolve = async () => {
    if (!trace || selectedOutcome === 'pending') return;

    setIsResolving(true);

    try {
      await resolveOutcome(trace.traceId, selectedOutcome, reason);
      onOutcomeResolved(trace.traceId, selectedOutcome);
      setHasResolved(true);
    } catch (error) {
      console.error('Failed to resolve outcome:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const resetForm = () => {
    setSelectedOutcome('pending');
    setReason('');
    setHasResolved(false);
  };

  if (!trace) {
    return (
      <div className={className}>
        <div className="glass-card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Select a trace to resolve its outcome</p>
        </div>
      </div>
    );
  }

  if (hasResolved) {
    const isSuccess = selectedOutcome === 'correct';
    return (
      <div className={className}>
        <div className="glass-card p-5">
          <div className="flex items-center justify-center p-4 bg-notary-success/10 rounded-xl border border-notary-success/30 mb-4">
            {isSuccess ? (
              <CheckCircle className="w-12 h-12 text-notary-success" />
            ) : (
              <XCircle className="w-12 h-12 text-notary-error" />
            )}
          </div>
          <div className="text-center mb-4">
            <p className="text-lg font-semibold text-gray-200">
              Outcome Resolved as <span className={isSuccess ? 'text-notary-success' : 'text-notary-error'}>
                {selectedOutcome}
              </span>
            </p>
            <p className="text-sm text-gray-500 mt-1">Agent reputation has been updated</p>
          </div>
          <button onClick={resetForm} className="btn-secondary w-full">
            Resolve Another Outcome
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="glass-card p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-bnb-400" />
          Resolve Outcome
        </h2>

        <p className="text-sm text-gray-400 mb-4">
          Evaluate the agent's decision and record the outcome. This affects the agent's reputation score.
        </p>

        {/* Outcome Selection */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setSelectedOutcome('correct')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedOutcome === 'correct'
                ? 'border-notary-success bg-notary-success/10'
                : 'border-notary-border hover:border-notary-success/50'
            }`}
          >
            <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${
              selectedOutcome === 'correct' ? 'text-notary-success' : 'text-gray-500'
            }`} />
            <p className="font-medium text-notary-success">Correct</p>
            <p className="text-xs text-gray-500 mt-1">Decision was appropriate</p>
          </button>

          <button
            onClick={() => setSelectedOutcome('incorrect')}
            className={`p-4 rounded-xl border-2 transition-all ${
              selectedOutcome === 'incorrect'
                ? 'border-notary-error bg-notary-error/10'
                : 'border-notary-border hover:border-notary-error/50'
            }`}
          >
            <XCircle className={`w-8 h-8 mx-auto mb-2 ${
              selectedOutcome === 'incorrect' ? 'text-notary-error' : 'text-gray-500'
            }`} />
            <p className="font-medium text-notary-error">Incorrect</p>
            <p className="text-xs text-gray-500 mt-1">Decision was wrong</p>
          </button>
        </div>

        {/* Reason Input */}
        <div className="mb-4">
          <label className="text-sm text-gray-400 mb-2 block">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this decision was correct or incorrect..."
            className="input-field min-h-[80px] resize-none text-sm"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleResolve}
          disabled={selectedOutcome === 'pending' || isResolving}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResolving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Resolving...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Resolution
            </>
          )}
        </button>

        {/* Info Box */}
        {trace.isFailure && selectedOutcome === 'incorrect' && (
          <div className="mt-4 p-3 bg-notary-warning/10 border border-notary-warning/30 rounded-xl">
            <p className="text-sm text-notary-warning">
              ⚠️ This resolution will significantly impact the agent's reputation score due to
              detected failure in the trace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
