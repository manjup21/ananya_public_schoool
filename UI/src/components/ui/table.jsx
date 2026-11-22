import { cn } from './utils';

export const Table = ({ className, ...props }) => (
  <div className="relative w-full overflow-x-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
);

export const TableHeader = ({ className, ...props }) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
);

export const TableBody = ({ className, ...props }) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);

export const TableRow = ({ className, ...props }) => (
  <tr
    className={cn(
      'border-b border-gray-200 transition-colors hover:bg-gray-50',
      className
    )}
    {...props}
  />
);

export const TableHead = ({ className, ...props }) => (
  <th
    className={cn(
      'h-10 px-2 text-left align-middle font-medium text-gray-900 whitespace-nowrap',
      className
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }) => (
  <td className={cn('p-2 align-middle whitespace-nowrap', className)} {...props} />
);
