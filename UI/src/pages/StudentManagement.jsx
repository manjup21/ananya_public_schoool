import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Plus, Download } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { useClasses } from '../features/classes/useClasses';
import {
  createStudentThunk,
  deleteStudentThunk,
  deleteStudentPhotoThunk,
  fetchStudentByIdThunk,
  fetchStudentsThunk,
  updateStudentThunk,
  uploadStudentPhotoThunk,
} from '../features/students/studentsSlice';
import { toast } from 'sonner';
import { FormSelect } from '../components/common/FormSelect';
import { TablePagination } from '../components/common/TablePagination';
import { usePagedRows } from '../hooks/usePagedRows';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { Spinner } from '../components/ui/spinner';
import { StudentFormFields } from './studentManagement/StudentFormFields';
import { StudentsTable } from './studentManagement/StudentsTable';
import { StudentViewDialog } from './studentManagement/StudentViewDialog';
import {
  createEmptyStudentForm,
  fromStudentApi,
  toStudentPayload,
  validateStudentForm,
  validateStudentPhotoFile,
} from './studentManagement/studentFormHelpers';
import {
  buildStudentExportFilterLabel,
  filterStudentsForExport,
} from './studentManagement/studentExportHelpers';
import { exportStudentsExcel, exportStudentsPdf } from '../utils/studentExport';

export function StudentManagement() {
  const dispatch = useDispatch();
  const { classes } = useClasses();
  const students = useSelector((s) => s.students.items);
  const studentsStatus = useSelector((s) => s.students.status);
  const selectedStudent = useSelector((s) => s.students.selected);
  const selectedStudentStatus = useSelector((s) => s.students.selectedStatus);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState(createEmptyStudentForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

  const resetForm = () => {
    setForm((prev) => {
      if (prev.photoPreviewUrl) URL.revokeObjectURL(prev.photoPreviewUrl);
      return createEmptyStudentForm();
    });
  };

  const syncStudentPhoto = async (studentId, currentForm) => {
    if (currentForm.photoFile) {
      const photoErr = validateStudentPhotoFile(currentForm.photoFile);
      if (photoErr) throw new Error(photoErr);
      await dispatch(
        uploadStudentPhotoThunk({ studentId, file: currentForm.photoFile })
      ).unwrap();
      return;
    }
    if (currentForm.removeExistingPhoto && currentForm.existingPhotoPath) {
      await dispatch(deleteStudentPhotoThunk(studentId)).unwrap();
    }
  };

  useEffect(() => {
    if (studentsStatus === 'idle') dispatch(fetchStudentsThunk({}));
  }, [dispatch, studentsStatus]);

  useEffect(() => {
    // Client-side pagination only: reset page when filters/search change.
    setPage(1);
  }, [searchQuery, selectedClassFilter, selectedSectionFilter, pageSize]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId),
    [classes, form.classId]
  );
  const classSections = selectedClass?.sections || [];

  const selectedFilterClass = useMemo(
    () => classes.find((c) => c.id === selectedClassFilter),
    [classes, selectedClassFilter]
  );
  const filterSections = selectedFilterClass?.sections || [];

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleCreateStudent = async () => {
    const msg = validateStudentForm(form, { classSections });
    if (msg) return toast.error(msg);
    const photoErr = validateStudentPhotoFile(form.photoFile);
    if (photoErr) return toast.error(photoErr);

    setSaving(true);
    try {
      const created = await dispatch(createStudentThunk(toStudentPayload(form))).unwrap();
      const studentId = created?.id;
      if (studentId && form.photoFile) {
        try {
          await syncStudentPhoto(studentId, form);
        } catch (photoErr2) {
          toast.warning(
            typeof photoErr2 === 'string'
              ? `Student saved, but photo failed: ${photoErr2}`
              : `Student saved, but photo failed: ${photoErr2?.message || 'upload error'}`
          );
          setIsCreateDialogOpen(false);
          resetForm();
          dispatch(fetchStudentsThunk({}));
          return;
        }
      }
      toast.success(`Student "${[form.firstName, form.lastName].filter(Boolean).join(' ')}" added successfully!`);
      setIsCreateDialogOpen(false);
      resetForm();
      dispatch(fetchStudentsThunk({}));
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to create student');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (student) => {
    setEditingStudentId(student?.id);
    setIsEditDialogOpen(true);
    resetForm();
    try {
      const full = await dispatch(fetchStudentByIdThunk(student.id)).unwrap();
      setForm(fromStudentApi(full));
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to load student');
    }
  };

  const openView = async (student) => {
    setViewingStudentId(student?.id);
    setIsViewDialogOpen(true);
    try {
      await dispatch(fetchStudentByIdThunk(student.id)).unwrap();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to load student');
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudentId) return;
    const msg = validateStudentForm(form, { classSections });
    if (msg) return toast.error(msg);
    const photoErr = validateStudentPhotoFile(form.photoFile);
    if (photoErr) return toast.error(photoErr);

    setSaving(true);
    try {
      await dispatch(
        updateStudentThunk({
          studentId: editingStudentId,
          payload: toStudentPayload(form),
        })
      ).unwrap();
      try {
        await syncStudentPhoto(editingStudentId, form);
      } catch (photoErr2) {
        toast.warning(
          typeof photoErr2 === 'string'
            ? `Student updated, but photo failed: ${photoErr2}`
            : `Student updated, but photo failed: ${photoErr2?.message || 'upload error'}`
        );
        setIsEditDialogOpen(false);
        setEditingStudentId(null);
        resetForm();
        dispatch(fetchStudentsThunk({}));
        return;
      }
      toast.success('Student updated');
      setIsEditDialogOpen(false);
      setEditingStudentId(null);
      resetForm();
      dispatch(fetchStudentsThunk({}));
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = useMemo(
    () =>
      filterStudentsForExport(students, {
        searchQuery,
        classId: selectedClassFilter,
        sectionId: selectedSectionFilter,
      }),
    [students, searchQuery, selectedClassFilter, selectedSectionFilter]
  );

  const exportFilterLabel = useMemo(
    () =>
      buildStudentExportFilterLabel({
        searchQuery,
        classId: selectedClassFilter,
        sectionId: selectedSectionFilter,
        classes,
      }),
    [searchQuery, selectedClassFilter, selectedSectionFilter, classes]
  );

  const { totalCount, totalPages, currentPage, pageRows: paginatedStudents } = usePagedRows(
    filteredStudents,
    page,
    pageSize
  );

  const openDeleteConfirm = (student) => {
    setDeletingStudent(student);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingStudent?.id) return;
    try {
      await dispatch(deleteStudentThunk(deletingStudent.id)).unwrap();
      toast.success('Student deleted');
      setIsDeleteDialogOpen(false);
      setDeletingStudent(null);
      dispatch(fetchStudentsThunk({}));
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Delete failed');
    }
  };

  const handleExportExcel = async () => {
    if (!filteredStudents.length) {
      toast.error('No students to export for the current filters');
      return;
    }
    setExporting('excel');
    try {
      await exportStudentsExcel({
        students: filteredStudents,
        filterLabel: exportFilterLabel,
      });
      toast.success(`Exported ${filteredStudents.length} student(s) to Excel`);
    } catch (e) {
      toast.error(String(e?.message || e || 'Excel export failed'));
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = () => {
    if (!filteredStudents.length) {
      toast.error('No students to export for the current filters');
      return;
    }
    setExporting('pdf');
    try {
      exportStudentsPdf({
        students: filteredStudents,
        filterLabel: exportFilterLabel,
      });
      toast.success(`Exported ${filteredStudents.length} student(s) to PDF`);
    } catch (e) {
      toast.error(String(e?.message || e || 'PDF export failed'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Management"        actions={
          <>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto" type="button">
                  <Plus className="h-4 w-4 shrink-0" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                  <DialogDescription>
                    Enter student details to add them to the system
                  </DialogDescription>
                </DialogHeader>
                <StudentFormFields
                  form={form}
                  updateForm={updateForm}
                  classes={classes}
                  classSections={classSections}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateStudent} disabled={saving}>
                    {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Add Student'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingStudentId(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student details</DialogDescription>
          </DialogHeader>
          {selectedStudentStatus === 'loading' ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : null}
          <StudentFormFields
            form={form}
            updateForm={updateForm}
            classes={classes}
            classSections={classSections}
            idPrefix="edit"
            studentId={editingStudentId}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateStudent} disabled={saving}>
              {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StudentViewDialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) setViewingStudentId(null);
        }}
        student={selectedStudent}
        classes={classes}
        status={selectedStudentStatus}
        viewingStudentId={viewingStudentId}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All Students</CardTitle>
              <div className="mt-1 text-sm text-gray-600">
                Total: <span className="font-medium text-gray-900">{totalCount}</span>
                {totalCount !== (Array.isArray(students) ? students.length : 0) ? (
                  <span className="text-gray-500">
                    {' '}
                    (of {Array.isArray(students) ? students.length : 0} loaded)
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!filteredStudents.length || exporting != null}
                onClick={handleExportExcel}
              >
                <Download className="h-4 w-4" />
                {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={!filteredStudents.length || exporting != null}
                onClick={handleExportPdf}
              >
                <Download className="h-4 w-4" />
                {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <SearchInput
              placeholder="Search by name, roll number, guardian phone..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormSelect
                id="filter-class"
                label="Class"
                value={selectedClassFilter}
                onValueChange={(v) => {
                  setSelectedClassFilter(v);
                  setSelectedSectionFilter('');
                }}
                placeholder="All classes"
                options={[{ value: '', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <FormSelect
                id="filter-section"
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
          <StudentsTable
            students={paginatedStudents}
            classes={classes}
            status={studentsStatus}
            onView={openView}
            onEdit={openEdit}
            onDelete={openDeleteConfirm}
          />
          <TablePagination
            selectId="students-page-size"
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

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete student?"
        description={
          deletingStudent
            ? `This will permanently delete "${[deletingStudent.first_name, deletingStudent.last_name].filter(Boolean).join(' ')}" (roll: ${deletingStudent.roll_number ?? ''}). Students with fee or exam records cannot be deleted.`
            : 'This will permanently delete the student. Students with fee or exam records cannot be deleted.'
        }
        confirmText="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
