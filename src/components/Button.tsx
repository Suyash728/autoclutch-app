import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-semibold rounded-full tracking-wide transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] cursor-pointer';
  
  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white shadow-[0_4px_20px_rgba(91,79,227,0.3)] hover:shadow-[0_4px_25px_rgba(91,79,227,0.55)] border border-white/10 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-t before:from-black/10 before:to-transparent',
    secondary: 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-white/5 hover:border-white/12',
    ghost: 'bg-transparent text-primary hover:text-white border border-primary/40 hover:border-primary hover:bg-primary/10',
    danger: 'bg-urgent hover:bg-urgent/90 text-white shadow-[0_4px_15px_rgba(255,90,90,0.25)]'
  };

  const sizes = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-11 px-6 text-sm',
    lg: 'h-13 px-8 text-base'
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
