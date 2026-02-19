import React from 'react';
import { Shield, FileText } from 'lucide-react';
import { cn } from '../utils/cn';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  return (
    <header className={cn('border-b border-notary-border bg-notary-card/50 backdrop-blur-xl', className)}>
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bnb-600 to-purple-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Agent Decision Notary</h1>
              <p className="text-xs text-gray-500">AI Decision Transparency on BNB Chain</p>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Network Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-notary-dark/50 rounded-full border border-notary-border">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-gray-400">BNB Chain</span>
            </div>

            {/* Documentation Link */}
            <a
              href="#"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Docs</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
