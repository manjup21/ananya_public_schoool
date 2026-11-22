import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { TableSkeletonRows } from '../../components/common/TableSkeletonRows';
import { TablePagination } from '../../components/common/TablePagination';
import { TableEmptyRow } from '../../components/common/TableEmptyRow';
import { SearchInput } from '../../components/common/SearchInput';
import { usePagedRows } from '../../hooks/usePagedRows';
import {
  ArrowLeft,
  IndianRupee,
  Info,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
} from 'lucide-react';
import {
  clearFeeDueDetail,
  fetchFeeDueDetailThunk,
  retryFailedNotificationsThunk,
  sendFeeDueNotificationThunk,
} from '../../features/notifications/notificationsSlice';
import { NOTIFICATION_CHANNEL, fmtDateTime, NOTIFICATIONS_SEND_DISABLED, NOTIFICATIONS_SEND_DISABLED_TITLE } from './notificationHelpers';
import { FeeDueSendDialog } from './FeeDueSendDialog';

function fmtCurrency(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function FeeDueNotificationDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { classId, sectionId } = useParams();
  const [searchParams] = useSearchParams();

  const academicYear = searchParams.get('year') || currentAcademicYear();
  const channel = NOTIFICATION_CHANNEL;

  const { students, section, status } = useSelector((s) => s.notifications.feeDueDetail);
  const sendingStatus = useSelector((s) => s.notifications.sending.status);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTargetIds, setDialogTargetIds] = useState([]);

  const loadDetail = () => {
    if (!classId) return;
    dispatch(
      fetchFeeDueDetailThunk({
        classId,
        sectionId: sectionId || null,
        academicYear,
      })
    );
  };

  useEffect(() => {
    loadDetail();
    return () => {
      dispatch(clearFeeDueDetail());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, classId, sectionId, academicYear]);

  useEffect(() => {
    if (status === 'succeeded') {
      setSelectedIds(new Set(students.map((s) => s.student_id)));
    }
  }, [status, students]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, pageSize]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (
        q &&
        !s.student_name?.toLowerCase().includes(q) &&
        !String(s.roll_number || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [students, searchQuery]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedStudents } = usePagedRows(
    filteredStudents,
    page,
    pageSize
  );

  const allFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.student_id));

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(students.map((s) => s.student_id)));
      return;
    }
    setSelectedIds(new Set());
  };

  const toggleSelectOne = (studentId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  const openSendDialog = (targetStudentIds) => {
    const ids = targetStudentIds.filter((id) => {
      const s = students.find((st) => st.student_id === id);
      return Boolean(s?.guardian_phone);
    });

    if (ids.length === 0) {
      toast.error('Select students with a guardian phone');
      return;
    }

    const skipped = targetStudentIds.length - ids.length;
    if (skipped > 0) {
      toast.message(`${skipped} student${skipped !== 1 ? 's' : ''} skipped (no guardian phone)`);
    }

    setDialogTargetIds(ids);
    setDialogOpen(true);
  };

  const dialogRecipients = useMemo(
    () => students.filter((s) => dialogTargetIds.includes(s.student_id)),
    [students, dialogTargetIds]
  );

  const handleSend = async ({ dueDate } = {}) => {
    try {
      const result = await dispatch(
        sendFeeDueNotificationThunk({
          classId,
          sectionId: sectionId || null,
          academicYear,
          studentIds: dialogTargetIds,
          dueDate: dueDate || null,
          channel,
        })
      ).unwrap();
      const queued = result.queued || dialogTargetIds.length;
      toast.success(
        `Sending ${queued} fee due reminder${queued !== 1 ? 's' : ''}. Use Refresh to check progress.`
      );
      setDialogOpen(false);
      loadDetail();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to send notifications');
    }
  };

  const failedCount = useMemo(
    () => students.filter((s) => s.notification_status === 'failed').length,
    [students]
  );

  const handleRetryFailed = async () => {
    const logIdVal = section.last_log_id;
    if (!logIdVal) return;
    try {
      await dispatch(retryFailedNotificationsThunk({ logId: logIdVal })).unwrap();
      toast.success(
        `Retrying ${failedCount} failed notification${failedCount !== 1 ? 's' : ''}. Use Refresh to check progress.`
      );
      loadDetail();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to retry notifications');
    }
  };

  const sendableSelectedCount = useMemo(
    () =>
      [...selectedIds].filter((id) => {
        const s = students.find((st) => st.student_id === id);
        return Boolean(s?.guardian_phone);
      }).length,
    [selectedIds, students]
  );

  const isProcessing = section.last_sent_status === 'processing';
  const isFailed = section.last_sent_status === 'failed';
  const alreadySent = !!section.last_sent_at && !isProcessing && !isFailed;

  const titleClass = section.class_name || 'Class';
  const titleSection = section.section_label;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-2 text-gray-700 hover:text-gray-900"
          onClick={() => navigate('/admin/notifications/fees')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to fee dues
        </Button>
        <div className="mt-2 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Fee Due Reminders</h2>
          <p className="text-gray-600 mt-1">
            {titleClass}
            {titleSection ? ` — ${titleSection}` : ''}
            {' · '}
            {academicYear}
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3 flex-1">
            <Loader2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Notifications are being sent</p>
              <p className="mt-0.5">Messages are being delivered in the background.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100 w-full sm:w-auto"
            onClick={loadDetail}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      )}

      {(isFailed || (alreadySent && failedCount > 0)) && (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3 flex-1">
            <Info className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">
                {isFailed
                  ? 'All notifications failed'
                  : `${failedCount} notification${failedCount !== 1 ? 's' : ''} failed`}
              </p>
              <p className="mt-0.5">
                {isFailed
                  ? 'None of the messages were delivered.'
                  : 'Some messages could not be delivered.'}{' '}
                You can retry sending to the failed recipients.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="shrink-0 w-full sm:w-auto"
            onClick={handleRetryFailed}
            disabled={NOTIFICATIONS_SEND_DISABLED || sendingStatus === 'loading'}
            title={NOTIFICATIONS_SEND_DISABLED ? NOTIFICATIONS_SEND_DISABLED_TITLE : undefined}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Failed ({failedCount})
          </Button>
        </div>
      )}

      {alreadySent && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Reminders were last sent</p>
            <p className="mt-0.5">
              WhatsApp reminders for this section were last sent on{' '}
              <span className="font-medium">{fmtDateTime(section.last_sent_at)}</span>. You can still
              resend.
            </p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <Info className="h-8 w-8 text-red-400" />
          <p className="text-red-700 font-medium">Failed to load fee due data</p>
          <Button type="button" variant="outline" size="sm" onClick={loadDetail}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-6">
          {status === 'succeeded' && students.length > 0 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 flex-1">
                  <IndianRupee className="h-5 w-5 text-blue-500 shrink-0" />
                  <p className="text-sm text-blue-700">
                    <span className="font-semibold">{sendableSelectedCount}</span> of{' '}
                    <span className="font-semibold">{selectedIds.size}</span> selected can be notified
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <div className="flex h-10 w-full sm:w-36 items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-800">
                    WhatsApp
                  </div>
                  <Button
                    type="button"
                    onClick={() => openSendDialog([...selectedIds])}
                    variant={alreadySent ? 'outline' : 'default'}
                    className="w-full sm:w-auto whitespace-nowrap"
                    disabled={NOTIFICATIONS_SEND_DISABLED || sendableSelectedCount === 0 || isProcessing}
                    title={NOTIFICATIONS_SEND_DISABLED ? NOTIFICATIONS_SEND_DISABLED_TITLE : undefined}
                  >
                    {alreadySent ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1.5 shrink-0" />
                        Resend selected ({sendableSelectedCount})
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5 shrink-0" />
                        Send selected ({sendableSelectedCount})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <Label htmlFor="fee-detail-search">Search</Label>
                <SearchInput
                  size="sm"
                  id="fee-detail-search"
                  placeholder="Roll no or student name…"
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
              </div>
            </>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all students"
                      />
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="hidden md:table-cell">Guardian Phone</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === 'loading' || status === 'idle' ? (
                    <TableSkeletonRows columns={7} rows={8} />
                  ) : paginatedStudents.length === 0 ? (
                    <TableEmptyRow
                      colSpan={7}
                      icon={Wallet}
                      title={searchQuery ? 'No students match the search' : 'No outstanding fees in this section'}
                    />
                  ) : (
                    paginatedStudents.map((s) => {
                      const canNotify = Boolean(s.guardian_phone);
                      return (
                        <TableRow key={s.student_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(s.student_id)}
                              onCheckedChange={(checked) => toggleSelectOne(s.student_id, checked)}
                              aria-label={`Select ${s.student_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium hidden sm:table-cell">
                            {s.roll_number}
                          </TableCell>
                          <TableCell>{s.student_name}</TableCell>
                          <TableCell className="font-mono text-sm hidden md:table-cell">
                            {s.guardian_phone ? (
                              <span className="text-gray-600">{s.guardian_phone}</span>
                            ) : (
                              <span className="text-red-500 font-sans italic">No phone</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ₹{fmtCurrency(s.balance)}
                          </TableCell>
                          <TableCell>
                            {s.notification_status === 'sent' ? (
                              <Badge variant="secondary" className="bg-green-50 text-green-700">
                                Sent
                              </Badge>
                            ) : s.notification_status === 'failed' ? (
                              <Badge
                                variant="secondary"
                                className="bg-red-50 text-red-700 cursor-help"
                                title={s.notification_error || 'Send failed'}
                              >
                                Failed
                              </Badge>
                            ) : s.notification_status === 'processing' ? (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                Processing
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={NOTIFICATIONS_SEND_DISABLED || !canNotify || isProcessing}
                              onClick={() => openSendDialog([s.student_id])}
                              title={
                                NOTIFICATIONS_SEND_DISABLED
                                  ? NOTIFICATIONS_SEND_DISABLED_TITLE
                                  : !s.guardian_phone
                                    ? 'Guardian phone missing'
                                    : undefined
                              }
                            >
                              <Send className="h-4 w-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">Notify</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {filteredStudents.length > 0 && (
            <TablePagination
              selectId="fee-detail-page-size"
              page={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeSelectContentClassName="w-full min-w-[4.5rem]"
            />
          )}
        </CardContent>
      </Card>

      <FeeDueSendDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        channel={channel}
        recipients={dialogRecipients}
        schoolName={section.school_name}
        schoolPhone={section.school_phone}
        title={
          dialogRecipients.length > 0 &&
          dialogRecipients.every((s) => s.notification_status === 'sent')
            ? 'Resend Fee Due Reminder'
            : 'Send Fee Due Reminder'
        }
        sending={sendingStatus === 'loading'}
        onConfirm={handleSend}
        isResend={
          dialogRecipients.length > 0 &&
          dialogRecipients.every((s) => s.notification_status === 'sent')
        }
        alreadySentCount={dialogRecipients.filter((s) => s.notification_status === 'sent').length}
        lastSentAt={section.last_sent_at}
        lastSentChannel={section.last_sent_channel}
      />
    </div>
  );
}
