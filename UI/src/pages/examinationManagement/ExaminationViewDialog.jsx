import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Download } from 'lucide-react';
import {
  classNameById,
  fmtDate,
  formatExamStatus,
  sectionLabelForExam,
  statusBadge,
  time12,
} from './examinationHelpers';

function subjectScheduleLabel(sub) {
  const date = fmtDate(sub?.exam_date);
  const start = time12(sub?.start_time);
  const end = time12(sub?.end_time);
  if (start !== '—' && end !== '—') return `${date} · ${start} – ${end}`;
  if (start !== '—') return `${date} · ${start}`;
  if (end !== '—') return `${date} · until ${end}`;
  return date;
}

export function ExaminationViewDialog({
  open,
  onOpenChange,
  exam,
  classes,
  onEdit,
  onDownloadHallTickets,
  hallTicketProgress = null,
}) {
  const subjects = Array.isArray(exam?.subjects) ? exam.subjects : [];
  const downloading = Boolean(hallTicketProgress);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[min(90vh,100dvh-2rem)] overflow-y-auto overflow-x-hidden">
        {exam ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Exam</div>
                <div className="break-words text-xl font-semibold text-gray-900">{exam.test_name}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                <Badge
                  variant={statusBadge(exam.exam_status).variant}
                  className={`${statusBadge(exam.exam_status).className} order-first sm:order-last sm:mt-5`}
                >
                  {statusBadge(exam.exam_status).label}
                </Badge>
                {String(exam.exam_status ?? '').toLowerCase() === 'scheduled' ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 w-full sm:w-auto sm:mt-5"
                    onClick={() => {
                      if (!exam?.id || downloading) return;
                      onDownloadHallTickets?.(exam);
                    }}
                    disabled={downloading}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    {downloading
                      ? `${hallTicketProgress.done}/${hallTicketProgress.total}…`
                      : 'Hall Tickets'}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Basic Info</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Exam Type</div>
                    <div className="text-sm font-medium text-gray-900">{exam.exam_type_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="text-sm font-medium text-gray-900">{formatExamStatus(exam.exam_status)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-sm font-medium text-gray-900">
                      {exam.created_at ? String(exam.created_at).slice(0, 10) : '—'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Subject timetable</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-gray-500">
                    First sitting (lists/reports):{' '}
                    <span className="font-medium text-gray-900">{fmtDate(exam.exam_date)}</span>
                  </div>
                  {subjects.length ? (
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                      {subjects.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {sub.is_part_b ? `PB | ${sub.name}` : sub.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {sub.is_part_b ? 'Part B grade' : subjectScheduleLabel(sub)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No subjects linked.</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-gray-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">Academic Info</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-gray-500">Class</div>
                        <div className="text-sm font-medium text-gray-900">{classNameById(classes, exam.class_id)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Section</div>
                        <div className="text-sm font-medium text-gray-900">
                          {sectionLabelForExam(exam, classes)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Subjects (Part A)</div>
                      <div className="text-sm font-medium text-gray-900">
                        {subjects.filter((s) => !s.is_part_b).length
                          ? subjects.filter((s) => !s.is_part_b).map((s) => s.name).join(', ')
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Part B subjects</div>
                      <div className="text-sm font-medium text-gray-900">
                        {subjects.filter((s) => s.is_part_b).length
                          ? subjects.filter((s) => s.is_part_b).map((s) => s.name).join(', ')
                          : '—'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">Evaluation</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-gray-500">Max Marks</div>
                        <div className="text-sm font-medium text-gray-900">{exam.max_marks ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Passing Marks</div>
                        <div className="text-sm font-medium text-gray-900">{exam.passing_marks ?? '—'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Passing / Max</div>
                      <div className="text-sm font-medium text-gray-900">
                        {exam.passing_marks ?? '—'}/{exam.max_marks}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Invigilator</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-500">Name</div>
                    <div className="text-sm font-medium text-gray-900">{exam.invigilator ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Instructions</div>
                    <div className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {exam.instructions ? exam.instructions : '—'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange?.(false)}
                disabled={downloading}
              >
                Close
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  if (!exam?.id) return;
                  onOpenChange?.(false);
                  onEdit?.(exam.id);
                }}
                disabled={exam.exam_status === 'cancelled' || downloading}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-gray-600">Examination not found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
