import { cn } from './utils';

export const Checkbox = ({ className, checked, onCheckedChange, ...props }) => (
  <input
    type="checkbox"
    className={cn(
      'h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500',
      className
    )}
    checked={checked ?? false}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
);
