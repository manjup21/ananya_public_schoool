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
import { Ban, ClipboardCheck, Eye, Pencil } from 'lucide-react';
import { formatExamStatus, classNameById, sectionLabelForExam, fmtDate } from './examinationHelpers';

export function ExaminationsTable({ exams, classes, status, onView, onEdit, onCancel, onMarkCompleted }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Test</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Class/Section</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {status === 'loading' ? (
              <TableSkeletonRows columns={6} rows={5} />
            ) : exams.length === 0 ? (
              <TableEmptyRow colSpan={6}>No examinations found</TableEmptyRow>
            ) : (
              exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.test_name}</TableCell>
                  <TableCell className="text-gray-600">{e.exam_type_name ?? '—'}</TableCell>
                  <TableCell className="text-gray-600">
                    {formatExamStatus(e.exam_status)}
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-900">{classNameById(classes, e.class_id)}</span>
                    <span className="text-gray-600"> - {sectionLabelForExam(e, classes)}</span>
                  </TableCell>
                  <TableCell className="text-gray-700 whitespace-nowrap">{fmtDate(e.exam_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(e.id)}
                        title="View"
                        aria-label={`View ${e.test_name ?? 'exam'}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {e.exam_status === 'scheduled' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(e.id)}
                          title="Edit"
                          aria-label={`Edit ${e.test_name ?? 'exam'}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {e.exam_status === 'scheduled' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onMarkCompleted(e.id)}
                          title="Mark as Completed"
                          aria-label={`Mark ${e.test_name ?? 'exam'} as completed`}
                        >
                          <ClipboardCheck className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onCancel(e.id)}
                        title="Cancel Exam"
                        aria-label={`Cancel ${e.test_name ?? 'exam'}`}
                        disabled={e.exam_status === 'cancelled'}
                      >
                        <Ban className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
