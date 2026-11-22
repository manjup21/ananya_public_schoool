import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { TableSkeletonRows } from '../../components/common/TableSkeletonRows';
import { TablePagination } from '../../components/common/TablePagination';
import { TableEmptyRow } from '../../components/common/TableEmptyRow';
import { usePagedRows } from '../../hooks/usePagedRows';
import { FormSelect } from '../../components/common/FormSelect';
import { Label } from '../../components/ui/label';
import { ArrowLeft, Info, Loader2, RefreshCw, Send, UserX } from 'lucide-react';
import { SearchInput } from '../../components/common/SearchInput';
import { toast } from 'sonner';
import {
  fetchAttendanceDetailThunk,
  sendAttendanceNotificationThunk,
  retryFailedNotificationsThunk,
  clearAttendanceDetail,
} from '../../features/notifications/notificationsSlice';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATIONS_SEND_DISABLED,
  NOTIFICATIONS_SEND_DISABLED_TITLE,
  fmtDateLong,
  fmtDateTime,
  channelLabel,
  slotLabel,
  buildAttendanceMessage,
} from './notificationHelpers';
import { SendNotificationDialog } from './SendNotificationDialog';

export function AttendanceSectionDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { classId, sectionId } = useParams();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');

  const { students, meta, status } = useSelector((s) => s.notifications.attendanceDetail);
  const sendingStatus = useSelector((s) => s.notifications.sending.status);

  const channel = NOTIFICATION_CHANNEL;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const resolvedSectionId = sectionId || null;

  useEffect(() => {
    if (classId && date) {
      dispatch(fetchAttendanceDetailThunk({ classId, sectionId: resolvedSectionId, date }));
    }
    return () => {
      dispatch(clearAttendanceDetail());
    };
  }, [dispatch, classId, resolvedSectionId, date]);

  useEffect(() => { setPage(1); }, [searchQuery, filterStatus, pageSize]);

  const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 'sent', label: 'Sent' },
    { value: 'partial', label: 'Partial' },
    { value: 'failed', label: 'Failed' },
    { value: 'processing', label: 'Processing' },
    { value: 'pending', label: 'Pending' },
  ];

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.student_name?.toLowerCase().includes(q) && !String(s.roll_number || '').toLowerCase().includes(q)) return false;
      const st = s.notification_status || 'pending';
      if (filterStatus && st !== filterStatus) return false;
      return true;
    });
  }, [students, searchQuery, filterStatus]);

  const failedCount = useMemo(() => students.filter((s) => s.notification_status === 'failed').length, [students]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedStudents } = usePagedRows(
    filteredStudents,
    page,
    pageSize
  );

  const previewMessage = useMemo(() => {
    const sample = students[0];
    if (!sample) return '';
    return buildAttendanceMessage({
      studentName: sample.student_name,
      date,
      slots: sample.absent_slots,
      schoolName: meta.school_name,
      channel,
    });
  }, [students, date, meta.school_name, channel]);

  const handleSend = async () => {
    try {
      await dispatch(
        sendAttendanceNotificationThunk({ classId, sectionId: resolvedSectionId, date, channel })
      ).unwrap();
      toast.success(`Sending notifications to ${students.length} guardian${students.length !== 1 ? 's' : ''}. Use the Refresh button to check progress.`);
      setDialogOpen(false);
      dispatch(fetchAttendanceDetailThunk({ classId, sectionId: resolvedSectionId, date }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to send notifications');
    }
  };

  const handleRetryFailed = async () => {
    const logIdVal = meta.last_log_id;
    if (!logIdVal) return;
    try {
      await dispatch(retryFailedNotificationsThunk({ logId: logIdVal })).unwrap();
      toast.success(`Retrying ${failedCount} failed notification${failedCount !== 1 ? 's' : ''}. Use the Refresh button to check progress.`);
      dispatch(fetchAttendanceDetailThunk({ classId, sectionId: resolvedSectionId, date }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to retry notifications');
    }
  };

  const className = meta.class_name || 'Class';
  const sectionCode = meta.section_code;
  const isProcessing = meta.last_sent_status === 'processing';
  const isFailed = meta.last_sent_status === 'failed';
  const alreadySent = !!meta.all_notifications_sent && !isProcessing && !isFailed;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit gap-2 text-gray-700 hover:text-gray-900"
          onClick={() => navigate('/admin/notifications/attendance')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to summary
        </Button>
        <div className="mt-2 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            {sectionCode ? `${className} \u2014 ${sectionCode}` : className}
          </h2>
          <p className="text-gray-600 mt-1">Absent students on {fmtDateLong(date)}</p>
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
            onClick={() => dispatch(fetchAttendanceDetailThunk({ classId, sectionId: resolvedSectionId, date }))}
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
              <p className="font-semibold">{isFailed ? 'All notifications failed' : `${failedCount} notification${failedCount !== 1 ? 's' : ''} failed`}</p>
              <p className="mt-0.5">
                {isFailed ? 'None of the messages were delivered.' : 'Some messages could not be delivered.'} You can retry sending to the failed recipients.
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

      {!!meta.last_sent_at && !meta.all_notifications_sent && !isProcessing && !isFailed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">New absences need notification</p>
            <p className="mt-0.5">
              Some students were marked absent for additional periods after the last send. Send again to notify guardians for those slots.
            </p>
          </div>
        </div>
      )}

      {alreadySent && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Notifications already sent</p>
            <p className="mt-0.5">
              {channelLabel(meta.last_sent_channel)} notifications for this {sectionCode ? 'section' : 'class'} were sent on{' '}
              <span className="font-medium">{fmtDateTime(meta.last_sent_at)}</span>
              {meta.last_sent_by ? <> by <span className="font-medium">{meta.last_sent_by}</span></> : null}.
              {meta.sent_count > 0 && <> <span className="font-medium">{meta.sent_count}</span> sent</>}
              {meta.failed_count > 0 && <>, <span className="font-medium text-red-700">{meta.failed_count}</span> failed</>}.
              {' '}You can still resend if needed.
            </p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <Info className="h-8 w-8 text-red-400" />
          <p className="text-red-700 font-medium">Failed to load attendance data</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatch(fetchAttendanceDetailThunk({ classId, sectionId: resolvedSectionId, date }))}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {status === 'succeeded' && students.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100 flex-1">
                <UserX className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">{students.length}</span> student{students.length !== 1 ? 's' : ''} absent
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto shrink-0">
                <div
                  className="flex h-10 w-full sm:w-36 items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-800"
                  aria-label="Notification channel"
                >
                  WhatsApp
                </div>
                <Button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  variant={alreadySent ? 'outline' : 'default'}
                  className="w-full sm:w-auto whitespace-nowrap"
                  disabled={NOTIFICATIONS_SEND_DISABLED || isProcessing}
                  title={
                    NOTIFICATIONS_SEND_DISABLED
                      ? NOTIFICATIONS_SEND_DISABLED_TITLE
                      : isProcessing
                        ? 'Wait for current notifications to finish'
                        : undefined
                  }
                >
                  {alreadySent ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1.5 shrink-0" />
                      Resend ({students.length})
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5 shrink-0" />
                      Send ({students.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {status === 'succeeded' && students.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div className="space-y-2">
                <Label htmlFor="att-search">Search</Label>
                <SearchInput
                  size="sm"
                  id="att-search"
                  placeholder="Roll no or student name…"
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
              </div>
              <FormSelect
                id="att-filter-status"
                label="Status"
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v)}
                placeholder="All Status"
                options={STATUS_OPTIONS}
              />
            </div>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="hidden sm:table-cell">Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="hidden md:table-cell">Father Name</TableHead>
                    <TableHead>Guardian Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">Absent Slot(s)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === 'loading' ? (
                    <TableSkeletonRows columns={6} rows={8} />
                  ) : paginatedStudents.length === 0 ? (
                    <TableEmptyRow
                      colSpan={6}
                      icon={UserX}
                      title={searchQuery || filterStatus ? 'No students match the filters' : 'No absent students found'}
                      hint={searchQuery || filterStatus ? 'Try changing the search or status filter' : null}
                    />
                  ) : (
                    paginatedStudents.map((s) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-medium hidden sm:table-cell">{s.roll_number}</TableCell>
                        <TableCell>{s.student_name}</TableCell>
                        <TableCell className="text-gray-600 hidden md:table-cell">{s.father_name ?? s.guardian_name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {s.guardian_phone ? (
                            <span className="text-gray-600">{s.guardian_phone}</span>
                          ) : (
                            <span className="text-red-500 font-sans italic">No phone</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(s.absent_slots || []).map((slot) => (
                              <Badge
                                key={slot}
                                variant="secondary"
                                className="bg-red-50 text-red-700"
                              >
                                {slotLabel(slot)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.notification_status === 'sent' || (s.notification_sent && s.notification_status !== 'failed') ? (
                            <Badge variant="secondary" className="bg-green-50 text-green-700">
                              Sent
                            </Badge>
                          ) : s.notification_status === 'partial' ? (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-800">
                              Partial
                            </Badge>
                          ) : s.notification_status === 'failed' || s.notification_failed ? (
                            <Badge
                              variant="secondary"
                              className="bg-red-50 text-red-700 cursor-help"
                              title={s.notification_error || 'Send failed'}
                            >
                              Failed
                            </Badge>
                          ) : s.notification_status === 'processing' || s.notification_processing ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                              Processing
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {filteredStudents.length > 0 && (
            <TablePagination
              selectId="att-detail-page-size"
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

      <SendNotificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        channel={channel}
        recipientCount={students.length}
        previewMessage={previewMessage}
        title={alreadySent ? 'Resend Absence Notification' : 'Send Absence Notification'}
        sending={sendingStatus === 'loading'}
        onConfirm={handleSend}
        isResend={alreadySent}
        lastSentAt={meta.last_sent_at}
        lastSentChannel={meta.last_sent_channel}
      />
    </div>
  );
}
