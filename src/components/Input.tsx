import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            isFocused ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-12 px-4 rounded-xl text-sm text-on-surface glass-input ${className}`}
        onFocus={(e) => {
          setIsFocused(true);
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (props.onBlur) props.onBlur(e);
        }}
        {...props}
      />
      {error && (
        <span className="text-xs text-urgent font-medium pl-1">
          {error}
        </span>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-200 ${
            isFocused ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full p-4 rounded-xl text-sm text-on-surface glass-input min-h-[100px] resize-none ${className}`}
        onFocus={(e) => {
          setIsFocused(true);
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          if (props.onBlur) props.onBlur(e);
        }}
        {...props}
      />
      {error && (
        <span className="text-xs text-urgent font-medium pl-1">
          {error}
        </span>
      )}
    </div>
  );
};
