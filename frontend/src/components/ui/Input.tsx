import { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const base = 'w-full rounded border border-border bg-transparent px-3 py-2 text-base outline-none focus:ring-1 focus:ring-accent transition-colors placeholder:text-gray-400';
    return (
      <input
        ref={ref}
        className={clsx(base, className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
