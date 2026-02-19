import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseTraceJson, isValidTraceJson } from '../utils/traceParser';
import type { ParsedTrace } from '../types';
import { cn } from '../utils/cn';

interface TraceInputProps {
  onParse: (trace: ParsedTrace) => void;
  onError: (message: string) => void;
  className?: string;
}

export const TraceInput: React.FC<TraceInputProps> = ({ onParse, onError, className }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleParse = useCallback(async () => {
    if (!jsonInput.trim()) {
      onError('Please paste a Langfuse Trace JSON');
      return;
    }

    setIsLoading(true);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!isValidTraceJson(jsonInput)) {
      onError('Invalid trace format. Please check your JSON structure.');
      setIsLoading(false);
      return;
    }

    const parsed = parseTraceJson(jsonInput);
    if (parsed) {
      onParse(parsed);
    } else {
      onError('Failed to parse trace. Please ensure valid Langfuse format.');
    }
    setIsLoading(false);
  }, [jsonInput, onParse, onError]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setJsonInput(content);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleParse();
      }
    },
    [handleParse]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setJsonInput(content);
        };
        reader.readAsText(file);
      }
    },
    []
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-bnb-400" />
          Input Langfuse Trace
        </h2>
        <label className="btn-secondary text-sm px-4 py-2 cursor-pointer">
          <Upload className="w-4 h-4 inline mr-2" />
          Upload JSON
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      <div
        className={cn(
          'relative transition-all duration-200',
          isDragging && 'ring-2 ring-bnb-500/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste your Langfuse Trace JSON here...

Example structure:
{
  "id": "trace_123",
  "timestamp": "2024-03-15T10:30:00Z",
  "agentId": "0x...",
  "observations": [...],
  "scores": {
    "faithfulness": 0.95,
    "answerRelevance": 0.98
  }
}

Press Ctrl+Enter to parse`}
          className="input-field min-h-[200px] font-mono text-sm resize-none"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-notary-dark/80 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-bnb-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-bnb-400">Parsing trace...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Supports Langfuse export format or compatible JSON
        </p>
        <button
          onClick={handleParse}
          disabled={isLoading || !jsonInput.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Parse Trace
            </>
          )}
        </button>
      </div>
    </div>
  );
};
