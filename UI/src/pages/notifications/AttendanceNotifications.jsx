import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../../components/common/DatePickerInput';
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
import { PageHeader } from '../../components/common/PageHeader';
import { FormSelect } from '../../components/common/FormSelect';
import { Label } from '../../components/ui/label';
import { Calendar, Eye, Send, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useClasses } from '../../features/classes/useClasses';
import {
  fetchAttendanceSummaryThunk,
  sendBulkAttendanceThunk,
} from '../../features/notifications/notificationsSlice';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATIONS_SEND_DISABLED,
  NOTIFICATIONS_SEND_DISABLED_TITLE,
  fmtDateLong,
} from './notificationHelpers';
import { toIsoDate } from '../../utils/dateOnly';
import { BulkSendConfirmDialog } from './BulkSendConfirmDialog';

export function AttendanceNotifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, schoolName, status } = useSelector((s) => s.notifications.attendanceSummary);
  const { classes } = useClasses();

  const sendingStatus = useSelector((s) => s.notifications.sending.status);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const bulkChannel = NOTIFICATION_CHANNEL;
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    const iso = toIsoDate(selectedDate);
    if (iso) dispatch(fetchAttendanceSummaryThunk(iso));
  }, [dispatch, selectedDate]);

  useEffect(() => { setPage(1); }, [filterClassId, filterSectionId, pageSize]);
  useEffect(() => { setFilterSectionId(''); }, [filterClassId]);

  const filterSections = useMemo(() => {
    if (!filterClassId) return [];
    const cls = classes.find((c) => c.id === filterClassId);
    return (cls?.sections || []).map((s) => ({ value: s.id, label: s.section }));
  }, [classes, filterClassId]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (filterClassId && row.class_id !== filterClassId) return false;
      if (filterSectionId && row.section_id !== filterSectionId) return false;
      return true;
    });
  }, [items, filterClassId, filterSectionId]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedItems } = usePagedRows(filteredItems, page, pageSize);

  const handleViewDetail = (row) => {
    const iso = toIsoDate(selectedDate);
    const sectionSegment = row.section_id ? `/${row.section_id}` : '';
    navigate(`/admin/notifications/attendance/${row.class_id}${sectionSegment}?date=${iso}`);
  };

  const totalAbsent = filteredItems.reduce((sum, r) => sum + (r.absent_count || 0), 0);

  const unsentSections = useMemo(
    () => items.filter((s) => !s.notification_sent && !s.notification_processing && s.absent_count > 0),
    [items]
  );

  const handleBulkSend = async () => {
    const iso = toIsoDate(selectedDate);
    if (!iso) return;
    try {
      const result = await dispatch(sendBulkAttendanceThunk({ date: iso, channel: bulkChannel })).unwrap();
      const queued = result.queued || 0;
      const sections = result.sections || 0;
      toast.success(`Sending ${queued} notification${queued !== 1 ? 's' : ''} across ${sections} section${sections !== 1 ? 's' : ''}. Refresh to check progress.`);
      setBulkDialogOpen(false);
      dispatch(fetchAttendanceSummaryThunk(iso));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to send bulk notifications');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Notifications"      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
            <div className="space-y-2">
              <Label>Select date</Label>
              <div className="relative">
                <DatePicker
                  selected={selectedDate}
                  onChange={(d) => setSelectedDate(d)}
                  dateFormat="dd-MM-yyyy"
                  maxDate={new Date()}
                  preventOpenOnFocus
                  shouldCloseOnSelect
                  customInput={<DatePickerInput placeholder="dd-mm-yyyy" className="w-full" />}
                  wrapperClassName="w-full"
                  calendarClassName="!font-sans"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Showing absences for <span className="font-medium text-gray-900">{fmtDateLong(toIsoDate(selectedDate))}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <FormSelect
              id="att-filter-class"
              label="Class"
              value={filterClassId}
              onValueChange={(v) => setFilterClassId(v)}
              placeholder="All classes"
              options={[{ value: '', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FormSelect
              id="att-filter-section"
              label="Section"
              value={filterSectionId}
              onValueChange={(v) => setFilterSectionId(v)}
              placeholder={filterClassId ? 'All sections' : 'Select class first'}
              options={[{ value: '', label: 'All sections' }, ...filterSections]}
            />
          </div>

          {status === 'succeeded' && filteredItems.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 p-3 rounded-lg bg-red-50 border border-red-100">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">{totalAbsent}</span> student{totalAbsent !== 1 ? 's' : ''} absent across{' '}
                  <span className="font-semibold">{filteredItems.length}</span> section{filteredItems.length !== 1 ? 's' : ''}
                </p>
              </div>
              {unsentSections.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <div
                    className="flex h-10 w-full sm:w-36 items-center justify-center rounded-md border border-green-200 bg-green-50 px-3 text-sm font-medium text-green-800"
                    aria-label="Notification channel"
                  >
                    WhatsApp
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setBulkDialogOpen(true)}
                    className="w-full sm:w-auto whitespace-nowrap"
                    disabled={NOTIFICATIONS_SEND_DISABLED || sendingStatus === 'loading'}
                    title={NOTIFICATIONS_SEND_DISABLED ? NOTIFICATIONS_SEND_DISABLED_TITLE : undefined}
                  >
                    <Send className="h-4 w-4 mr-1.5 shrink-0" />
                    Send Unsent ({unsentSections.length})
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden sm:table-cell">Section</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Total Students</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === 'loading' ? (
                    <TableSkeletonRows columns={6} rows={5} />
                  ) : paginatedItems.length === 0 ? (
                    <TableEmptyRow
                      colSpan={6}
                      icon={Calendar}
                      title="No absence records found"
                      hint={
                        filterClassId || filterSectionId
                          ? 'Try changing the filters or select a different date'
                          : 'Select a different date or check if attendance has been taken'
                      }
                    />
                  ) : (
                    paginatedItems.map((row) => (
                      <TableRow key={`${row.class_id}-${row.section_id || 'all'}`}>
                        <TableCell className="font-medium">
                          {row.class_name}
                          {row.section_code && <span className="sm:hidden text-gray-500"> — {row.section_code}</span>}
                        </TableCell>
                        <TableCell className="text-gray-600 hidden sm:table-cell">{row.section_code || '\u2014'}</TableCell>
                        <TableCell className="text-right text-gray-700 hidden sm:table-cell">{row.total_students}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-red-600">{row.absent_count}</span>
                        </TableCell>
                        <TableCell>
                          {row.notification_processing ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                              Processing
                            </Badge>
                          ) : row.notification_status === 'failed' ? (
                            <Badge variant="secondary" className="bg-red-50 text-red-700">
                              Failed
                            </Badge>
                          ) : row.notification_partial ? (
                            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                              Partial
                            </Badge>
                          ) : row.notification_sent ? (
                            <Badge variant="secondary" className="bg-green-50 text-green-700">
                              Sent
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                              Not sent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetail(row)}
                            disabled={row.absent_count === 0}
                          >
                            <Eye className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">View & Notify</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {filteredItems.length > 0 && (
            <TablePagination
              selectId="att-notif-page-size"
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
      <BulkSendConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        channel={bulkChannel}
        unsentSections={unsentSections}
        schoolName={schoolName}
        date={toIsoDate(selectedDate)}
        sending={sendingStatus === 'loading'}
        onConfirm={handleBulkSend}
      />
    </div>
  );
}
