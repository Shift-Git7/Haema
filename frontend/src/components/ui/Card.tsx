import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    const base = 'rounded border border-border bg-white dark:bg-gray-800 p-4 shadow-sm';
    return (
      <div
        ref={ref}
        className={clsx(base, className)}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
