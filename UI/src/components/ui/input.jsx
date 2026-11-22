import { forwardRef } from 'react';
import { cn } from './utils';

/**
 * Browser suggestions are off by default so search, marks and amount boxes don't show unrelated
 * history; pass an explicit `autoComplete` token (username, email, tel, …) where autofill helps.
 */
export const Input = forwardRef(function Input({ className, type = 'text', autoComplete = 'off', ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      autoComplete={autoComplete}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
