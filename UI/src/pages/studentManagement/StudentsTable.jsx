import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { TableEmptyRow } from '../../components/common/TableEmptyRow';
import { TableSkeletonRows } from '../../components/common/TableSkeletonRows';
import { Pencil, Eye, Trash2 } from 'lucide-react';

export function StudentsTable({
  students,
  classes,
  status,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Roll No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class/Section</TableHead>
              <TableHead className="hidden lg:table-cell">Father</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === 'loading' ? (
              <TableSkeletonRows columns={5} rows={5} />
            ) : students.length === 0 ? (
              <TableEmptyRow colSpan={5}>No students found</TableEmptyRow>
            ) : (
              students.map((student) => {
                const klass = classes.find((c) => c.id === student.class_id);
                const sectionLabel = student.section_id
                  ? klass?.sections?.find((s) => s.id === student.section_id)?.section ?? '—'
                  : '';
                const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ');
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.roll_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                          {(student.first_name || 'S').charAt(0)}
                        </div>
                        <span>
                          {fullName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {klass?.name ?? '—'}
                      {sectionLabel ? ` - ${sectionLabel}` : ''}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-gray-600">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{student.father_name}</span>
                        <span className="text-xs">{student.guardian_phone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(student)}
                          aria-label={fullName ? `View ${fullName}` : 'View student'}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(student)}
                          aria-label={fullName ? `Edit ${fullName}` : 'Edit student'}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(student)}
                          aria-label={fullName ? `Delete ${fullName}` : 'Delete student'}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
