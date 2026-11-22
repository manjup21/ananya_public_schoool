import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { FormSelect } from '../../components/common/FormSelect';
import { TablePagination } from '../../components/common/TablePagination';
import { usePagedRows } from '../../hooks/usePagedRows';
import { classSectionLabel, fmtDate } from '../examinationManagement/examinationHelpers';

export function MarksViewPick({
  classes,
  examTypes = [],
  examTypesStatus = 'idle',
  examinations,
  examinationsStatus,
  examinationsError,
  onSelectExam,
}) {
  const [search, setSearch] = useState('');
  const [examTypeId, setExamTypeId] = useState('all');
  const [classId, setClassId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, examTypeId, classId, sectionId, pageSize]);

  const sectionOptions = useMemo(() => {
    if (!classId || classId === 'all') return [];
    const cls = (classes ?? []).find((c) => String(c.id) === String(classId));
    const secs = Array.isArray(cls?.sections) ? cls.sections : [];
    return secs.map((s) => ({ value: String(s.id), label: s.section ?? 'Section' }));
  }, [classId, classes]);

  const examTypeOptions = useMemo(
    () => [{ value: 'all', label: 'All types' }, ...examTypes.map((t) => ({ value: String(t.id), label: t.name ?? 'Type' }))],
    [examTypes]
  );

  const filtered = useMemo(() => {
    const q = String(search ?? '').trim().toLowerCase();
    return (examinations ?? []).filter((e) => {
        if (String(e.exam_status ?? '').toLowerCase() !== 'completed') return false;
        if (examTypeId !== 'all' && String(e.exam_type_id ?? '') !== String(examTypeId)) return false;
        if (classId !== 'all' && String(e.class_id) !== String(classId)) return false;
        if (sectionId !== 'all') {
          const want = String(sectionId);
          const secId = String(e.section_id ?? '');
          if (secId === want) return true;
          const ids = Array.isArray(e?.section_ids) ? e.section_ids.filter(Boolean).map(String) : [];
          if (ids.length) return ids.includes(want);
          return e.section_id == null || String(e.section_id).trim() === '';
        }
        if (!q) return true;
        const hay = `${e.test_name ?? ''} ${e.exam_type_name ?? ''}`.toLowerCase();
        return hay.includes(q);
      }).sort((a, b) => String(b.exam_date ?? '').localeCompare(String(a.exam_date ?? '')));
  }, [examinations, search, examTypeId, classId, sectionId]);

  const { totalCount, totalPages, currentPage, pageRows: paged } = usePagedRows(filtered, page, pageSize);

  const classOptions = useMemo(() => {
    return (classes ?? []).map((c) => ({ value: String(c.id), label: c.name ?? 'Class' }));
  }, [classes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">View / export results</h2>      </div>

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Exam name, type…" />
            </div>
            <FormSelect
              id="results-exam-type"
              label="Type"
              value={examTypeId}
              onValueChange={(v) => setExamTypeId(v)}
              options={examTypeOptions}
              placeholder={examTypesStatus === 'loading' ? 'Loading…' : 'All types'}
            />
            <FormSelect
              id="results-class"
              label="Class"
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSectionId('all');
              }}
              options={[{ value: 'all', label: 'All' }, ...classOptions]}
              placeholder="All"
            />
            <FormSelect
              id="results-section"
              label="Section"
              value={sectionId}
              onValueChange={setSectionId}
              options={[{ value: 'all', label: 'All' }, ...sectionOptions]}
              placeholder={classId && classId !== 'all' ? 'All' : 'Select class first'}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Exams</CardTitle>        </CardHeader>
        <CardContent>
          {examinationsStatus === 'loading' ? (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[200px]">Exam</th>
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[160px]">Type</th>
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[140px]">Class / Section</th>
                      <th className="px-4 py-3 font-medium text-gray-900 w-[130px]">Date</th>
                      <th className="px-4 py-3 font-medium text-gray-900 w-[140px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3 text-right"><Skeleton className="h-7 w-14 ml-auto rounded-md" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : examinationsError ? (
            <div className="text-sm text-red-600">{String(examinationsError)}</div>
          ) : totalCount === 0 ? (
            <div className="text-sm text-gray-600">No exams found.</div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[200px]">Exam</th>
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[160px]">Type</th>
                      <th className="px-4 py-3 font-medium text-gray-900 min-w-[140px]">Class / Section</th>
                      <th className="px-4 py-3 font-medium text-gray-900 w-[130px]">Date</th>
                      <th className="px-4 py-3 font-medium text-gray-900 w-[140px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((e) => (
                      <tr key={e.id} className="border-t border-gray-200">
                        <td className="px-4 py-3 font-medium text-gray-900">{e.test_name}</td>
                        <td className="px-4 py-3 text-gray-600">{e.exam_type_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{classSectionLabel(e, classes)}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {fmtDate(e.exam_date)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" size="sm" onClick={() => onSelectExam?.(e.id)}>
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <TablePagination
            className="mt-4"
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

