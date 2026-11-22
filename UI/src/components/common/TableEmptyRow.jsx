import { TableCell, TableRow } from '../ui/table';
import { cn } from '../ui/utils';

/** Full-width "no rows" table row: plain text, or an icon + title + optional hint when `icon` is set. */
export function TableEmptyRow({ colSpan, icon: Icon, title, hint, children, className }) {
  if (Icon) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className={cn('text-center py-12', className)}>
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10 text-gray-300" aria-hidden />
            <p className="text-gray-500 font-medium">{title}</p>
            {hint ? <p className="text-sm text-gray-400">{hint}</p> : null}
          </div>
        </TableCell>
      </TableRow>
    );
  }
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn('text-center py-8 text-gray-500', className)}>
        {children ?? title}
      </TableCell>
    </TableRow>
  );
}
