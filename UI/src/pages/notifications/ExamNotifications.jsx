import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
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
import { Eye, FileText } from 'lucide-react';
import { SearchInput } from '../../components/common/SearchInput';
import { useClasses } from '../../features/classes/useClasses';
import { fetchExamNotificationListThunk } from '../../features/notifications/notificationsSlice';
import { fmtDate } from './notificationHelpers';

export function ExamNotifications() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, status } = useSelector((s) => s.notifications.examList);
  const { classes } = useClasses();

  const [searchName, setSearchName] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    dispatch(fetchExamNotificationListThunk());
  }, [dispatch]);

  useEffect(() => { setPage(1); }, [searchName, filterClassId, filterSectionId, pageSize]);
  useEffect(() => { setFilterSectionId(''); }, [filterClassId]);

  const filterSections = useMemo(() => {
    if (!filterClassId) return [];
    const cls = classes.find((c) => c.id === filterClassId);
    return (cls?.sections || []).map((s) => ({ value: s.id, label: s.section }));
  }, [classes, filterClassId]);

  const filteredItems = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return items.filter((exam) => {
      if (q && !exam.test_name?.toLowerCase().includes(q)) return false;
      if (filterClassId && exam.class_id !== filterClassId) return false;
      if (filterSectionId && exam.section_id !== filterSectionId) return false;
      return true;
    });
  }, [items, searchName, filterClassId, filterSectionId]);

  const { totalCount, totalPages, currentPage, pageRows: paginatedItems } = usePagedRows(filteredItems, page, pageSize);

  const handleViewDetail = (examId) => {
    navigate(`/admin/notifications/exams/${examId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Notifications"      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label htmlFor="exam-search-name">Exam Name</Label>
              <SearchInput
                size="sm"
                id="exam-search-name"
                placeholder="Search exam name…"
                value={searchName}
                onValueChange={setSearchName}
              />
            </div>
            <FormSelect
              id="exam-filter-class"
              label="Class"
              value={filterClassId}
              onValueChange={(v) => setFilterClassId(v)}
              placeholder="All classes"
              options={[{ value: '', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FormSelect
              id="exam-filter-section"
              label="Section"
              value={filterSectionId}
              onValueChange={(v) => setFilterSectionId(v)}
              placeholder={filterClassId ? 'All sections' : 'Select class first'}
              options={[{ value: '', label: 'All sections' }, ...filterSections]}
            />
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Exam Name</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="hidden sm:table-cell">Section</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Results</TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === 'loading' ? (
                    <TableSkeletonRows columns={8} rows={5} />
                  ) : paginatedItems.length === 0 ? (
                    <TableEmptyRow
                      colSpan={8}
                      icon={FileText}
                      title="No exams found"
                      hint={
                        searchName || filterClassId || filterSectionId
                          ? 'Try changing the search or filters'
                          : 'No completed exams with results found'
                      }
                    />
                  ) : (
                    paginatedItems.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.test_name}</TableCell>
                        <TableCell className="text-gray-600 hidden md:table-cell">{exam.exam_type_name || '\u2014'}</TableCell>
                        <TableCell className="text-gray-700">{exam.class_name}</TableCell>
                        <TableCell className="text-gray-600 hidden sm:table-cell">{exam.section_label || '\u2014'}</TableCell>
                        <TableCell className="text-gray-600 hidden sm:table-cell">{fmtDate(exam.exam_date)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-gray-900">{exam.result_count ?? 0}</span>
                        </TableCell>
                        <TableCell>
                          {exam.notification_processing ? (
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                              Processing
                            </Badge>
                          ) : exam.notification_status === 'failed' ? (
                            <Badge variant="secondary" className="bg-red-50 text-red-700">
                              Failed
                            </Badge>
                          ) : exam.notification_partial ? (
                            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                              Partial
                            </Badge>
                          ) : exam.notification_sent ? (
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
                            onClick={() => handleViewDetail(exam.id)}
                            disabled={(exam.result_count ?? 0) === 0}
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
              selectId="exam-notif-page-size"
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
    </div>
  );
}
