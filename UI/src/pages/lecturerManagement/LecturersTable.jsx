import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
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
import { Pencil, Eye, KeyRound, Trash2 } from 'lucide-react';

function accessLabels(lecturer) {
  const labels = [];
  if (lecturer?.is_super_admin) labels.push('Super Admin');
  if (lecturer?.is_admin) labels.push('Admin');
  if (lecturer?.can_manage_fees) labels.push('Fee');
  return labels.length ? labels : ['Staff'];
}

export function LecturersTable({ lecturers, status, onView, onEdit, onResetPassword, onDelete }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead>Access</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === 'loading' ? (
              <TableSkeletonRows columns={7} rows={5} />
            ) : lecturers.length === 0 ? (
              <TableEmptyRow colSpan={7}>No staff found</TableEmptyRow>
            ) : (
              lecturers.map((lecturer) => {
                const fullName =
                  [lecturer.title, lecturer.first_name, lecturer.last_name].filter(Boolean).join(' ') ||
                  lecturer.name;
                const subjectList = String(lecturer.subjects || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                return (
                  <TableRow key={lecturer.id}>
                    <TableCell className="font-medium">{lecturer.employee_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-semibold text-sm">
                          {(lecturer.first_name || lecturer.name || '?').charAt(0)}
                        </div>
                        <span>{fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{lecturer.email}</TableCell>
                    <TableCell className="text-gray-600">{lecturer.phone}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {subjectList.map((subject, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {accessLabels(lecturer).map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(lecturer)}
                          title="View details"
                          aria-label={fullName ? `View ${fullName}` : 'View staff'}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(lecturer)}
                          title="Edit"
                          aria-label={fullName ? `Edit ${fullName}` : 'Edit staff'}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onResetPassword(lecturer)}
                          title="Reset PIN"
                          aria-label={fullName ? `Reset PIN for ${fullName}` : 'Reset PIN'}
                        >
                          <KeyRound className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(lecturer)}
                          title="Delete"
                          aria-label={fullName ? `Delete ${fullName}` : 'Delete staff'}
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
