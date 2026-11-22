import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FormSelect } from '../../components/common/FormSelect';
import { TablePagination } from '../../components/common/TablePagination';
import { TableEmptyRow } from '../../components/common/TableEmptyRow';
import { usePagedRows } from '../../hooks/usePagedRows';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { TableSkeletonRows } from '../../components/common/TableSkeletonRows';
import { SearchInput } from '../../components/common/SearchInput';
import { fetchExamTypesThunk } from '../../features/examTypes/examTypesSlice';
import { classSectionLabel, fmtDate } from '../examinationManagement/examinationHelpers';

export function EnterResultsPick({
  classes,
  examinations,
  examinationsStatus,
  examinationsError,
  onSelectExam,
}) {
  const dispatch = useDispatch();
  const examTypes = useSelector((s) => s.examTypes.items);
  const examTypesStatus = useSelector((s) => s.examTypes.status);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterExamTypeId, setFilterExamTypeId] = useState('all');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterSectionId, setFilterSectionId] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (examTypesStatus === 'idle') dispatch(fetchExamTypesThunk({ search: '' }));
  }, [dispatch, examTypesStatus]);

  useEffect(() => setFilterSectionId('all'), [filterClassId]);
  useEffect(() => setPage(1), [searchQuery, pageSize, filterExamTypeId, filterClassId, filterSectionId]);

  const classOptions = useMemo(
    () => [{ value: 'all', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))],
    [classes]
  );

  const examTypeFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All types' }, ...examTypes.map((t) => ({ value: t.id, label: t.name }))],
    [examTypes]
  );

  const sectionFilterOptions = useMemo(() => {
    if (filterClassId === 'all') return [{ value: 'all', label: 'All sections' }];
    const cls = classes.find((c) => c.id === filterClassId);
    const secs = cls?.sections ?? [];
    return [
      { value: 'all', label: 'All sections' },
      { value: 'whole', label: 'Whole class (no section)' },
      ...secs.map((s) => ({ value: s.id, label: s.section })),
    ];
  }, [filterClassId, classes]);

  const filtered = useMemo(() => {
    const list = Array.isArray(examinations) ? examinations : [];
    return list.filter((e) => {
      if (String(e?.exam_status ?? '').toLowerCase() !== 'scheduled') return false;
      if (filterExamTypeId !== 'all' && String(e.exam_type_id) !== String(filterExamTypeId)) return false;
      if (filterClassId !== 'all' && e.class_id !== filterClassId) return false;
      if (filterSectionId !== 'all') {
        if (filterSectionId === 'whole') {
          if (e.section_id != null && String(e.section_id).trim() !== '') return false;
          if (Array.isArray(e?.section_ids) && e.section_ids.length) return false;
        } else if (e.section_id !== filterSectionId) {
          const ids = Array.isArray(e?.section_ids) ? e.section_ids.filter(Boolean).map(String) : [];
          if (ids.length) {
            if (!ids.includes(String(filterSectionId))) return false;
          } else {
            // all-sections exam: include for any specific section filter
            if (!(e.section_id == null || String(e.section_id).trim() === '')) return false;
          }
        }
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const className = String(classes.find((c) => c.id === e.class_id)?.name ?? '').toLowerCase();
      const sectionName = String(classSectionLabel(e, classes)).toLowerCase();
      const subjectStr = (Array.isArray(e.subjects) ? e.subjects.map((s) => s.name).join(' ') : '').toLowerCase();
      return (
        String(e.test_name ?? '').toLowerCase().includes(q) ||
        String(e.exam_type_name ?? '').toLowerCase().includes(q) ||
        String(e.exam_status ?? '').toLowerCase().includes(q) ||
        className.includes(q) ||
        sectionName.includes(q) ||
        subjectStr.includes(q)
      );
    });
  }, [examinations, filterExamTypeId, filterClassId, filterSectionId, searchQuery, classes]);

  const { totalCount, totalPages, currentPage, pageRows: paginated } = usePagedRows(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Enter results</h2>      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Examinations</CardTitle>
            <div className="text-sm text-gray-600">
              Total: <span className="font-medium text-gray-900">{totalCount}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {examinationsStatus === 'failed' ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {examinationsError || 'Failed to load examinations'}
            </div>
          ) : null}

          <div className="mb-4">
            <SearchInput
              placeholder="Search by test, class, section, subject, status..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <FormSelect
              id="enter-results-filter-type"
              label="Type"
              value={filterExamTypeId}
              onValueChange={setFilterExamTypeId}
              options={examTypeFilterOptions}
              placeholder={examTypesStatus === 'loading' ? 'Loading…' : 'All types'}
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
            <FormSelect
              id="enter-results-filter-class"
              label="Class"
              value={filterClassId}
              onValueChange={setFilterClassId}
              options={classOptions}
              placeholder="Class"
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
            <FormSelect
              id="enter-results-filter-section"
              label="Section"
              value={filterSectionId}
              onValueChange={setFilterSectionId}
              options={sectionFilterOptions}
              placeholder="Section"
              contentClassName="min-w-[var(--radix-select-trigger-width)]"
            />
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Test</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Class / Section</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examinationsStatus === 'loading' ? (
                    <TableSkeletonRows columns={5} rows={5} />
                  ) : paginated.length === 0 ? (
                    <TableEmptyRow colSpan={5}>No examinations match your filters.</TableEmptyRow>
                  ) : (
                    paginated.map((e) => {
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.test_name}</TableCell>
                          <TableCell className="text-gray-600">
                            {e.exam_type_name ?? '—'}
                          </TableCell>
                          <TableCell className="text-gray-700">{classSectionLabel(e, classes)}</TableCell>
                          <TableCell className="text-gray-700 whitespace-nowrap">{fmtDate(e.exam_date)}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" onClick={() => onSelectExam(e.id)}>
                              Select
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

          <TablePagination
            selectId="enter-results-page-size"
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

