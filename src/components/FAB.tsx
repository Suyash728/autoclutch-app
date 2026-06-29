import React from 'react';
import { Sparkles } from 'lucide-react';

interface FABProps {
  onClick?: () => void;
  isThinking?: boolean;
}

export const FAB: React.FC<FABProps> = ({ onClick, isThinking = true }) => {
  return (
    <button
      id="thinking-fab"
      onClick={onClick}
      className={`fixed bottom-6 right-6 lg:bottom-8 lg:right-8 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-white cursor-pointer select-none transition-all duration-300 shadow-[0_10px_25px_rgba(91,79,227,0.4)] ${
        isThinking ? 'thinking-fab-pulse' : 'hover:scale-105 active:scale-95'
      }`}
      aria-label="Ask AutoClutch"
    >
      <Sparkles className={`w-6 h-6 text-white ${isThinking ? 'animate-spin-slow' : ''}`} />
    </button>
  );
};
