import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Shield, Award } from 'lucide-react';
import type { AgentReputation } from '../types';
import { formatAddress } from '../utils/blockchain';
import { cn } from '../utils/cn';

interface LeaderboardProps {
  agents: AgentReputation[];
  highlightedAgent?: string;
  className?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ agents, highlightedAgent, className }) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Award className="w-5 h-5 text-gray-300" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-notary-success" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-notary-error" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 900) return 'text-yellow-400';
    if (score >= 800) return 'text-bnb-400';
    if (score >= 700) return 'text-purple-400';
    return 'text-gray-400';
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold gradient-text">Agent Reputation Leaderboard</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4" />
          <span>ERC-8004 Identity</span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-notary-border text-sm font-medium text-gray-400">
          <div className="col-span-1">Rank</div>
          <div className="col-span-3">Agent</div>
          <div className="col-span-2 text-right">Accuracy</div>
          <div className="col-span-2 text-right">Consistency</div>
          <div className="col-span-2 text-right">Score</div>
          <div className="col-span-2 text-center">Trend</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-notary-border">
          {agents.map((agent) => {
            const isHighlighted = highlightedAgent?.toLowerCase() === agent.agent.address.toLowerCase();

            return (
              <div
                key={agent.agent.address}
                className={cn(
                  'grid grid-cols-12 gap-4 p-4 items-center transition-all',
                  isHighlighted && 'bg-bnb-500/10 border-l-2 border-l-bnb-500 animate-pulse-slow'
                )}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center justify-center">
                  {getRankIcon(agent.rank)}
                </div>

                {/* Agent Info */}
                <div className="col-span-3">
                  <p className="font-medium text-gray-200">{agent.agent.name}</p>
                  <p className="text-xs font-mono text-gray-500">{formatAddress(agent.agent.address)}</p>
                </div>

                {/* Accuracy */}
                <div className="col-span-2 text-right">
                  <p className="font-semibold text-gray-300">{agent.accuracyRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">
                    {agent.correctDecisions}/{agent.totalDecisions}
                  </p>
                </div>

                {/* Consistency */}
                <div className="col-span-2 text-right">
                  <p className="font-semibold text-gray-300">{agent.consistencyScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500">score</p>
                </div>

                {/* Reputation Score */}
                <div className="col-span-2 text-right">
                  <p className={cn('text-xl font-bold', getScoreColor(agent.reputationScore))}>
                    {agent.reputationScore}
                  </p>
                </div>

                {/* Trend */}
                <div className="col-span-2 flex items-center justify-center">
                  {getTrendIcon(agent.trend)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-notary-success" />
          <span>Improving</span>
        </div>
        <div className="flex items-center gap-2">
          <Minus className="w-4 h-4 text-gray-500" />
          <span>Stable</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-notary-error" />
          <span>Declining</span>
        </div>
      </div>
    </div>
  );
};
