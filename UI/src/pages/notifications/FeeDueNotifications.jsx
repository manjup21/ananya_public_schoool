import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
import { Eye, IndianRupee, Wallet } from 'lucide-react';
import { useClasses } from '../../features/classes/useClasses';
import { fetchFeeDueSummaryThunk } from '../../features/notifications/notificationsSlice';
import { fmtDateTime } from './notificationHelpers';

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function FeeDueNotifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { classes } = useClasses();
  const { items, status } = useSelector((s) => s.notifications.feeDueList);

  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [academicYear] = useState(currentAcademicYear());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (academicYear) dispatch(fetchFeeDueSummaryThunk(academicYear));
  }, [dispatch, academicYear]);

  useEffect(() => {
    setPage(1);
  }, [filterClassId, filterSectionId, pageSize]);
  useEffect(() => {
    setFilterSectionId('');
  }, [filterClassId]);

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
    const sectionSegment = row.section_id ? `/${row.section_id}` : '';
    navigate(
      `/admin/notifications/fees/${row.class_id}${sectionSegment}?year=${encodeURIComponent(academicYear)}`
    );
  };

  const loading = status === 'loading' || status === 'idle';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Due Notifications"      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label htmlFor="fee-notif-year">Academic year</Label>
              <div
                id="fee-notif-year"
                className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800"
              >
                {academicYear}
              </div>
            </div>
            <FormSelect
              id="fee-filter-class"
              label="Class"
              value={filterClassId}
              onValueChange={(v) => setFilterClassId(v)}
              placeholder="All classes"
              options={[
                { value: '', label: 'All classes' },
                ...classes.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FormSelect
              id="fee-filter-section"
              label="Section"
              value={filterSectionId}
              onValueChange={(v) => setFilterSectionId(v)}
              placeholder={filterClassId ? 'All sections' : 'Select class first'}
              options={[{ value: '', label: 'All sections' }, ...filterSections]}
            />
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden sm:table-cell">Section</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="hidden lg:table-cell">Last sent</TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeletonRows columns={6} rows={6} />
                  ) : paginatedItems.length === 0 ? (
                    <TableEmptyRow
                      colSpan={6}
                      icon={Wallet}
                      title="No outstanding fee dues"
                      hint={
                        filterClassId || filterSectionId
                          ? 'Try changing the filters'
                          : 'No students with balance greater than zero for this year'
                      }
                    />
                  ) : (
                    paginatedItems.map((row) => {
                      const rowKey = `${row.class_id}-${row.section_id || 'all'}`;
                      return (
                        <TableRow key={rowKey}>
                          <TableCell className="font-medium">{row.class_name}</TableCell>
                          <TableCell className="text-gray-600 hidden sm:table-cell">
                            {row.section_label || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-gray-900">
                              {row.outstanding_count ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm hidden lg:table-cell">
                            {row.last_sent_at ? fmtDateTime(row.last_sent_at) : '—'}
                          </TableCell>
                          <TableCell>
                            {row.notification_processing ? (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                Processing
                              </Badge>
                            ) : row.notification_failed ? (
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
                              disabled={(row.outstanding_count ?? 0) === 0}
                            >
                              <Eye className="h-4 w-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">View & Notify</span>
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

          {filteredItems.length > 0 && (
            <TablePagination
              selectId="fee-notif-page-size"
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

      <div className="flex items-start gap-2 text-sm text-gray-500">
        <IndianRupee className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Only students with outstanding balance are listed. Due date is chosen when you send and is
          used only in the WhatsApp message.
        </p>
      </div>
    </div>
  );
}
