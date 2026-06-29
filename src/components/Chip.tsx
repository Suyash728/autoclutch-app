import React from 'react';

interface ChipProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'urgent' | 'tertiary' | 'success';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  isActive = false,
  onClick,
  onDelete,
  className = '',
  variant = 'primary'
}) => {
  const baseStyle = 'inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 select-none';
  
  const getColors = () => {
    if (isActive) {
      switch (variant) {
        case 'urgent':
          return 'bg-urgent text-white shadow-[0_2px_10px_rgba(255,90,90,0.3)]';
        case 'tertiary':
          return 'bg-tertiary text-on-tertiary shadow-[0_2px_10px_rgba(255,180,166,0.3)]';
        case 'success':
          return 'bg-success text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)]';
        default:
          return 'bg-primary text-white shadow-[0_2px_10px_rgba(91,79,227,0.3)]';
      }
    } else {
      switch (variant) {
        case 'urgent':
          return 'bg-urgent/15 text-urgent hover:bg-urgent/25 border border-urgent/20';
        case 'tertiary':
          return 'bg-tertiary/15 text-tertiary hover:bg-tertiary/25 border border-tertiary/20';
        case 'success':
          return 'bg-success/15 text-success hover:bg-success/25 border border-success/20';
        default:
          return 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest border border-white/5';
      }
    }
  };

  return (
    <span
      className={`${baseStyle} ${getColors()} ${onClick ? 'cursor-pointer active:scale-95' : ''} ${className}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1.5 -mr-1 hover:bg-black/10 rounded-full p-0.5 inline-flex items-center justify-center focus:outline-none"
        >
          <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
            <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
          </svg>
        </button>
      )}
    </span>
  );
};
