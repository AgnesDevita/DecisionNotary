import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { TraceInput } from './components/TraceInput';
import { TraceVisualizer } from './components/TraceVisualizer';
import { NotaryStatus } from './components/NotaryStatus';
import { OutcomeResolver } from './components/OutcomeResolver';
import { Leaderboard } from './components/Leaderboard';
import { NotificationContainer, type NotificationType } from './components/Notification';
import type { ParsedTrace, CommitStatus, DecisionOutcome, AgentReputation } from './types';
import { fetchAgentReputations, simulateReputationUpdate } from './utils/blockchain';
import { generateMockTrace } from './utils/traceParser';

// Active tab type
type Tab = 'input' | 'visualize' | 'leaderboard';

function App() {
  // State
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [parsedTrace, setParsedTrace] = useState<ParsedTrace | null>(null);
  const [commitStatus, setCommitStatus] = useState<CommitStatus>({ status: 'idle' });
  const [agents, setAgents] = useState<AgentReputation[]>([]);
  const [highlightedAgent, setHighlightedAgent] = useState<string | undefined>();
  const [notifications, setNotifications] = useState<Array<{ id: string; type: NotificationType; message: string }>>([]);

  // Load agent reputations on mount
  useEffect(() => {
    fetchAgentReputations().then(setAgents);
  }, []);

  // Show notification helper
  const showNotification = useCallback((type: NotificationType, message: string) => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, type, message }]);
  }, []);

  // Remove notification helper
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Handle trace parse
  const handleParse = useCallback((trace: ParsedTrace) => {
    setParsedTrace(trace);
    setActiveTab('visualize');
    showNotification('success', 'Trace parsed successfully!');
  }, [showNotification]);

  // Handle parse error
  const handleParseError = useCallback((message: string) => {
    showNotification('error', message);
  }, [showNotification]);

  // Handle outcome resolution
  const handleOutcomeResolved = useCallback((traceId: string, outcome: DecisionOutcome) => {
    if (!parsedTrace) return;

    // Update agent reputation
    const updatedAgents = simulateReputationUpdate(agents, parsedTrace.agentId, outcome);
    setAgents(updatedAgents);

    // Highlight the affected agent
    setHighlightedAgent(parsedTrace.agentId);

    // Show notification
    if (outcome === 'incorrect') {
      showNotification('warning', `Agent reputation updated. Decision marked as incorrect.`);
    } else {
      showNotification('success', `Agent reputation updated. Decision marked as correct.`);
    }

    // Switch to leaderboard to show the update
    setActiveTab('leaderboard');

    // Clear highlight after a few seconds
    setTimeout(() => setHighlightedAgent(undefined), 5000);
  }, [parsedTrace, agents, showNotification]);

  // Load mock trace for demo
  const loadDemoTrace = useCallback(async (failureMode = false) => {
    const mockTrace = generateMockTrace(failureMode);
    const parsed = {
      traceId: mockTrace.id,
      agentId: mockTrace.agentId,
      timestamp: mockTrace.timestamp,
      toolCalls: mockTrace.observations
        .filter((obs) => obs.name.includes('tool'))
        .map((obs) => ({
          name: obs.name,
          arguments: (obs.data?.input as Record<string, unknown>) || {},
          result: obs.data?.output,
          duration: new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime(),
        })),
      reasoning: mockTrace.observations
        .find((obs) => obs.name.toLowerCase().includes('reason'))
        ?.data?.output as string || 'Processing input and determining appropriate action...',
      scores: mockTrace.scores || {},
      input: mockTrace.observations[0]?.data?.input,
      output: mockTrace.observations.find((obs) => obs.type === 'generation')?.data?.output,
      isFailure: failureMode,
      failureReason: failureMode ? 'Zero answer relevance detected' : undefined,
    };

    setParsedTrace(parsed);
    setActiveTab('visualize');
    showNotification('success', failureMode ? 'Failure trace loaded for demo!' : 'Demo trace loaded!');
  }, [showNotification]);

  return (
    <div className="min-h-screen bg-notary-dark">
      <Header />

      {/* Notification Container */}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-8 bg-notary-card/50 p-1.5 rounded-xl w-fit mx-auto lg:mx-0">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'input'
                ? 'bg-bnb-500 text-white shadow-lg shadow-bnb-500/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Input Trace
          </button>
          <button
            onClick={() => setActiveTab('visualize')}
            disabled={!parsedTrace}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'visualize'
                ? 'bg-bnb-500 text-white shadow-lg shadow-bnb-500/25'
                : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Visualize & Commit
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-bnb-500 text-white shadow-lg shadow-bnb-500/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Input Tab */}
            {activeTab === 'input' && (
              <>
                <TraceInput
                  onParse={handleParse}
                  onError={handleParseError}
                  className="animate-fadeIn"
                />

                {/* Demo Buttons */}
                <div className="glass-card p-4">
                  <p className="text-sm text-gray-400 mb-3">Quick Demo:</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => loadDemoTrace(false)}
                      className="btn-secondary flex-1"
                    >
                      Load Success Trace
                    </button>
                    <button
                      onClick={() => loadDemoTrace(true)}
                      className="btn-secondary flex-1 border-notary-error/50 hover:border-notary-error text-notary-error"
                    >
                      Load Failure Trace
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Visualize Tab */}
            {activeTab === 'visualize' && parsedTrace && (
              <div className="space-y-6 animate-fadeIn">
                <TraceVisualizer trace={parsedTrace} />
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="animate-fadeIn">
                <Leaderboard
                  agents={agents}
                  highlightedAgent={highlightedAgent}
                />
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Notary Status */}
            <NotaryStatus
              trace={parsedTrace}
              status={commitStatus}
              onStatusChange={setCommitStatus}
            />

            {/* Outcome Resolver */}
            {activeTab === 'visualize' && parsedTrace && commitStatus.status === 'success' && (
              <OutcomeResolver
                trace={parsedTrace}
                onOutcomeResolved={handleOutcomeResolved}
                className="animate-fadeIn"
              />
            )}

            {/* Info Card */}
            {activeTab === 'input' && (
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3 gradient-text">How It Works</h3>
                <ol className="space-y-3 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-bnb-500/20 flex items-center justify-center flex-shrink-0 text-bnb-400 text-xs font-bold">1</span>
                    <span>Paste a Langfuse Trace JSON containing agent decision data</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-bnb-500/20 flex items-center justify-center flex-shrink-0 text-bnb-400 text-xs font-bold">2</span>
                    <span>Review the parsed decision flow and quality scores</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-bnb-500/20 flex items-center justify-center flex-shrink-0 text-bnb-400 text-xs font-bold">3</span>
                    <span>Commit the decision to BNB Chain for permanent record</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-bnb-500/20 flex items-center justify-center flex-shrink-0 text-bnb-400 text-xs font-bold">4</span>
                    <span>Resolve outcomes to update agent reputation scores</span>
                  </li>
                </ol>
              </div>
            )}

            {/* Stats Card */}
            {activeTab === 'leaderboard' && (
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-4 gradient-text">Network Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Agents</span>
                    <span className="font-semibold">{agents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Decisions</span>
                    <span className="font-semibold">
                      {agents.reduce((sum, a) => sum + a.totalDecisions, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Avg Accuracy</span>
                    <span className="font-semibold text-notary-success">
                      {(agents.reduce((sum, a) => sum + a.accuracyRate, 0) / agents.length).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-notary-border mt-12">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Agent Decision Notary — AI Decision Transparency on BNB Chain
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span>Built for BNB Chain Hackathon</span>
              <span>•</span>
              <span>ERC-8004 Compatible</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
