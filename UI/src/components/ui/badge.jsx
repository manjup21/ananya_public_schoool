import { cn } from './utils';

const variantClasses = {
  default: 'border-transparent bg-gray-900 text-white',
  secondary: 'border-transparent bg-gray-100 text-gray-900',
  destructive: 'border-transparent bg-red-100 text-red-700',
  outline: 'text-gray-900 border-gray-300',
};

export const Badge = ({ className, variant = 'default', ...props }) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium',
      variantClasses[variant] || variantClasses.default,
      className
    )}
    {...props}
  />
);
