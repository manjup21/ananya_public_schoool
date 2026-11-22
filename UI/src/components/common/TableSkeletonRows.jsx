import { TableRow, TableCell } from '../ui/table';
import { Skeleton } from '../ui/skeleton';

export function TableSkeletonRows({ columns = 4, rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      {Array.from({ length: columns }, (_, j) => (
        <TableCell key={j}>
          <Skeleton
            className="h-4 w-full"
            style={{ maxWidth: `${6 + ((j * 3 + i * 2) % 5)}rem` }}
          />
        </TableCell>
      ))}
    </TableRow>
  ));
}
