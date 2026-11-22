import { cn } from './utils';

export const Switch = ({ className, checked, onCheckedChange, id, ...props }) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={!!checked}
    className={cn(
      'inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-blue-600' : 'bg-gray-200',
      className
    )}
    onClick={() => onCheckedChange?.(!checked)}
    {...props}
  >
    <span
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0.5'
      )}
    />
  </button>
);
