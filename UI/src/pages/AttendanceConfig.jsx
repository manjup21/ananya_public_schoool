import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { CalendarOff, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { useClasses } from '../features/classes/useClasses';
import { usePagedRows } from '../hooks/usePagedRows';
import {
  fetchAttendancePatternsThunk,
  createAttendancePatternThunk,
  updateAttendancePatternThunk,
  versionAttendancePatternThunk,
  deleteAttendancePatternThunk,
  fetchAttendancePatternByIdThunk,
} from '../features/attendancePatterns/attendancePatternsSlice';
import { formatDateOnlyLocal, parseApiDateOnly } from '../utils/dateOnly';
import { AttendancePatternFormDialog } from './attendanceConfig/AttendancePatternFormDialog';
import { AttendancePatternViewDialog } from './attendanceConfig/AttendancePatternViewDialog';
import { AttendancePatternsTable } from './attendanceConfig/AttendancePatternsTable';
import { PageHeader } from '../components/common/PageHeader';
import { classNameById, sectionNameById } from './attendanceConfig/attendanceConfigHelpers';
import { Spinner } from '../components/ui/spinner';

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeSlotName(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

function uniqueByName(slots) {
  const out = [];
  const seen = new Set();
  for (const s of slots ?? []) {
    const name = normalizeSlotName(s?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, name });
  }
  return out;
}

function buildSlotsFromCount(n) {
  const count = Math.max(1, Math.min(20, Math.trunc(Number(n) || 1)));
  return Array.from({ length: count }, (_, i) => ({ id: makeId(), name: `Slot ${i + 1}`, order: i + 1 }));
}

function normalizeDays(days) {
  return (Array.isArray(days) ? days : [])
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
}

function normalizeSlotNames(slots) {
  const list = Array.isArray(slots) ? slots : [];
  return list.map((s) => normalizeSlotName(s?.name)).filter(Boolean);
}

function normalizeSlotsByDow(slotsByDow, daysOfWeek) {
  const by = slotsByDow && typeof slotsByDow === 'object' ? slotsByDow : {};
  const out = {};
  for (const d of normalizeDays(daysOfWeek)) {
    out[String(d)] = normalizeSlotNames(by[d] ?? by[String(d)] ?? []);
  }
  return out;
}

function shallowJsonEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function AttendanceConfig() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { classes } = useClasses();

  const patterns = useSelector((s) => s.attendancePatterns.items);
  const patternsStatus = useSelector((s) => s.attendancePatterns.status);
  const patternsError = useSelector((s) => s.attendancePatterns.error);

  // table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState('all');
  const [filterClassId, setFilterClassId] = useState('all');
  const [filterSectionId, setFilterSectionId] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [editSnapshot, setEditSnapshot] = useState(null);
  const [versionConfirmOpen, setVersionConfirmOpen] = useState(false);
  const [pendingVersionPayload, setPendingVersionPayload] = useState(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: '',
    scope: 'global',
    classId: '',
    sectionId: '',
    sectionIds: [],
    startDate: null,
    endDate: null,
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri default
    sameSlotsAllDays: true,
    slotsGlobal: [{ id: makeId(), name: 'Daily', order: 1 }],
    slotsByDow: {},
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (patternsStatus === 'idle') dispatch(fetchAttendancePatternsThunk({}));
  }, [patternsStatus, dispatch]);

  useEffect(() => {
    setFilterSectionId('all');
  }, [filterClassId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterScope, filterClassId, filterSectionId, pageSize]);

  // Load all patterns; Scope/Class/Section filters are client-side only so global patterns
  // are not hidden when a class filter is active (they have no class_id in the API).
  useEffect(() => {
    dispatch(fetchAttendancePatternsThunk({ search: searchQuery }));
  }, [dispatch, searchQuery]);

  const classOptions = useMemo(
    () => [{ value: 'all', label: 'All classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))],
    [classes]
  );

  const classOptionsForm = useMemo(
    () => [{ value: '', label: 'Select class' }, ...classes.map((c) => ({ value: c.id, label: c.name }))],
    [classes]
  );

  const sectionOptions = useMemo(() => {
    if (filterClassId === 'all') return [{ value: 'all', label: 'All sections' }];
    const cls = classes.find((c) => c.id === filterClassId);
    const secs = cls?.sections ?? [];
    return [{ value: 'all', label: 'All sections' }, ...secs.map((s) => ({ value: s.id, label: s.section }))];
  }, [filterClassId, classes]);

  const formSections = useMemo(() => {
    if (!form.classId) return [{ value: '', label: 'Select class first' }];
    const cls = classes.find((c) => c.id === form.classId);
    const secs = cls?.sections ?? [];
    return [{ value: '', label: 'Select section' }, ...secs.map((s) => ({ value: s.id, label: s.section }))];
  }, [form.classId, classes]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (Array.isArray(patterns) ? patterns : []).filter((p) => {
      if (filterScope !== 'all' && p.scope !== filterScope) return false;
      const pClassId = p.class_id ?? p.classId;
      const pSectionId = p.section_id ?? p.sectionId;
      if (filterClassId !== 'all' && pClassId !== filterClassId) return false;
      if (filterSectionId !== 'all' && pSectionId !== filterSectionId) return false;
      if (!q) return true;
      const cls = pClassId ? classNameById(classes, pClassId) : '';
      const sec = pSectionId ? sectionNameById(classes, pClassId, pSectionId) : '';
      return (
        String(p.name ?? '').toLowerCase().includes(q) ||
        String(p.scope ?? '').toLowerCase().includes(q) ||
        String(cls).toLowerCase().includes(q) ||
        String(sec).toLowerCase().includes(q)
      );
    });
  }, [patterns, searchQuery, filterScope, filterClassId, filterSectionId, classes]);

  const totalCount = filtered.length;
  const totalAllCount = (Array.isArray(patterns) ? patterns : []).length;
  const filtersHidePatterns = totalAllCount > totalCount;
  const { totalPages, currentPage, pageRows: paginated } = usePagedRows(filtered, page, pageSize);

  const activePattern = useMemo(() => {
    const id = viewingId ?? editingId ?? deletingId;
    if (!id) return null;
    return (Array.isArray(patterns) ? patterns : []).find((p) => p.id === id) ?? null;
  }, [patterns, viewingId, editingId, deletingId]);

  const resetForm = () => {
    setForm({
      name: '',
      scope: 'global',
      classId: '',
      sectionId: '',
      sectionIds: [],
      startDate: null,
      endDate: null,
      daysOfWeek: [1, 2, 3, 4, 5],
      sameSlotsAllDays: true,
      slotsGlobal: [{ id: makeId(), name: 'Daily', order: 1 }],
      slotsByDow: {},
    });
    setErrors({});
    setEditSnapshot(null);
  };

  const openAdd = () => {
    setEditingId(null);
    setEditSnapshot(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const fromList = (Array.isArray(patterns) ? patterns : []).find((x) => x.id === id) ?? null;
      const p = fromList?.same_slots_all_days !== undefined ? fromList : await dispatch(fetchAttendancePatternByIdThunk(id)).unwrap();
      if (!p) return;

      const hasNewSlots = p.same_slots_all_days !== undefined || p.slots_global !== undefined || p.slots_by_dow !== undefined;
      const sameSlotsAllDays = hasNewSlots
        ? p.same_slots_all_days !== false && (!p.slots_by_dow || Object.keys(p.slots_by_dow ?? {}).length === 0)
        : true;

      const legacyCount =
        p.slots_per_day ??
        p.slotsPerDay ??
        (Array.isArray(p.slot_times ?? p.slotTimes) ? (p.slot_times ?? p.slotTimes).length : null) ??
        1;

      const slotsGlobal = hasNewSlots
        ? (Array.isArray(p.slots_global) ? p.slots_global : []).map((s, i) => ({
            id: makeId(),
            name: s?.slot_name ?? s?.name ?? `Slot ${i + 1}`,
            order: i + 1,
          }))
        : buildSlotsFromCount(legacyCount);

      const slotsByDow = hasNewSlots
        ? Object.fromEntries(
            Object.entries(p.slots_by_dow ?? {}).map(([dow, arr]) => [
              Number(dow),
              (Array.isArray(arr) ? arr : []).map((s, i) => ({
                id: makeId(),
                name: s?.slot_name ?? s?.name ?? `Slot ${i + 1}`,
                order: i + 1,
              })),
            ])
          )
        : {};

      setEditingId(id);
      setForm({
        name: p.name ?? '',
        scope: p.scope ?? 'global',
        classId: p.class_id ?? p.classId ?? '',
        sectionId: p.section_id ?? p.sectionId ?? '',
        sectionIds: (p.section_id ?? p.sectionId) ? [p.section_id ?? p.sectionId] : [],
        startDate: parseApiDateOnly(p.start_date ?? p.startDate),
        endDate: parseApiDateOnly(p.end_date ?? p.endDate),
        daysOfWeek: Array.isArray(p.days_of_week) ? p.days_of_week : Array.isArray(p.daysOfWeek) ? p.daysOfWeek : [],
        sameSlotsAllDays,
        slotsGlobal,
        slotsByDow,
      });
      setEditSnapshot({
        scope: p.scope ?? 'global',
        classId: p.class_id ?? p.classId ?? '',
        sectionId: p.section_id ?? p.sectionId ?? '',
        startDate: formatDateOnlyLocal(parseApiDateOnly(p.start_date ?? p.startDate)),
        endDate: formatDateOnlyLocal(parseApiDateOnly(p.end_date ?? p.endDate)),
        daysOfWeek: normalizeDays(Array.isArray(p.days_of_week) ? p.days_of_week : Array.isArray(p.daysOfWeek) ? p.daysOfWeek : []),
        sameSlotsAllDays,
        slotsGlobal: normalizeSlotNames(slotsGlobal),
        slotsByDow: normalizeSlotsByDow(
          slotsByDow,
          Array.isArray(p.days_of_week) ? p.days_of_week : Array.isArray(p.daysOfWeek) ? p.daysOfWeek : []
        ),
      });
      setIsDialogOpen(true);
    } catch (e) {
      toast.error(String(e || 'Failed to open pattern'));
    }
  };

  const openView = (id) => {
    setViewingId(id);
    setIsViewDialogOpen(true);
  };

  const openDelete = (id) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!String(form.name).trim()) e.name = 'Pattern name is required';
    if (!form.scope) e.scope = 'Scope is required';
    if ((form.scope === 'class' || form.scope === 'section') && !form.classId) e.classId = 'Class is required';
    if (form.scope === 'section') {
      if (editingId) {
        if (!form.sectionId) e.sectionId = 'Section is required';
      } else {
        if (!Array.isArray(form.sectionIds) || form.sectionIds.length < 1) e.sectionIds = 'Select at least one section';
      }
    }

    if (!(form.startDate instanceof Date)) e.startDate = 'Start date is required';
    if (!(form.endDate instanceof Date)) e.endDate = 'End date is required';
    if (form.startDate instanceof Date && form.endDate instanceof Date && form.endDate < form.startDate) {
      e.endDate = 'End date must be on or after start date';
    }

    if (!Array.isArray(form.daysOfWeek) || form.daysOfWeek.length === 0) e.daysOfWeek = 'Select at least one day';

    // Slots validation
    const same = form.sameSlotsAllDays !== false;
    if (same) {
      const cleaned = uniqueByName(form.slotsGlobal ?? []);
      if (cleaned.length < 1) e.slots = 'Add at least one slot';
      else if (cleaned.length !== (form.slotsGlobal ?? []).length) e.slots = 'Slot names must be unique and non-empty';
    } else {
      const days = Array.isArray(form.daysOfWeek) ? form.daysOfWeek : [];
      if (!days.length) e.slots = 'Select working days first';
      else {
        for (const d of days) {
          const list = (form.slotsByDow ?? {})[d] ?? [];
          const cleaned = uniqueByName(list);
          if (cleaned.length < 1) {
            e.slots = 'Add at least one slot for each selected working day';
            break;
          }
          if (cleaned.length !== list.length) {
            e.slots = 'Slot names must be unique and non-empty (per day)';
            break;
          }
        }
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const payload = {
      name: String(form.name).trim(),
      scope: form.scope,
      class_id: (form.scope === 'class' || form.scope === 'section') ? form.classId : null,
      section_id: (editingId && form.scope === 'section') ? form.sectionId : null,
      section_ids: (!editingId && form.scope === 'section') ? [...(form.sectionIds ?? [])] : null,
      start_date: formatDateOnlyLocal(form.startDate),
      end_date: formatDateOnlyLocal(form.endDate),
      days_of_week: [...form.daysOfWeek],
      same_slots_all_days: form.sameSlotsAllDays !== false,
      slots_global: (form.slotsGlobal ?? []).map((s) => ({ slot_name: normalizeSlotName(s?.name) })),
      slots_by_dow: Object.fromEntries(
        Object.entries(form.slotsByDow ?? {}).map(([dow, arr]) => [
          String(dow),
          (arr ?? []).map((s) => ({ slot_name: normalizeSlotName(s?.name) })),
        ])
      ),
    };

    const currentSnapshot =
      editingId && editSnapshot
        ? {
            scope: payload.scope,
            classId: payload.class_id ?? '',
            sectionId: payload.section_id ?? '',
            startDate: String(payload.start_date ?? ''),
            endDate: String(payload.end_date ?? ''),
            daysOfWeek: normalizeDays(payload.days_of_week),
            sameSlotsAllDays: payload.same_slots_all_days !== false,
            slotsGlobal: normalizeSlotNames(form.slotsGlobal),
            slotsByDow: normalizeSlotsByDow(form.slotsByDow, payload.days_of_week),
          }
        : null;

    const hasBreakingChange =
      Boolean(editingId && editSnapshot && currentSnapshot) &&
      !(
        editSnapshot.scope === currentSnapshot.scope &&
        String(editSnapshot.classId ?? '') === String(currentSnapshot.classId ?? '') &&
        String(editSnapshot.sectionId ?? '') === String(currentSnapshot.sectionId ?? '') &&
        String(editSnapshot.startDate ?? '') === String(currentSnapshot.startDate ?? '') &&
        String(editSnapshot.endDate ?? '') === String(currentSnapshot.endDate ?? '') &&
        shallowJsonEqual(editSnapshot.daysOfWeek, currentSnapshot.daysOfWeek) &&
        Boolean(editSnapshot.sameSlotsAllDays) === Boolean(currentSnapshot.sameSlotsAllDays) &&
        shallowJsonEqual(editSnapshot.slotsGlobal, currentSnapshot.slotsGlobal) &&
        shallowJsonEqual(editSnapshot.slotsByDow, currentSnapshot.slotsByDow)
      );

    if (editingId && hasBreakingChange) {
      const versionPayload = { ...payload };
      delete versionPayload.start_date; // effective start is fixed to tomorrow
      delete versionPayload.section_ids; // version endpoint uses section_id only
      setPendingVersionPayload(versionPayload);
      setVersionConfirmOpen(true);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await dispatch(updateAttendancePatternThunk({ patternId: editingId, payload })).unwrap();
        toast.success('Pattern updated');
      } else {
        await dispatch(createAttendancePatternThunk(payload)).unwrap();
        toast.success('Pattern created');
      }
      await dispatch(fetchAttendancePatternsThunk({ search: searchQuery }));
      setIsDialogOpen(false);
      setEditingId(null);
      setViewingId(null);
      resetForm();
    } catch (e) {
      toast.error(String(e || 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmVersion = async () => {
    if (!editingId || !pendingVersionPayload) return;
    setSaving(true);
    try {
      await dispatch(versionAttendancePatternThunk({ patternId: editingId, payload: pendingVersionPayload })).unwrap();
      toast.success('Pattern updated (effective tomorrow)');
      await dispatch(fetchAttendancePatternsThunk({ search: searchQuery }));
      setVersionConfirmOpen(false);
      setPendingVersionPayload(null);
      setIsDialogOpen(false);
      setEditingId(null);
      setViewingId(null);
      resetForm();
    } catch (e) {
      toast.error(String(e || 'Versioning failed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    (async () => {
      try {
        await dispatch(deleteAttendancePatternThunk(deletingId)).unwrap();
        await dispatch(fetchAttendancePatternsThunk({ search: searchQuery })).unwrap();
        toast.success('Pattern deleted');
      } catch (e) {
        toast.error(String(e || 'Delete failed'));
      } finally {
        setIsDeleteOpen(false);
        setDeletingId(null);
      }
    })();
  };

  const toggleDay = (id) => {
    setForm((prev) => {
      const set = new Set(prev.daysOfWeek ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, daysOfWeek: Array.from(set) };
    });
    setErrors((p) => ({ ...p, daysOfWeek: undefined }));
  };

  const setSameSlotsAllDays = (next) => {
    setForm((p) => ({ ...p, sameSlotsAllDays: Boolean(next) }));
    setErrors((p) => ({ ...p, slots: undefined }));
  };

  const addSlot = (dayId) => {
    setForm((prev) => {
      if (prev.sameSlotsAllDays !== false) {
        const list = Array.isArray(prev.slotsGlobal) ? prev.slotsGlobal : [];
        const next = [...list, { id: makeId(), name: '', order: list.length + 1 }];
        return { ...prev, slotsGlobal: next };
      }
      if (dayId == null) return prev;
      const by = prev.slotsByDow ?? {};
      const list = Array.isArray(by[dayId]) ? by[dayId] : [];
      const next = [...list, { id: makeId(), name: '', order: list.length + 1 }];
      return { ...prev, slotsByDow: { ...by, [dayId]: next } };
    });
    setErrors((p) => ({ ...p, slots: undefined }));
  };

  const removeSlot = (dayId, slotId) => {
    setForm((prev) => {
      if (prev.sameSlotsAllDays !== false) {
        const list = Array.isArray(prev.slotsGlobal) ? prev.slotsGlobal : [];
        const next = list.filter((s) => s.id !== slotId).map((s, i) => ({ ...s, order: i + 1 }));
        return { ...prev, slotsGlobal: next };
      }
      if (dayId == null) return prev;
      const by = prev.slotsByDow ?? {};
      const list = Array.isArray(by[dayId]) ? by[dayId] : [];
      const next = list.filter((s) => s.id !== slotId).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, slotsByDow: { ...by, [dayId]: next } };
    });
    setErrors((p) => ({ ...p, slots: undefined }));
  };

  const moveSlot = (dayId, slotId, dir) => {
    setForm((prev) => {
      const moveInList = (list) => {
        const arr = Array.isArray(list) ? [...list] : [];
        const idx = arr.findIndex((s) => s.id === slotId);
        if (idx < 0) return arr;
        const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= arr.length) return arr;
        const tmp = arr[idx];
        arr[idx] = arr[nextIdx];
        arr[nextIdx] = tmp;
        return arr.map((s, i) => ({ ...s, order: i + 1 }));
      };

      if (prev.sameSlotsAllDays !== false) {
        return { ...prev, slotsGlobal: moveInList(prev.slotsGlobal) };
      }
      if (dayId == null) return prev;
      const by = prev.slotsByDow ?? {};
      return { ...prev, slotsByDow: { ...by, [dayId]: moveInList(by[dayId]) } };
    });
  };

  const changeSlotName = (dayId, slotId, raw) => {
    setForm((prev) => {
      const updateList = (list) => {
        const arr = Array.isArray(list) ? list : [];
        return arr.map((s) => (s.id === slotId ? { ...s, name: raw } : s));
      };

      if (prev.sameSlotsAllDays !== false) {
        return { ...prev, slotsGlobal: updateList(prev.slotsGlobal) };
      }
      if (dayId == null) return prev;
      const by = prev.slotsByDow ?? {};
      return { ...prev, slotsByDow: { ...by, [dayId]: updateList(by[dayId]) } };
    });
    setErrors((p) => ({ ...p, slots: undefined }));
  };

  const applyPreset = (kind) => {
    const preset =
      kind === 'daily'
        ? [{ id: makeId(), name: 'Daily', order: 1 }]
        : kind === 'twice'
          ? [
              { id: makeId(), name: 'Morning', order: 1 },
              { id: makeId(), name: 'Afternoon', order: 2 },
            ]
          : kind === 'periods8'
            ? Array.from({ length: 8 }, (_, i) => ({ id: makeId(), name: `Period ${i + 1}`, order: i + 1 }))
            : null;
    if (!preset) return;

    if (form.sameSlotsAllDays !== false) {
      setForm((p) => ({ ...p, slotsGlobal: preset }));
    } else {
      const days = Array.isArray(form.daysOfWeek) ? form.daysOfWeek : [];
      if (!days.length) return;
      // apply to all configured days for convenience
      const by = { ...(form.slotsByDow ?? {}) };
      for (const d of days) by[d] = preset.map((s) => ({ ...s, id: makeId() }));
      setForm((p) => ({ ...p, slotsByDow: by }));
    }
    setErrors((p) => ({ ...p, slots: undefined }));
  };

  const copySlotsDay = (dayId) => {
    if (dayId == null) return;
    const src = (form.slotsByDow ?? {})[dayId] ?? [];
    const copied = (src ?? []).map((s, i) => ({ id: makeId(), name: String(s?.name ?? ''), order: i + 1 }));
    setForm((p) => ({ ...p, __slotsClipboard: { fromDayId: dayId, slots: copied } }));
    toast.success('Copied slots');
  };

  const pasteSlotsDay = (dayId) => {
    if (dayId == null) return;
    const clip = form?.__slotsClipboard;
    const slots = Array.isArray(clip?.slots) ? clip.slots : [];
    if (!slots.length) return;
    const pasted = slots.map((s, i) => ({ id: makeId(), name: String(s?.name ?? ''), order: i + 1 }));
    setForm((p) => ({ ...p, slotsByDow: { ...(p.slotsByDow ?? {}), [dayId]: pasted } }));
    setErrors((p) => ({ ...p, slots: undefined }));
    toast.success('Pasted slots');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance configuration"        actions={
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            onClick={() => navigate('/admin/attendance-config/manage-holidays')}
          >
            <CalendarOff className="h-4 w-4" aria-hidden />
            Manage Holiday
          </Button>
          <AttendancePatternFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingId(null);
                resetForm();
              }
            }}
            trigger={
              <Button className="gap-2 w-full sm:w-auto" type="button" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Pattern
              </Button>
            }
          title={editingId ? 'Edit Attendance Pattern' : 'Add Attendance Pattern'}
          description="Configure scope, date range, working days, and named attendance slots."
          isEditing={Boolean(editingId)}
          form={form}
          errors={errors}
          classOptionsForm={classOptionsForm}
          sectionOptionsForm={formSections}
          onChangeName={(v) => {
            setForm((p) => ({ ...p, name: v }));
            setErrors((p) => ({ ...p, name: undefined }));
          }}
          onChangeScope={(v) => {
            setForm((p) => ({
              ...p,
              scope: v,
              classId: v === 'global' ? '' : p.classId,
              sectionId: v !== 'section' ? '' : p.sectionId,
              sectionIds: v !== 'section' ? [] : p.sectionIds,
            }));
            setErrors((p) => ({ ...p, scope: undefined, classId: undefined, sectionId: undefined, sectionIds: undefined }));
          }}
          onChangeClass={(v) => {
            setForm((p) => ({ ...p, classId: v, sectionId: '', sectionIds: [] }));
            setErrors((p) => ({ ...p, classId: undefined, sectionId: undefined, sectionIds: undefined }));
          }}
          onChangeSection={(v) => {
            setForm((p) => ({ ...p, sectionId: v }));
            setErrors((p) => ({ ...p, sectionId: undefined }));
          }}
          onToggleSection={(sectionId) => {
            setForm((p) => {
              const set = new Set(p.sectionIds ?? []);
              if (set.has(sectionId)) set.delete(sectionId);
              else set.add(sectionId);
              return { ...p, sectionIds: Array.from(set) };
            });
            setErrors((p) => ({ ...p, sectionIds: undefined }));
          }}
          onChangeStartDate={(d) => {
            setForm((p) => ({ ...p, startDate: d }));
            setErrors((p) => ({ ...p, startDate: undefined, endDate: undefined }));
          }}
          onChangeEndDate={(d) => {
            setForm((p) => ({ ...p, endDate: d }));
            setErrors((p) => ({ ...p, endDate: undefined }));
          }}
          onToggleDay={toggleDay}
          onToggleSameSlotsAllDays={setSameSlotsAllDays}
          onAddSlot={addSlot}
          onRemoveSlot={removeSlot}
          onMoveSlot={moveSlot}
          onChangeSlotName={changeSlotName}
          onApplyPreset={applyPreset}
          onCopySlotsDay={copySlotsDay}
          onPasteSlotsDay={pasteSlotsDay}
          onCancel={() => {
            setIsDialogOpen(false);
            setEditingId(null);
            resetForm();
          }}
          onSave={save}
          saving={saving}
        />
          </div>
        }
      />

      <AttendancePatternViewDialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) setViewingId(null);
        }}
        pattern={activePattern}
        classes={classes}
        onEdit={() => {
          if (!activePattern?.id) return;
          setIsViewDialogOpen(false);
          setViewingId(null);
          openEdit(activePattern.id);
        }}
      />

      <AttendancePatternsTable
        classes={classes}
        patternsStatus={patternsStatus}
        patternsError={patternsError}
        totalCount={totalCount}
        totalAllCount={totalAllCount}
        filtersHidePatterns={filtersHidePatterns}
        paginated={paginated}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
        filterScope={filterScope}
        onChangeFilterScope={setFilterScope}
        filterClassId={filterClassId}
        onChangeFilterClassId={setFilterClassId}
        filterSectionId={filterSectionId}
        onChangeFilterSectionId={setFilterSectionId}
        classOptions={classOptions}
        sectionOptions={sectionOptions}
        page={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onView={openView}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <Dialog
        open={versionConfirmOpen}
        onOpenChange={(open) => {
          setVersionConfirmOpen(open);
          if (!open) setPendingVersionPayload(null);
        }}
      >
        <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
          <DialogTitle className="text-lg font-semibold text-gray-900">Create new pattern version?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-gray-700">
            You changed fields that affect historical attendance expectations (slots, working days, scope, or date range).
            To keep past attendance stable, the current pattern will be archived and a new pattern will be created.
          </DialogDescription>
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            <div>
              <span className="font-medium text-gray-900">Effective from:</span> tomorrow (fixed)
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Past dates will continue to use the archived pattern for reports. Future attendance will use the new pattern.
            </div>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVersionConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmVersion} disabled={saving}>
              {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Yes, create new version'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete attendance pattern?"
        description={
          activePattern
            ? `This will delete the pattern “${activePattern.name}” AND permanently delete all attendance records (absences) taken under this pattern’s date range and scope. This can’t be undone.`
            : "This will delete the pattern AND permanently delete all attendance records (absences) taken under this pattern’s date range and scope. This can’t be undone."
        }
        confirmText="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

