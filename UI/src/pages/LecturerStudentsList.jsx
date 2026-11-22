import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Loader2 } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { toast } from 'sonner';

import { plainSectionLabel, useClassSectionOptions } from '../features/classes/useClasses';
import {
  fetchLecturerStudentsThunk,
  fetchStudentProgressReportThunk,
} from '../features/lecturerStudents/lecturerStudentsSlice';
import {
  DEFAULT_PROGRESS_REPORT_FILTERS,
  exportStudentProgressPdf,
} from '../utils/studentProgressReport';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { FormSelect } from '../components/common/FormSelect';
import { PageHeader } from '../components/common/PageHeader';
import { TablePagination } from '../components/common/TablePagination';
import { usePagedRows } from '../hooks/usePagedRows';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export function LecturerStudentsList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const students = useSelector((s) => s.lecturerStudents.list);
  const studentsStatus = useSelector((s) => s.lecturerStudents.listStatus);
  const studentsError = useSelector((s) => s.lecturerStudents.listError);

  const [searchQuery, setSearchQuery] = useState('');
  const [classId, setClassId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { classOptions, sectionOptions, classNameFor, sectionCodeFor } = useClassSectionOptions(classId, {
    formatSection: plainSectionLabel,
  });

  useEffect(() => {
    setSectionId('all');
    setPage(1);
    setHasLoaded(false);
  }, [classId]);

  const [rollNumber, setRollNumber] = useState('');
  const [exportingStudentId, setExportingStudentId] = useState(null);
  const canLoad = rollNumber.trim() !== '' || classId !== 'all';
  const showStudentsCard = hasLoaded && studentsStatus === 'succeeded';

  const loadStudents = async () => {
    if (!canLoad) {
      toast.error('Please select a class, or enter a roll number');
      return;
    }
    try {
      const params = {};
      if (rollNumber.trim()) {
        params.search = rollNumber.trim();
      }
      if (classId !== 'all') params.classId = classId;
      if (sectionId !== 'all') params.sectionId = sectionId;
      await dispatch(fetchLecturerStudentsThunk(params)).unwrap();
      setPage(1);
      setHasLoaded(true);
    } catch (e) {
      toast.error(String(e || 'Failed to load students'));
    }
  };

  const handleDownloadReportCard = async (student) => {
    const studentId = student?.id;
    if (!studentId || exportingStudentId) return;
    setExportingStudentId(studentId);
    try {
      const data = await dispatch(
        fetchStudentProgressReportThunk({
          studentId,
          from: DEFAULT_PROGRESS_REPORT_FILTERS.from,
          to: DEFAULT_PROGRESS_REPORT_FILTERS.to,
          examTypeId: DEFAULT_PROGRESS_REPORT_FILTERS.examTypeId,
        })
      ).unwrap();
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      if (!sections.length) {
        toast.error('No completed exam results found for this student.');
        return;
      }
      await exportStudentProgressPdf({
        student,
        className: classNameFor(student.class_id),
        sectionLabel: student.section_id ? sectionCodeFor(student.section_id) : '',
        fromDate: DEFAULT_PROGRESS_REPORT_FILTERS.from,
        toDate: DEFAULT_PROGRESS_REPORT_FILTERS.to,
        sections,
      });
      toast.success('Progress report downloaded.');
    } catch (err) {
      toast.error(String(err ?? 'Failed to export progress report'));
    } finally {
      setExportingStudentId(null);
    }
  };

  const filtered = useMemo(() => {
    // Server already filters by search; keep client-side filter as a quick UX improvement for roll/name.
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter((s) => {
      const hay = `${String(s.roll_number ?? '')} ${[s.first_name, s.last_name].filter(Boolean).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [students, searchQuery]);

  const { totalCount, totalPages, currentPage, pageRows: paged } = usePagedRows(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"      />

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormSelect
              id="lect-stu-class"
              label="Class"
              value={classId}
              onValueChange={setClassId}
              options={[{ value: 'all', label: 'Select class…' }, ...classOptions]}
              placeholder="Class"
            />
            <FormSelect
              id="lect-stu-section"
              label="Section"
              value={sectionId}
              onValueChange={setSectionId}
              options={[{ value: 'all', label: 'All sections' }, ...sectionOptions]}
              placeholder={classId && classId !== 'all' ? 'Section' : 'Select class first'}
            />
            <div className="space-y-2">
              <label htmlFor="lect-stu-roll" className="text-sm font-medium text-gray-700">Roll Number</label>
              <Input
                id="lect-stu-roll"
                placeholder="Search by roll number"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canLoad) loadStudents(); }}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={loadStudents} disabled={!canLoad || studentsStatus === 'loading'}>
                {studentsStatus === 'loading' ? 'Loading…' : 'Load students'}
              </Button>
            </div>
          </div>

          {studentsError ? <div className="text-sm text-red-600">{String(studentsError)}</div> : null}
        </CardContent>
      </Card>

      {showStudentsCard ? (
        <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-lg">Students</CardTitle>            </div>
            <div className="w-full sm:w-[320px]">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <SearchInput
                className="mt-2"
                placeholder="Name or roll number"
                value={searchQuery}
                onValueChange={(v) => {
                  setSearchQuery(v);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {studentsStatus === 'succeeded' && totalCount === 0 ? (
            <div className="text-sm text-gray-600">No students found for this filter.</div>
          ) : null}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsStatus !== 'succeeded' ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-gray-500"
                      >
                        {studentsStatus === 'loading' ? 'Loading students…' : 'Select filters and load students.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((student) => (
                      <TableRow key={String(student.id)}>
                        <TableCell className="font-medium">
                          {student.roll_number ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                              {(student.first_name || 'S').charAt(0)}
                            </div>
                            <span>
                              {[student.first_name, student.last_name].filter(Boolean).join(' ') || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{classNameFor(student.class_id)}</TableCell>
                        <TableCell>{student.section_id ? sectionCodeFor(student.section_id) : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                navigate(`/staff/students/${String(student.id)}`)
                              }
                              aria-label="View student"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReportCard(student)}
                              disabled={exportingStudentId != null}
                              aria-label="Download report card"
                              title="Download report card"
                            >
                              {exportingStudentId === student.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
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

          {studentsStatus === 'succeeded' ? (
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
          ) : null}
        </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
