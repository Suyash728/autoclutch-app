import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'glass' | 'glowing' | 'container';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'glass',
  className = '',
  children,
  ...props
}) => {
  const baseStyle = 'rounded-[24px] p-6 transition-all duration-300';
  
  const variants = {
    solid: 'bg-surface-card border border-white/5',
    glass: 'glass-panel shadow-[0_12px_40px_rgba(13,8,38,0.4)]',
    glowing: 'glass-panel shadow-[0_12px_40px_rgba(91,79,227,0.15)] border-primary/20',
    container: 'bg-surface-container border border-white/5 shadow-inner'
  };

  return (
    <div
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
