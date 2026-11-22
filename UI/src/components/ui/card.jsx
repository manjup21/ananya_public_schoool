import { cn } from './utils';

export const Card = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col gap-6 rounded-xl border border-gray-200 bg-white text-gray-900',
      className
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }) => (
  <div
    className={cn(
      'grid items-start gap-1.5 px-6 pt-6',
      className
    )}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }) => (
  <h4 className={cn('text-lg font-semibold leading-none', className)} {...props} />
);

export const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-gray-600', className)} {...props} />
);

export const CardContent = ({ className, ...props }) => (
  <div className={cn('px-6 pb-6', className)} {...props} />
);
