import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { FileDown, FilePlus2 } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { FormSelect } from '../components/common/FormSelect';
import { PageHeader } from '../components/common/PageHeader';
import { TablePagination } from '../components/common/TablePagination';
import { TableEmptyRow } from '../components/common/TableEmptyRow';
import { usePagedRows } from '../hooks/usePagedRows';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import { useClasses } from '../features/classes/useClasses';
import { fetchStudentByIdThunk, fetchStudentsThunk } from '../features/students/studentsSlice';
import { filterStudentsForExport } from './studentManagement/studentExportHelpers';
import { exportStudyCertificatePdf } from '../utils/studyCertificatePdf';
import { exportTransferCertificatePdf } from '../utils/transferCertificatePdf';
import { StudyCertificateDialog } from './downloads/StudyCertificateDialog';
import { TransferCertificateDialog } from './downloads/TransferCertificateDialog';

function CertificateActionButtons({
  student,
  studyBusy,
  tcLoading,
  onStudy,
  onTransfer,
  layout = 'grid',
}) {
  const grid = layout === 'grid';
  return (
    <div className={grid ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap justify-end gap-2'}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={grid ? 'h-9 w-full justify-center gap-1.5 px-2' : 'gap-2'}
        disabled={studyBusy}
        onClick={() => onStudy(student)}
        title="Generate study certificate"
      >
        <FileDown className="h-4 w-4 shrink-0" />
        {studyBusy ? '…' : 'Study'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={grid ? 'h-9 w-full justify-center gap-1.5 px-2' : 'gap-2'}
        disabled={tcLoading}
        onClick={() => onTransfer(student)}
        title="Generate transfer certificate"
      >
        <FileDown className="h-4 w-4 shrink-0" />
        Transfer
      </Button>
    </div>
  );
}

export function DownloadsPage() {
  const dispatch = useDispatch();
  const { classes } = useClasses();
  const students = useSelector((s) => s.students.items);
  const studentsStatus = useSelector((s) => s.students.status);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [generatingId, setGeneratingId] = useState(null);

  const [studyNewOpen, setStudyNewOpen] = useState(false);
  const [studyNewDownloading, setStudyNewDownloading] = useState(false);
  const [studyInitial, setStudyInitial] = useState(null);

  const [tcOpen, setTcOpen] = useState(false);
  const [tcManualMode, setTcManualMode] = useState(false);
  const [tcStudent, setTcStudent] = useState(null);
  const [tcClassName, setTcClassName] = useState('');
  const [tcLoading, setTcLoading] = useState(false);
  const [tcDownloading, setTcDownloading] = useState(false);

  useEffect(() => {
    if (studentsStatus === 'idle') dispatch(fetchStudentsThunk({}));
  }, [dispatch, studentsStatus]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedClassFilter, selectedSectionFilter, pageSize]);

  const selectedFilterClass = useMemo(
    () => classes.find((c) => c.id === selectedClassFilter),
    [classes, selectedClassFilter]
  );
  const filterSections = selectedFilterClass?.sections || [];

  const filteredStudents = useMemo(
    () =>
      filterStudentsForExport(students, {
        searchQuery,
        classId: selectedClassFilter,
        sectionId: selectedSectionFilter,
      }),
    [students, searchQuery, selectedClassFilter, selectedSectionFilter]
  );

  const { totalCount, totalPages, currentPage, pageRows: paginatedStudents } = usePagedRows(
    filteredStudents,
    page,
    pageSize
  );

  const resolveClassSection = (student) => {
    const klass = classes.find((c) => c.id === student.class_id);
    const sectionName = student.section_id
      ? klass?.sections?.find((s) => s.id === student.section_id)?.section ?? ''
      : '';
    return { className: klass?.name ?? '', sectionName };
  };

  const handleGenerateStudyCertificate = async (student) => {
    if (!student?.id) return;
    setGeneratingId(student.id);
    try {
      const full = await dispatch(fetchStudentByIdThunk(student.id)).unwrap();
      const { className, sectionName } = resolveClassSection(full);
      setStudyInitial({
        key: full.id,
        first_name: full.first_name ?? '',
        last_name: full.last_name ?? '',
        gender: full.gender ?? '',
        date_of_birth: full.date_of_birth ? String(full.date_of_birth).slice(0, 10) : '',
        father_name: full.father_name ?? '',
        enrolment_number: full.roll_number ?? '',
        toClass: [className, sectionName].filter(Boolean).join(' - '),
      });
      setStudyNewOpen(true);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to load student');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleStudyNewDownload = async ({ student, details }) => {
    setStudyNewDownloading(true);
    try {
      await exportStudyCertificatePdf({ student, details });
      toast.success('Study certificate downloaded');
      setStudyNewOpen(false);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to generate study certificate');
    } finally {
      setStudyNewDownloading(false);
    }
  };

  const openTransferDialog = async (student) => {
    if (!student?.id) return;
    setTcManualMode(false);
    setTcLoading(true);
    setTcOpen(true);
    try {
      const full = await dispatch(fetchStudentByIdThunk(student.id)).unwrap();
      const { className } = resolveClassSection(full);
      setTcStudent(full);
      setTcClassName(className);
    } catch (e) {
      setTcOpen(false);
      setTcStudent(null);
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to load student');
    } finally {
      setTcLoading(false);
    }
  };

  const openTransferNewDataDialog = () => {
    setTcManualMode(true);
    setTcStudent(null);
    setTcClassName('');
    setTcOpen(true);
  };

  const handleTransferDownload = async (payload) => {
    if (!tcManualMode && !tcStudent) return;
    setTcDownloading(true);
    try {
      if (tcManualMode) {
        await exportTransferCertificatePdf({
          manualMode: true,
          manualStudent: payload.manualStudent,
          extras: payload.extras,
        });
      } else {
        await exportTransferCertificatePdf({
          student: tcStudent,
          className: tcClassName,
          extras: payload.extras,
        });
      }
      toast.success('Transfer certificate downloaded');
      setTcOpen(false);
      setTcStudent(null);
      setTcManualMode(false);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to generate transfer certificate');
    } finally {
      setTcDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Downloads"        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <p className="text-sm font-medium text-gray-700">Generate with new data</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-center gap-1.5 px-2 sm:w-auto"
                onClick={() => {
                  setStudyInitial(null);
                  setStudyNewOpen(true);
                }}
              >
                <FilePlus2 className="h-4 w-4 shrink-0" />
                Study
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-center gap-1.5 px-2 sm:w-auto"
                onClick={openTransferNewDataDialog}
              >
                <FilePlus2 className="h-4 w-4 shrink-0" />
                Transfer
              </Button>
            </div>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Certificates</CardTitle>
            <div className="mt-1 text-sm text-gray-600">
              Matching students:{' '}
              <span className="font-medium text-gray-900">{totalCount}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <SearchInput
              id="downloads-search"
              name="downloads-search"
              placeholder="Search by name, roll, or phone…"
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoComplete="off"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormSelect
                id="downloads-filter-class"
                label="Class"
                value={selectedClassFilter}
                onValueChange={(v) => {
                  setSelectedClassFilter(v);
                  setSelectedSectionFilter('');
                }}
                placeholder="All classes"
                options={[
                  { value: '', label: 'All classes' },
                  ...classes.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <FormSelect
                id="downloads-filter-section"
                label="Section"
                value={selectedSectionFilter}
                onValueChange={(v) => setSelectedSectionFilter(v)}
                placeholder={selectedClassFilter ? 'All sections' : 'Select class first'}
                options={[
                  { value: '', label: 'All sections' },
                  ...filterSections.map((s) => ({ value: s.id, label: s.section })),
                ]}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="md:hidden divide-y divide-gray-200">
              {studentsStatus === 'loading' ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : paginatedStudents.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No students found</p>
              ) : (
                paginatedStudents.map((student) => {
                  const { className, sectionName } = resolveClassSection(student);
                  const fullName = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
                  const busy = generatingId === student.id;
                  return (
                    <div key={student.id} className="space-y-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{fullName || '—'}</p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          Roll {student.roll_number}
                          {className ? ` · ${className}` : ''}
                          {sectionName ? ` - ${sectionName}` : ''}
                        </p>
                      </div>
                      <CertificateActionButtons
                        student={student}
                        studyBusy={busy}
                        tcLoading={tcLoading}
                        onStudy={handleGenerateStudyCertificate}
                        onTransfer={openTransferDialog}
                        layout="grid"
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Class / Section</TableHead>
                    <TableHead className="text-right min-w-68">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsStatus === 'loading' ? (
                    <TableSkeletonRows columns={4} rows={5} />
                  ) : paginatedStudents.length === 0 ? (
                    <TableEmptyRow colSpan={4}>No students found</TableEmptyRow>
                  ) : (
                    paginatedStudents.map((student) => {
                      const { className, sectionName } = resolveClassSection(student);
                      const fullName = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
                      const busy = generatingId === student.id;
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.roll_number}</TableCell>
                          <TableCell>{fullName || '—'}</TableCell>
                          <TableCell>
                            {className || '—'}
                            {sectionName ? ` - ${sectionName}` : ''}
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <CertificateActionButtons
                              student={student}
                              studyBusy={busy}
                              tcLoading={tcLoading}
                              onStudy={handleGenerateStudyCertificate}
                              onTransfer={openTransferDialog}
                              layout="flex"
                            />
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
            selectId="downloads-page-size"
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeSelectContentClassName="w-full min-w-[4.5rem]"
          />
        </CardContent>
      </Card>

      <StudyCertificateDialog
        open={studyNewOpen}
        onOpenChange={setStudyNewOpen}
        downloading={studyNewDownloading}
        onDownload={handleStudyNewDownload}
        initialValues={studyInitial}
      />

      <TransferCertificateDialog
        open={tcOpen}
        onOpenChange={(open) => {
          setTcOpen(open);
          if (!open) {
            setTcStudent(null);
            setTcClassName('');
            setTcManualMode(false);
          }
        }}
        student={tcStudent}
        className={tcClassName}
        manualMode={tcManualMode}
        downloading={tcDownloading || tcLoading}
        onDownload={handleTransferDownload}
      />
    </div>
  );
}
