import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Plus, Pencil, Trash2, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { TableEmptyRow } from '../components/common/TableEmptyRow';
import { toast } from 'sonner';
import { cn } from '../components/ui/utils';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import { Spinner } from '../components/ui/spinner';
import {
  createClassThunk,
  createSectionThunk,
  deleteClassThunk,
  deleteSectionThunk,
  fetchClassesThunk,
  updateClassThunk,
  updateSectionThunk,
} from '../features/classes/classesSlice';
import {
  createSubjectThunk,
  deleteSubjectThunk,
  fetchSubjectsThunk,
  reorderSubjectsThunk,
  updateSubjectThunk,
} from '../features/subjects/subjectsSlice';
import {
  createExamTypeThunk,
  deleteExamTypeThunk,
  fetchExamTypesThunk,
  reorderExamTypesThunk,
  updateExamTypeThunk,
} from '../features/examTypes/examTypesSlice';

/** Shared cap for the two panels */
const panelHeightLg = 'lg:h-[min(25.2rem,calc(100svh-6rem))] lg:max-h-[min(25.2rem,calc(100svh-6rem))]';
const panelMaxStacked = 'max-h-[min(28rem,55svh)]';

export function ClassSectionManagement() {
  const dispatch = useDispatch();
  const { items: classes, status, error } = useSelector((s) => s.classes);
  const { items: subjects, status: subjectsStatus, error: subjectsError } = useSelector((s) => s.subjects);
  const { items: examTypes, status: examTypesStatus, error: examTypesError } = useSelector((s) => s.examTypes);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [classSearch, setClassSearch] = useState('');

  const [subjectSearch, setSubjectSearch] = useState('');
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [subjectNameError, setSubjectNameError] = useState('');
  const [subjectCodeError, setSubjectCodeError] = useState('');

  const [isEditSubjectOpen, setIsEditSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSubjectError, setEditSubjectError] = useState('');
  const [editSubjectCodeError, setEditSubjectCodeError] = useState('');

  const [isDeleteSubjectOpen, setIsDeleteSubjectOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const [examTypeSearch, setExamTypeSearch] = useState('');
  const [isCreateExamTypeOpen, setIsCreateExamTypeOpen] = useState(false);
  const [newExamTypeName, setNewExamTypeName] = useState('');
  const [examTypeNameError, setExamTypeNameError] = useState('');

  const [isEditExamTypeOpen, setIsEditExamTypeOpen] = useState(false);
  const [editingExamType, setEditingExamType] = useState(null);
  const [editExamTypeName, setEditExamTypeName] = useState('');
  const [editExamTypeError, setEditExamTypeError] = useState('');

  const [isDeleteExamTypeOpen, setIsDeleteExamTypeOpen] = useState(false);
  const [deletingExamType, setDeletingExamType] = useState(null);

  const [isCreateClassOpen, setIsCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [classNameError, setClassNameError] = useState('');

  const [isEditClassOpen, setIsEditClassOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassNameError, setEditClassNameError] = useState('');

  const [isDeleteClassOpen, setIsDeleteClassOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState(null);

  const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionNameError, setSectionNameError] = useState('');

  const [isEditSectionOpen, setIsEditSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editSectionCode, setEditSectionCode] = useState('');
  const [editSectionError, setEditSectionError] = useState('');

  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false);
  const [deletingSection, setDeletingSection] = useState(null);

  const [saving, setSaving] = useState(false);
  const [reorderingSubjects, setReorderingSubjects] = useState(false);
  const [reorderingExamTypes, setReorderingExamTypes] = useState(false);

  useEffect(() => {
    dispatch(fetchClassesThunk());
    dispatch(fetchSubjectsThunk({ search: '' }));
    dispatch(fetchExamTypesThunk({ search: '' }));
  }, [dispatch]);

  useEffect(() => {
    if (classes.length === 0) {
      setSelectedClassId(null);
      return;
    }
    if (!selectedClassId || !classes.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, classSearch]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const sectionsList = selectedClass?.sections ?? [];

  const resetCreateClass = () => {
    setNewClassName('');
    setClassNameError('');
  };

  const resetCreateSubject = () => {
    setNewSubjectName('');
    setNewSubjectCode('');
    setSubjectNameError('');
    setSubjectCodeError('');
  };

  const resetCreateSection = () => {
    setNewSectionName('');
    setSectionNameError('');
  };

  const handleCreateClass = async () => {
    const name = newClassName.trim();
    if (!name) {
      setClassNameError('Class name is required');
      return;
    }
    setClassNameError('');
    setSaving(true);
    try {
      await dispatch(createClassThunk(name)).unwrap();
      toast.success(`Class "${name}" created successfully!`);
      setIsCreateClassOpen(false);
      resetCreateClass();
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to create class');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubjects = useMemo(() => subjects ?? [], [subjects]);

  useEffect(() => {
    const t = setTimeout(() => dispatch(fetchSubjectsThunk({ search: subjectSearch })), 250);
    return () => clearTimeout(t);
  }, [dispatch, subjectSearch]);

  const filteredExamTypes = useMemo(() => examTypes ?? [], [examTypes]);

  const canReorderSubjects = !subjectSearch.trim();
  const canReorderExamTypes = !examTypeSearch.trim();
  const reorderableExamTypes = useMemo(
    () => (examTypes ?? []).filter((t) => !t.is_system),
    [examTypes]
  );

  useEffect(() => {
    const t = setTimeout(() => dispatch(fetchExamTypesThunk({ search: examTypeSearch })), 250);
    return () => clearTimeout(t);
  }, [dispatch, examTypeSearch]);

  const openEditSubject = (sub) => {
    setEditingSubject(sub);
    setEditSubjectName(sub?.name ?? '');
    setEditSubjectCode(sub?.code ?? '');
    setEditSubjectError('');
    setEditSubjectCodeError('');
    setIsEditSubjectOpen(true);
  };

  const handleUpdateSubject = async () => {
    if (!editingSubject?.id) return;
    const name = editSubjectName.trim();
    const code = editSubjectCode.trim();
    if (!name) {
      setEditSubjectError('Subject name is required');
      return;
    }
    if (code.length > 20) {
      setEditSubjectCodeError('Subject code must be 20 characters or less');
      return;
    }
    setEditSubjectError('');
    setEditSubjectCodeError('');
    setSaving(true);
    try {
      await dispatch(
        updateSubjectThunk({
          subjectId: editingSubject.id,
          payload: { name, code: code || null },
        })
      ).unwrap();
      toast.success('Subject updated');
      setIsEditSubjectOpen(false);
      setEditingSubject(null);
      dispatch(fetchSubjectsThunk({ search: subjectSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to update subject');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteSubject = (sub) => {
    setDeletingSubject(sub);
    setIsDeleteSubjectOpen(true);
  };

  const confirmDeleteSubject = async () => {
    if (!deletingSubject?.id) return;
    try {
      await dispatch(deleteSubjectThunk(deletingSubject.id)).unwrap();
      toast.success('Subject deleted');
      setIsDeleteSubjectOpen(false);
      setDeletingSubject(null);
      dispatch(fetchSubjectsThunk({ search: subjectSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to delete subject');
    }
  };

  const handleMoveSubject = async (index, direction) => {
    if (!canReorderSubjects || reorderingSubjects) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= subjects.length) return;
    const next = [...subjects];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    const orderedIds = next.map((s) => s.id);
    setReorderingSubjects(true);
    try {
      await dispatch(reorderSubjectsThunk({ orderedIds })).unwrap();
      await dispatch(fetchSubjectsThunk({ search: '' })).unwrap();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to reorder subjects');
      dispatch(fetchSubjectsThunk({ search: subjectSearch }));
    } finally {
      setReorderingSubjects(false);
    }
  };

  const resetCreateExamType = () => {
    setNewExamTypeName('');
    setExamTypeNameError('');
  };

  const openEditExamType = (row) => {
    if (row?.is_system) return;
    setEditingExamType(row);
    setEditExamTypeName(row?.name ?? '');
    setEditExamTypeError('');
    setIsEditExamTypeOpen(true);
  };

  const handleUpdateExamType = async () => {
    if (!editingExamType?.id) return;
    const name = editExamTypeName.trim();
    if (!name) {
      setEditExamTypeError('Exam type name is required');
      return;
    }
    setEditExamTypeError('');
    setSaving(true);
    try {
      await dispatch(
        updateExamTypeThunk({
          examTypeId: editingExamType.id,
          payload: { name },
        })
      ).unwrap();
      toast.success('Exam type updated');
      setIsEditExamTypeOpen(false);
      setEditingExamType(null);
      dispatch(fetchExamTypesThunk({ search: examTypeSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to update exam type');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteExamType = (row) => {
    if (row?.is_system) return;
    setDeletingExamType(row);
    setIsDeleteExamTypeOpen(true);
  };

  const confirmDeleteExamType = async () => {
    if (!deletingExamType?.id) return;
    try {
      await dispatch(deleteExamTypeThunk(deletingExamType.id)).unwrap();
      toast.success('Exam type deleted');
      setIsDeleteExamTypeOpen(false);
      setDeletingExamType(null);
      dispatch(fetchExamTypesThunk({ search: examTypeSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to delete exam type');
    }
  };

  const handleMoveExamType = async (index, direction) => {
    if (!canReorderExamTypes || reorderingExamTypes) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= reorderableExamTypes.length) return;
    const next = [...reorderableExamTypes];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    const orderedIds = next.map((t) => t.id);
    setReorderingExamTypes(true);
    try {
      await dispatch(reorderExamTypesThunk({ orderedIds })).unwrap();
      await dispatch(fetchExamTypesThunk({ search: '' })).unwrap();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to reorder exam types');
      dispatch(fetchExamTypesThunk({ search: examTypeSearch }));
    } finally {
      setReorderingExamTypes(false);
    }
  };

  const handleCreateExamType = async () => {
    const name = newExamTypeName.trim();
    if (!name) {
      setExamTypeNameError('Exam type name is required');
      return;
    }
    setExamTypeNameError('');
    setSaving(true);
    try {
      await dispatch(createExamTypeThunk({ name })).unwrap();
      toast.success(`Exam type "${name}" added`);
      setIsCreateExamTypeOpen(false);
      resetCreateExamType();
      dispatch(fetchExamTypesThunk({ search: examTypeSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to create exam type');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    const code = newSubjectCode.trim();
    if (!name) {
      setSubjectNameError('Subject name is required');
      return;
    }
    if (code.length > 20) {
      setSubjectCodeError('Subject code must be 20 characters or less');
      return;
    }
    setSubjectNameError('');
    setSubjectCodeError('');
    setSaving(true);
    try {
      await dispatch(createSubjectThunk({ name, code: code || null })).unwrap();
      toast.success(`Subject "${name}" added`);
      setIsCreateSubjectOpen(false);
      resetCreateSubject();
      dispatch(fetchSubjectsThunk({ search: subjectSearch }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to create subject');
    } finally {
      setSaving(false);
    }
  };

  const openEditClass = (cls, e) => {
    e?.stopPropagation?.();
    setEditingClassId(cls.id);
    setEditClassName(cls.name);
    setEditClassNameError('');
    setIsEditClassOpen(true);
  };

  const handleUpdateClass = async () => {
    const name = editClassName.trim();
    if (!name) {
      setEditClassNameError('Class name is required');
      return;
    }
    setEditClassNameError('');
    setSaving(true);
    try {
      await dispatch(updateClassThunk({ classId: editingClassId, name })).unwrap();
      toast.success('Class updated');
      setIsEditClassOpen(false);
      setEditingClassId(null);
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to update class');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteClass = (cls, e) => {
    e?.stopPropagation?.();
    setDeletingClass(cls);
    setIsDeleteClassOpen(true);
  };

  const confirmDeleteClass = async () => {
    if (!deletingClass?.id) return;
    try {
      await dispatch(deleteClassThunk(deletingClass.id)).unwrap();
      toast.success('Class deleted');
      setIsDeleteClassOpen(false);
      setDeletingClass(null);
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to delete class');
    }
  };

  const handleCreateSection = async () => {
    if (!selectedClass) {
      toast.error('Select a class first');
      return;
    }
    const code = newSectionName.trim().toUpperCase();
    if (!code) {
      setSectionNameError('Section label is required');
      return;
    }
    if (code.length < 1 || code.length > 10) {
      setSectionNameError('Section code must be 1–10 characters');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setSectionNameError('Only A–Z, 0–9, "-" and "_" are allowed');
      return;
    }
    setSectionNameError('');
    setSaving(true);
    try {
      await dispatch(
        createSectionThunk({ classId: selectedClass.id, section_code: code })
      ).unwrap();
      toast.success(`Section ${code} added to ${selectedClass.name}`);
      setIsCreateSectionOpen(false);
      resetCreateSection();
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to create section');
    } finally {
      setSaving(false);
    }
  };

  const openEditSection = (sec) => {
    setEditingSection(sec);
    setEditSectionCode(sec.section);
    setEditSectionError('');
    setIsEditSectionOpen(true);
  };

  const handleUpdateSection = async () => {
    if (!editingSection?.id) return;
    const code = editSectionCode.trim().toUpperCase();
    if (!code) {
      setEditSectionError('Section code is required');
      return;
    }
    if (code.length < 1 || code.length > 10) {
      setEditSectionError('Section code must be 1–10 characters');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setEditSectionError('Only A–Z, 0–9, "-" and "_" are allowed');
      return;
    }
    setEditSectionError('');
    setSaving(true);
    try {
      await dispatch(
        updateSectionThunk({ sectionId: editingSection.id, section_code: code })
      ).unwrap();
      toast.success('Section updated');
      setIsEditSectionOpen(false);
      setEditingSection(null);
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to update section');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteSection = (sec) => {
    setDeletingSection(sec);
    setIsDeleteSectionOpen(true);
  };

  const confirmDeleteSection = async () => {
    if (!deletingSection?.id) return;
    try {
      await dispatch(deleteSectionThunk(deletingSection.id)).unwrap();
      toast.success('Section deleted');
      setIsDeleteSectionOpen(false);
      setDeletingSection(null);
      dispatch(fetchClassesThunk());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to delete section');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes & subjects"        titleClassName="text-2xl sm:text-2xl"      />

      {/* Row 1: Classes + Sections (keep design as-is) */}
      <div
        className={cn(
          'grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-1 lg:min-h-0 lg:items-stretch lg:overflow-hidden',
          panelHeightLg
        )}
      >
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            panelMaxStacked,
            'lg:col-span-5 lg:h-full lg:max-h-none'
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex shrink-0 flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Classes</CardTitle>              </div>
              <Dialog
                open={isCreateClassOpen}
                onOpenChange={(open) => {
                  setIsCreateClassOpen(open);
                  if (!open) resetCreateClass();
                }}
              >
                <DialogTrigger asChild>
                  <Button type="button" className="gap-2 shrink-0" onClick={() => resetCreateClass()}>
                    <Plus className="h-4 w-4" />
                    Add class
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create new class</DialogTitle>
                    <DialogDescription>Add a class to the system. You can add sections after.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-class-name">Class name *</Label>
                      <Input
                        id="new-class-name"
                        placeholder="Enter class name"
                        value={newClassName}
                        onChange={(e) => {
                          setNewClassName(e.target.value);
                          setClassNameError('');
                        }}
                      />
                      {classNameError ? <p className="text-xs text-red-600">{classNameError}</p> : null}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateClassOpen(false);
                          resetCreateClass();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateClass} disabled={saving}>
                        {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Create class'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
              <SearchInput
                className="shrink-0"
                iconClassName="h-4 w-4"
                placeholder="Search classes..."
                value={classSearch}
                onValueChange={setClassSearch}
                aria-label="Search classes"
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200">
                <div className="min-h-0 flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead>Class</TableHead>
                        <TableHead className="w-24 text-center">Sections</TableHead>
                        <TableHead className="text-right w-40">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {status === 'loading' ? (
                        <TableSkeletonRows columns={3} rows={4} />
                      ) : filteredClasses.length === 0 ? (
                        <TableEmptyRow colSpan={3} className="py-10">
                          {classes.length === 0
                            ? 'No classes yet. Add your first class.'
                            : 'No classes match your search.'}
                        </TableEmptyRow>
                      ) : (
                        filteredClasses.map((cls) => {
                          const isSelected = cls.id === selectedClassId;
                          const sectionCount = cls.sections?.length ?? 0;
                          return (
                            <TableRow
                              key={cls.id}
                              className={cn(
                                'cursor-pointer',
                                isSelected ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'
                              )}
                              onClick={() => setSelectedClassId(cls.id)}
                            >
                              <TableCell className="font-medium text-gray-900">
                                <span className={cn(isSelected && 'text-blue-700')}>{cls.name}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{sectionCount}</Badge>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => openEditClass(cls, e)}
                                    aria-label={`Edit ${cls.name}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => openDeleteClass(cls, e)}
                                    aria-label={`Delete ${cls.name}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {error ? <p className="text-xs text-red-600 shrink-0">{String(error)}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            panelMaxStacked,
            'lg:col-span-7 lg:h-full lg:max-h-none'
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex shrink-0 flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>
                  {selectedClass ? (
                    <>Sections — {selectedClass.name}</>
                  ) : (
                    <>Sections</>
                  )}
                </CardTitle>              </div>
              <Dialog
                open={isCreateSectionOpen}
                onOpenChange={(open) => {
                  setIsCreateSectionOpen(open);
                  if (!open) resetCreateSection();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    className="gap-2 shrink-0"
                    disabled={!selectedClass}
                    onClick={() => resetCreateSection()}
                  >
                    <Plus className="h-4 w-4" />
                    Add section
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add section</DialogTitle>
                    <DialogDescription>
                      {selectedClass
                        ? `New section for ${selectedClass.name}`
                        : 'Select a class before adding a section'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {selectedClass ? (
                      <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        Class: <span className="font-medium text-gray-900">{selectedClass.name}</span>
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="new-section-name">Section label *</Label>
                      <Input
                        id="new-section-name"
                        placeholder="Enter section label"
                        value={newSectionName}
                        onChange={(e) => {
                          const raw = String(e.target.value ?? '');
                          const cleaned = raw.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
                          setNewSectionName(cleaned);
                          setSectionNameError('');
                        }}
                      />
                      <p className="text-xs text-gray-500">1–10 characters (A–Z, 0–9, - , _)</p>
                      {sectionNameError ? (
                        <p className="text-xs text-red-600">{sectionNameError}</p>
                      ) : null}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateSectionOpen(false);
                          resetCreateSection();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateSection} disabled={!selectedClass || saving}>
                        {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Add section'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {!selectedClass ? (
                <div className="flex min-h-[7.2rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center lg:min-h-0">
                  <Layers className="h-10 w-10 text-gray-400 mb-3" aria-hidden />
                  <p className="text-sm font-medium text-gray-900">No class selected</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-sm">
                    Pick a class from the list, or add a new class to get started.
                  </p>
                </div>
              ) : sectionsList.length === 0 ? (
                <div className="flex min-h-[7.2rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center lg:min-h-0">
                  <p className="text-sm text-gray-600">No sections yet for this class.</p>
                  <p className="text-sm text-gray-500 mt-1">Use &quot;Add section&quot; to create one.</p>
                </div>
              ) : (
                <div className="grid min-h-0 flex-1 auto-rows-min gap-4 content-start grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
                  {sectionsList.map((sec) => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow"
                    >
                      <div>
                        <p className="font-medium text-gray-900">Section {sec.section}</p>
                        <p className="text-xs text-gray-500">Active</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditSection(sec)}
                          aria-label={`Edit section ${sec.section}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteSection(sec)}
                          aria-label={`Delete section ${sec.section}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Subjects + Exam types (side by side on large screens) */}
      <div
        className={cn(
          'grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-rows-1 lg:min-h-0 lg:items-stretch lg:overflow-hidden',
          panelHeightLg
        )}
      >
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            panelMaxStacked,
            'lg:col-span-5 lg:h-full lg:max-h-none'
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex shrink-0 flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Subjects</CardTitle>              </div>
              <Dialog
                open={isCreateSubjectOpen}
                onOpenChange={(open) => {
                  setIsCreateSubjectOpen(open);
                  if (!open) resetCreateSubject();
                }}
              >
                <DialogTrigger asChild>
                  <Button type="button" className="gap-2 shrink-0" onClick={() => resetCreateSubject()}>
                    <Plus className="h-4 w-4" />
                    Add subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add subject</DialogTitle>
                    <DialogDescription>Create a subject (e.g. Mathematics, Physics)</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-subject-name">Subject name *</Label>
                      <Input
                        id="new-subject-name"
                        placeholder="Enter subject name"
                        value={newSubjectName}
                        onChange={(e) => {
                          setNewSubjectName(e.target.value);
                          setSubjectNameError('');
                        }}
                      />
                      {subjectNameError ? <p className="text-xs text-red-600">{subjectNameError}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-subject-code">Subject code</Label>
                      <Input
                        id="new-subject-code"
                        placeholder="Optional (e.g. MATH, PHY)"
                        value={newSubjectCode}
                        maxLength={20}
                        onChange={(e) => {
                          setNewSubjectCode(e.target.value);
                          setSubjectCodeError('');
                        }}
                      />
                      {subjectCodeError ? <p className="text-xs text-red-600">{subjectCodeError}</p> : null}
                      <p className="text-xs text-gray-500">Optional. Must be unique if provided.</p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateSubjectOpen(false);
                          resetCreateSubject();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateSubject} disabled={saving}>
                        {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Add subject'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
              <SearchInput
                className="shrink-0"
                iconClassName="h-4 w-4"
                placeholder="Search subjects..."
                value={subjectSearch}
                onValueChange={setSubjectSearch}
                aria-label="Search subjects"
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200">
                <div className="min-h-0 flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead>Subject</TableHead>
                        <TableHead className="w-28">Code</TableHead>
                        <TableHead className="text-right w-40">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectsStatus === 'loading' ? (
                        <TableSkeletonRows columns={3} rows={4} />
                      ) : filteredSubjects.length === 0 ? (
                        <TableEmptyRow colSpan={3} className="py-10">
                          {subjects.length === 0
                            ? 'No subjects yet. Add your first subject.'
                            : 'No subjects match your search.'}
                        </TableEmptyRow>
                      ) : (
                        filteredSubjects.map((sub, index) => (
                          <TableRow key={sub.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-gray-900">{sub.name}</TableCell>
                            <TableCell className="text-gray-600">{sub.code || '—'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canReorderSubjects ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={reorderingSubjects || index === 0}
                                      onClick={() => handleMoveSubject(index, -1)}
                                      aria-label={`Move ${sub.name} up`}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={reorderingSubjects || index === filteredSubjects.length - 1}
                                      onClick={() => handleMoveSubject(index, 1)}
                                      aria-label={`Move ${sub.name} down`}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditSubject(sub)}
                                  aria-label={`Edit ${sub.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteSubject(sub)}
                                  aria-label={`Delete ${sub.name}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
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
              {subjectsError ? <p className="text-xs text-red-600 shrink-0">{String(subjectsError)}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            panelMaxStacked,
            'lg:col-span-7 lg:h-full lg:max-h-none'
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="flex shrink-0 flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Exam types</CardTitle>
                <CardDescription>&quot;Others&quot; cannot be edited or deleted</CardDescription>
              </div>
              <Dialog
                open={isCreateExamTypeOpen}
                onOpenChange={(open) => {
                  setIsCreateExamTypeOpen(open);
                  if (!open) resetCreateExamType();
                }}
              >
                <DialogTrigger asChild>
                  <Button type="button" className="gap-2 shrink-0" onClick={() => resetCreateExamType()}>
                    <Plus className="h-4 w-4" />
                    Add exam type
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add exam type</DialogTitle>
                    <DialogDescription>Create a label such as Unit Test or Mid Term</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-exam-type-name">Name *</Label>
                      <Input
                        id="new-exam-type-name"
                        placeholder="Enter exam type name"
                        value={newExamTypeName}
                        onChange={(e) => {
                          setNewExamTypeName(e.target.value);
                          setExamTypeNameError('');
                        }}
                      />
                      {examTypeNameError ? <p className="text-xs text-red-600">{examTypeNameError}</p> : null}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateExamTypeOpen(false);
                          resetCreateExamType();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateExamType} disabled={saving}>
                        {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Add exam type'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
              <SearchInput
                className="shrink-0"
                iconClassName="h-4 w-4"
                placeholder="Search exam types..."
                value={examTypeSearch}
                onValueChange={setExamTypeSearch}
                aria-label="Search exam types"
              />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200">
                <div className="min-h-0 flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right w-40">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examTypesStatus === 'loading' ? (
                        <TableSkeletonRows columns={2} rows={4} />
                      ) : filteredExamTypes.length === 0 ? (
                        <TableEmptyRow colSpan={2} className="py-10">
                          {examTypes.length === 0
                            ? 'No exam types yet.'
                            : 'No exam types match your search.'}
                        </TableEmptyRow>
                      ) : (
                        filteredExamTypes.map((row) => {
                          const reorderIndex = row.is_system
                            ? -1
                            : reorderableExamTypes.findIndex((t) => t.id === row.id);
                          return (
                          <TableRow key={row.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-gray-900">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{row.name}</span>
                                {row.is_system ? (
                                  <Badge variant="secondary" className="text-xs font-normal">
                                    Default
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canReorderExamTypes && !row.is_system ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={reorderingExamTypes || reorderIndex === 0}
                                      onClick={() => handleMoveExamType(reorderIndex, -1)}
                                      aria-label={`Move ${row.name} up`}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={
                                        reorderingExamTypes ||
                                        reorderIndex === reorderableExamTypes.length - 1
                                      }
                                      onClick={() => handleMoveExamType(reorderIndex, 1)}
                                      aria-label={`Move ${row.name} down`}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={Boolean(row.is_system)}
                                  onClick={() => openEditExamType(row)}
                                  aria-label={row.is_system ? 'System exam type cannot be edited' : `Edit ${row.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={Boolean(row.is_system)}
                                  onClick={() => openDeleteExamType(row)}
                                  aria-label={row.is_system ? 'System exam type cannot be deleted' : `Delete ${row.name}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {examTypesError ? <p className="text-xs text-red-600 shrink-0">{String(examTypesError)}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isEditExamTypeOpen}
        onOpenChange={(open) => {
          setIsEditExamTypeOpen(open);
          if (!open) {
            setEditingExamType(null);
            setEditExamTypeName('');
            setEditExamTypeError('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit exam type</DialogTitle>
            <DialogDescription>Rename this exam type</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-exam-type-name">Name *</Label>
              <Input
                id="edit-exam-type-name"
                value={editExamTypeName}
                onChange={(e) => {
                  setEditExamTypeName(e.target.value);
                  setEditExamTypeError('');
                }}
              />
              {editExamTypeError ? <p className="text-xs text-red-600">{editExamTypeError}</p> : null}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditExamTypeOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateExamType} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteExamTypeOpen}
        onOpenChange={setIsDeleteExamTypeOpen}
        title="Delete exam type?"
        description={
          deletingExamType
            ? `This will remove “${deletingExamType.name}”. You cannot delete a type that is still used by examinations.`
            : ''
        }
        confirmText="Delete"
        onConfirm={confirmDeleteExamType}
      />

      <Dialog
        open={isEditClassOpen}
        onOpenChange={(open) => {
          setIsEditClassOpen(open);
          if (!open) {
            setEditingClassId(null);
            setEditClassName('');
            setEditClassNameError('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit class</DialogTitle>
            <DialogDescription>Update the class name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-class-name">Class name *</Label>
              <Input
                id="edit-class-name"
                value={editClassName}
                onChange={(e) => {
                  setEditClassName(e.target.value);
                  setEditClassNameError('');
                }}
              />
              {editClassNameError ? (
                <p className="text-xs text-red-600">{editClassNameError}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditClassOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateClass} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteClassOpen}
        onOpenChange={(open) => {
          setIsDeleteClassOpen(open);
          if (!open) setDeletingClass(null);
        }}
        description={
          <>
            You will delete{' '}
            <span className="font-medium text-gray-900">{deletingClass?.name}</span>. This action cannot be
            undone.
          </>
        }
        onConfirm={confirmDeleteClass}
      />

      <Dialog
        open={isEditSectionOpen}
        onOpenChange={(open) => {
          setIsEditSectionOpen(open);
          if (!open) {
            setEditingSection(null);
            setEditSectionCode('');
            setEditSectionError('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
            <DialogDescription>Update the section code (1–10 chars: A–Z, 0–9, - , _)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-section-code">Section code *</Label>
              <Input
                id="edit-section-code"
                value={editSectionCode}
                maxLength={10}
                onChange={(e) => {
                  const raw = String(e.target.value ?? '');
                  const cleaned = raw.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
                  setEditSectionCode(cleaned);
                  setEditSectionError('');
                }}
              />
              {editSectionError ? <p className="text-xs text-red-600">{editSectionError}</p> : null}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditSectionOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateSection} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteSectionOpen}
        onOpenChange={(open) => {
          setIsDeleteSectionOpen(open);
          if (!open) setDeletingSection(null);
        }}
        description={
          <>
            You will delete section{' '}
            <span className="font-medium text-gray-900">{deletingSection?.section}</span>. This action
            cannot be undone.
          </>
        }
        onConfirm={confirmDeleteSection}
      />

      <Dialog
        open={isEditSubjectOpen}
        onOpenChange={(open) => {
          setIsEditSubjectOpen(open);
          if (!open) {
            setEditingSubject(null);
            setEditSubjectName('');
            setEditSubjectCode('');
            setEditSubjectError('');
            setEditSubjectCodeError('');
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit subject</DialogTitle>
            <DialogDescription>Update subject details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-subject-name">Subject name *</Label>
              <Input
                id="edit-subject-name"
                value={editSubjectName}
                onChange={(e) => {
                  setEditSubjectName(e.target.value);
                  setEditSubjectError('');
                }}
              />
              {editSubjectError ? <p className="text-xs text-red-600">{editSubjectError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject-code">Subject code</Label>
              <Input
                id="edit-subject-code"
                placeholder="Optional (e.g. MATH, PHY)"
                value={editSubjectCode}
                maxLength={20}
                onChange={(e) => {
                  setEditSubjectCode(e.target.value);
                  setEditSubjectCodeError('');
                }}
              />
              {editSubjectCodeError ? <p className="text-xs text-red-600">{editSubjectCodeError}</p> : null}
              <p className="text-xs text-gray-500">Optional. Must be unique if provided.</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditSubjectOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateSubject} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteSubjectOpen}
        onOpenChange={(open) => {
          setIsDeleteSubjectOpen(open);
          if (!open) setDeletingSubject(null);
        }}
        description={
          <>
            You will delete{' '}
            <span className="font-medium text-gray-900">{deletingSubject?.name}</span>. This action cannot be
            undone.
          </>
        }
        onConfirm={confirmDeleteSubject}
      />
    </div>
  );
}
