import React, { useState } from 'react';
import { Shield, ExternalLink, CheckCircle, XCircle, Loader2, Copy, RefreshCw } from 'lucide-react';
import type { ParsedTrace, CommitStatus } from '../types';
import { commitDecisionToChain, getExplorerUrl, formatAddress } from '../utils/blockchain';

interface NotaryStatusProps {
  trace: ParsedTrace | null;
  status: CommitStatus;
  onStatusChange: (status: CommitStatus) => void;
  className?: string;
}

export const NotaryStatus: React.FC<NotaryStatusProps> = ({ trace, status, onStatusChange, className }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<'bnb' | 'opbnb'>('bnb');

  const handleCommit = async () => {
    if (!trace) return;

    onStatusChange({ status: 'committing' });

    try {
      // Call the blockchain service (mock or real)
      const certificate = await commitDecisionToChain(
        {
          traceId: trace.traceId,
          agentId: trace.agentId,
          scores: trace.scores,
          timestamp: trace.timestamp,
        },
        selectedNetwork
      );

      onStatusChange({
        status: 'success',
        certificate,
        txHash: certificate.txHash,
      });
    } catch (error) {
      onStatusChange({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to commit to blockchain',
      });
    }
  };

  const copyTxHash = () => {
    if (status.txHash) {
      navigator.clipboard.writeText(status.txHash);
    }
  };

  const resetStatus = () => {
    onStatusChange({ status: 'idle' });
  };

  if (!trace) {
    return (
      <div className={className}>
        <div className="glass-card p-6 text-center">
          <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Parse a trace to enable blockchain commitment</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-bnb-400" />
            Blockchain Notary
          </h2>

          {/* Network Selector */}
          <div className="flex items-center gap-2 bg-notary-dark/50 rounded-lg p-1">
            <button
              onClick={() => setSelectedNetwork('bnb')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                selectedNetwork === 'bnb'
                  ? 'bg-bnb-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              BNB Chain
            </button>
            <button
              onClick={() => setSelectedNetwork('opbnb')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                selectedNetwork === 'opbnb'
                  ? 'bg-bnb-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              opBNB
            </button>
          </div>
        </div>

        {/* Idle State */}
        {status.status === 'idle' && (
          <div className="space-y-4">
            <div className="bg-notary-dark/30 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Agent</span>
                <span className="font-mono text-bnb-400">{formatAddress(trace.agentId)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trace ID</span>
                <span className="font-mono">{trace.traceId.slice(0, 16)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Network</span>
                <span className="text-gray-300">
                  {selectedNetwork === 'bnb' ? 'BNB Chain' : 'opBNB'}
                </span>
              </div>
            </div>

            <button
              onClick={handleCommit}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Commit Decision to {selectedNetwork === 'bnb' ? 'BNB Chain' : 'opBNB'}
            </button>
          </div>
        )}

        {/* Committing State */}
        {status.status === 'committing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-12 h-12 text-bnb-400 animate-spin mb-4" />
            <p className="text-gray-300">Committing to blockchain...</p>
            <p className="text-sm text-gray-500 mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Success State */}
        {status.status === 'success' && status.certificate && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-center p-4 bg-notary-success/10 rounded-xl border border-notary-success/30">
              <CheckCircle className="w-12 h-12 text-notary-success mr-3" />
              <div>
                <p className="font-semibold text-notary-success">Successfully Committed!</p>
                <p className="text-sm text-gray-400">Decision is now on-chain</p>
              </div>
            </div>

            <div className="bg-notary-dark/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Transaction Hash</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-bnb-400">
                    {formatAddress(status.txHash || '')}
                  </span>
                  <button
                    onClick={copyTxHash}
                    className="p-1 hover:bg-notary-border rounded transition-colors"
                    title="Copy TX Hash"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Block #</span>
                <span className="text-gray-300">{status.certificate.blockNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Network</span>
                <span className="text-gray-300">
                  {status.certificate.network === 'bnb' ? 'BNB Chain' : 'opBNB'}
                </span>
              </div>
              {status.certificate.ipfsHash && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IPFS Hash</span>
                  <span className="font-mono text-xs text-bnb-400">
                    {status.certificate.ipfsHash}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href={getExplorerUrl(status.txHash!, status.certificate.network)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on Explorer
              </a>
              <button
                onClick={resetStatus}
                className="p-3 hover:bg-notary-border rounded-xl transition-colors"
                title="Commit New Decision"
              >
                <RefreshCw className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status.status === 'error' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center p-4 bg-notary-error/10 rounded-xl border border-notary-error/30">
              <XCircle className="w-8 h-8 text-notary-error mr-3" />
              <div>
                <p className="font-semibold text-notary-error">Commitment Failed</p>
                <p className="text-sm text-gray-400">{status.error}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCommit}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={resetStatus}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
