import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, ArrowUpDown, Ban, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { formatDateOnlyLocal, parseApiDateOnly, todayDateOnly } from '../utils/dateOnly';

import { plainSectionLabel, useClassSectionOptions } from '../features/classes/useClasses';
import {
  bulkMarkAbsentThunk,
  bulkUnmarkAbsentThunk,
  cancelSlotThunk,
  clearLecturerAttendance,
  fetchAttendanceDayContextThunk,
  fetchAttendanceRosterThunk,
  uncancelSlotThunk,
} from '../features/attendance/lecturerAttendanceSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { FormSelect } from '../components/common/FormSelect';
import { PageHeader } from '../components/common/PageHeader';
import { TablePagination } from '../components/common/TablePagination';
import { usePagedRows } from '../hooks/usePagedRows';
import { Skeleton } from '../components/ui/skeleton';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { normalizeSlotsArray, scopeLabel } from './attendanceConfig/attendanceConfigHelpers';

function studentName(s) {
  return [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || '—';
}

/** YYYY-MM-DD → e.g. 17 Apr 2026 */
function formatDisplayDate(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '—';
  const d = new Date(`${yyyyMmDd.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(yyyyMmDd);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** HH:mm or H:mm → 12h e.g. 09:00 AM */
function time12FromHHmm(timeStr) {
  if (!timeStr) return '—';
  const [hhStr, mmStr] = String(timeStr).split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return String(timeStr);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export function AttendanceManagement() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  const dayContext = useSelector((s) => s.lecturerAttendance.dayContext);
  const dayContextStatus = useSelector((s) => s.lecturerAttendance.dayContextStatus);
  const dayContextError = useSelector((s) => s.lecturerAttendance.dayContextError);
  const dayContextHoliday = useSelector((s) => s.lecturerAttendance.dayContextHoliday);
  const roster = useSelector((s) => s.lecturerAttendance.roster);
  const rosterStatus = useSelector((s) => s.lecturerAttendance.rosterStatus);
  const rosterError = useSelector((s) => s.lecturerAttendance.rosterError);
  const bulkStatus = useSelector((s) => s.lecturerAttendance.bulkStatus);
  const isSlotCancelled = useSelector((s) => s.lecturerAttendance.isSlotCancelled);
  const cancelledSlotReason = useSelector((s) => s.lecturerAttendance.cancelledSlotReason);
  const cancelSlotStatus = useSelector((s) => s.lecturerAttendance.cancelSlotStatus);

  const [selectedDate, setSelectedDate] = useState(todayDateOnly);
  const todayIso = useMemo(() => todayDateOnly(), []);
  const [classId, setClassId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [slotIndex, setSlotIndex] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [draftAbsentById, setDraftAbsentById] = useState(() => new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pageSize, setPageSize] = useState(60);
  const [page, setPage] = useState(1);
  const patternLoadedRef = useRef(false);

  const { classes, classOptions, sectionOptions } = useClassSectionOptions(classId, {
    formatSection: plainSectionLabel,
  });

  const selectedDow = useMemo(() => new Date(`${selectedDate}T12:00:00`).getDay(), [selectedDate]);
  const slotsGlobal = normalizeSlotsArray(dayContext?.slots_global);
  const slotsByDow = dayContext?.slots_by_dow && typeof dayContext.slots_by_dow === 'object' ? dayContext.slots_by_dow : null;
  const slotsForDow = normalizeSlotsArray(slotsByDow?.[String(selectedDow)] ?? slotsByDow?.[selectedDow]);
  const slotRows = (slotsForDow.length ? slotsForDow : slotsGlobal)
    .map((s) => ({
      slot_index: Number(s?.slot_index ?? s?.slotIndex),
      slot_name: String(s?.slot_name ?? s?.slotName ?? '').trim(),
      slot_time: s?.slot_time ?? s?.slotTime ?? null,
    }))
    .filter((s) => Number.isFinite(s.slot_index) && s.slot_index >= 1)
    .sort((a, b) => a.slot_index - b.slot_index);

  const slotCount = slotRows.length || 1;

  const slotSelectOptions = useMemo(() => {
    if (!slotRows.length) {
      return Array.from({ length: slotCount }, (_, i) => ({ value: String(i + 1), label: `Slot ${i + 1}` }));
    }
    return slotRows.map((s) => {
      const idx = s.slot_index;
      const name = s.slot_name || `Slot ${idx}`;
      const time = s.slot_time ? time12FromHHmm(String(s.slot_time)) : null;
      return { value: String(idx), label: time ? `${name} (${time})` : name };
    });
  }, [slotCount, slotRows]);

  useEffect(() => {
    setSectionId('all');
  }, [classId]);

  useEffect(() => {
    patternLoadedRef.current = false;
    dispatch(clearLecturerAttendance());
    setDraftAbsentById(new Map());
    setLastUpdated(null);
    setPage(1);
  }, [classId, sectionId, selectedDate, dispatch]);

  useEffect(() => {
    setDraftAbsentById(new Map());
    setLastUpdated(null);
    setPage(1);
  }, [slotIndex]);

  useEffect(() => {
    if (slotIndex > slotCount) setSlotIndex(slotCount);
  }, [slotCount, slotIndex]);

  const loadPatternAndRoster = useCallback(async () => {
    if (!selectedDate || classId === 'all') {
      toast.error('Please select a class and date');
      return;
    }
    const sec = sectionId !== 'all' ? sectionId : undefined;
    patternLoadedRef.current = false;
    setDraftAbsentById(new Map());
    try {
      const ctx = await dispatch(
        fetchAttendanceDayContextThunk({ classId, sectionId: sec, date: selectedDate })
      ).unwrap();

      const dow = new Date(`${selectedDate}T12:00:00`).getDay(); // 0=Sun..6=Sat
      const days = Array.isArray(ctx?.days_of_week) ? ctx.days_of_week : [];
      if (!days.includes(dow)) {
        patternLoadedRef.current = false;
        dispatch(clearLecturerAttendance());
        toast.error('No attendance for this day. Please select another day.');
        return;
      }
      patternLoadedRef.current = true;
      await dispatch(
        fetchAttendanceRosterThunk({
          classId,
          sectionId: sec,
          date: selectedDate,
          slotIndex,
        })
      ).unwrap();
    } catch (e) {
      patternLoadedRef.current = false;
      const msg =
        e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e || 'Failed to load');
      toast.error(msg);
    }
  }, [classId, sectionId, selectedDate, slotIndex, dispatch]);

  useEffect(() => {
    if (!patternLoadedRef.current || classId === 'all' || !selectedDate) return;
    const sec = sectionId !== 'all' ? sectionId : undefined;
    dispatch(
      fetchAttendanceRosterThunk({
        classId,
        sectionId: sec,
        date: selectedDate,
        slotIndex,
      })
    );
  }, [slotIndex, classId, sectionId, selectedDate, dispatch]);

  const filteredRoster = useMemo(() => {
    let list = roster ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const hay = `${studentName(s)} ${s.roll_number ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => studentName(a).localeCompare(studentName(b)));
    } else if (sortBy === 'roll') {
      list = [...list].sort((a, b) => String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true }));
    }
    return list;
  }, [roster, search, sortBy]);

  const { totalCount, totalPages, currentPage, pageRows: paged } = usePagedRows(filteredRoster, page, pageSize);

  const currentAbsentById = useMemo(() => {
    const m = new Map();
    for (const s of roster ?? []) m.set(String(s.id), Boolean(s.is_absent));
    return m;
  }, [roster]);

  const effectiveAbsentFor = useCallback(
    (id) => {
      const key = String(id);
      if (draftAbsentById.has(key)) return Boolean(draftAbsentById.get(key));
      return Boolean(currentAbsentById.get(key));
    },
    [draftAbsentById, currentAbsentById]
  );

  const setStudentAbsentDraft = (id, absent) => {
    const key = String(id);
    setDraftAbsentById((prev) => {
      const next = new Map(prev);
      const base = Boolean(currentAbsentById.get(key));
      if (Boolean(absent) === base) next.delete(key);
      else next.set(key, Boolean(absent));
      return next;
    });
  };

  const changes = useMemo(() => {
    const toAbsent = [];
    const toPresent = [];
    for (const s of roster ?? []) {
      const key = String(s.id);
      const base = Boolean(s.is_absent);
      const eff = effectiveAbsentFor(key);
      if (eff === base) continue;
      if (eff) toAbsent.push(s);
      else toPresent.push(s);
    }
    return { toAbsent, toPresent };
  }, [roster, effectiveAbsentFor]);

  const hasChanges = changes.toAbsent.length > 0 || changes.toPresent.length > 0;

  const classSummaryLabel = useMemo(() => {
    if (classId === 'all') return '—';
    const cls = (classes ?? []).find((c) => String(c.id) === String(classId));
    const className = String(cls?.name ?? '').trim() || '—';
    if (sectionId === 'all') return className;
    const sec = cls?.sections?.find((x) => String(x.id) === String(sectionId));
    const secCode = String(sec?.section ?? '').trim();
    if (!secCode) return className;
    return `${className}${secCode}`;
  }, [classId, sectionId, classes]);

  const slotSummaryLabel = useMemo(() => {
    const hit = slotRows.find((s) => Number(s.slot_index) === Number(slotIndex));
    const name = hit?.slot_name ? String(hit.slot_name) : `Slot ${slotIndex}`;
    const t12 = hit?.slot_time ? time12FromHHmm(String(hit.slot_time)) : null;
    return t12 ? `${name} (${t12})` : name;
  }, [slotRows, slotIndex]);

  const saveChanges = async () => {
    if (classId === 'all' || !selectedDate) return;
    const sec = sectionId !== 'all' ? sectionId : undefined;
    try {
      if (changes.toAbsent.length) {
        await dispatch(
          bulkMarkAbsentThunk({
            studentIds: changes.toAbsent.map((s) => s.id),
            absentDate: selectedDate,
            slotIndex,
            reason: null,
            classId,
            sectionId: sec,
          })
        ).unwrap();
      }
      if (changes.toPresent.length) {
        await dispatch(
          bulkUnmarkAbsentThunk({
            studentIds: changes.toPresent.map((s) => s.id),
            absentDate: selectedDate,
            slotIndex,
            classId,
            sectionId: sec,
          })
        ).unwrap();
      }
      toast.success('Attendance saved');
      setConfirmOpen(false);
      setDraftAbsentById(new Map());
      setLastUpdated({
        at: new Date().toISOString(),
        by: user?.name ? String(user.name) : null,
        date: selectedDate,
        classId,
        sectionId: sec ?? null,
        slotIndex,
      });
      await dispatch(
        fetchAttendanceRosterThunk({
          classId,
          sectionId: sec,
          date: selectedDate,
          slotIndex,
        })
      ).unwrap();
    } catch (e) {
      toast.error(String(e || 'Failed to save attendance'));
    }
  };

  const handleCancelSlot = async () => {
    if (classId === 'all' || !selectedDate) return;
    const sec = sectionId !== 'all' ? sectionId : undefined;
    try {
      await dispatch(
        cancelSlotThunk({
          date: selectedDate,
          slotIndex,
          classId,
          sectionId: sec,
          reason: cancelReason.trim() || null,
        })
      ).unwrap();
      toast.success('Period marked as class not taken');
      setCancelDialogOpen(false);
      setCancelReason('');
      setDraftAbsentById(new Map());
    } catch (e) {
      toast.error(String(e || 'Failed to cancel slot'));
    }
  };

  const handleRestoreSlot = async () => {
    if (classId === 'all' || !selectedDate) return;
    const sec = sectionId !== 'all' ? sectionId : undefined;
    try {
      await dispatch(
        uncancelSlotThunk({ date: selectedDate, slotIndex, classId, sectionId: sec })
      ).unwrap();
      toast.success('Period restored. Attendance will now count for this slot.');
      setRestoreDialogOpen(false);
      await dispatch(
        fetchAttendanceRosterThunk({ classId, sectionId: sec, date: selectedDate, slotIndex })
      ).unwrap();
    } catch (e) {
      toast.error(String(e || 'Failed to restore slot'));
    }
  };

  const institutionHoliday = dayContextStatus === 'failed' && dayContextHoliday;
  const noPattern = dayContextStatus === 'failed' && dayContextError && !institutionHoliday;
  const shouldShowLastUpdated =
    lastUpdated &&
    lastUpdated.date === selectedDate &&
    String(lastUpdated.classId) === String(classId) &&
    String(lastUpdated.sectionId ?? '') === String((sectionId !== 'all' ? sectionId : null) ?? '') &&
    Number(lastUpdated.slotIndex) === Number(slotIndex);

  const lastUpdatedText = useMemo(() => {
    if (!shouldShowLastUpdated) return null;
    const d = new Date(lastUpdated.at);
    if (Number.isNaN(d.getTime())) return null;
    const when = d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const who = lastUpdated.by ? ` by ${lastUpdated.by}` : '';
    return `Last updated: ${when}${who}`;
  }, [lastUpdated, shouldShowLastUpdated]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"      />

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <DatePicker
                selected={parseApiDateOnly(selectedDate)}
                onChange={(d) => setSelectedDate(d ? formatDateOnlyLocal(d) : '')}
                dateFormat="dd-MM-yyyy"
                maxDate={parseApiDateOnly(todayIso) ?? new Date()}
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={<DatePickerInput placeholder="dd-mm-yyyy" className="w-full" />}
                wrapperClassName="w-full"
                popperPlacement="bottom-start"
              />
            </div>
            <FormSelect
              id="att-class"
              label="Class"
              value={classId}
              onValueChange={setClassId}
              options={[{ value: 'all', label: 'Select class…' }, ...classOptions]}
              placeholder="Class"
            />
            <FormSelect
              id="att-section"
              label="Section"
              value={sectionId}
              onValueChange={setSectionId}
              options={[{ value: 'all', label: 'All sections' }, ...sectionOptions]}
              placeholder={classId && classId !== 'all' ? 'Section' : 'Select class first'}
            />
            {dayContextStatus === 'succeeded' && slotCount > 1 ? (
              <FormSelect
                id="att-slot"
                label="Slot"
                value={String(slotIndex)}
                onValueChange={(v) => setSlotIndex(Number(v))}
                options={slotSelectOptions}
              />
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
            <Button type="button" className="w-full sm:w-auto" onClick={loadPatternAndRoster} disabled={classId === 'all' || rosterStatus === 'loading'}>
              {rosterStatus === 'loading' ? 'Loading…' : 'Load students'}
            </Button>
            {dayContextStatus === 'succeeded' && rosterStatus === 'succeeded' && !isSlotCancelled ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelSlotStatus === 'loading'}
                className="w-full sm:w-auto"
              >
                <Ban className="h-4 w-4 mr-1.5" />
                Mark Class Cancelled
              </Button>
            ) : null}
          </div>

          {dayContextStatus === 'loading' ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : dayContextStatus === 'succeeded' && dayContext ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Pattern:</span> {dayContext.name ?? '—'} ·{' '}
              <span className="font-medium text-gray-900">Scope:</span> {scopeLabel(dayContext.scope)}
            </div>
          ) : null}

          {institutionHoliday ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
              <div>{dayContextError}</div>
              <div className="mt-1 text-xs text-sky-900">
                No roster is loaded on holidays. Update the calendar under{' '}
                <span className="font-semibold">Admin → Attendance config → Manage Holiday</span> if needed.
              </div>
            </div>
          ) : null}
          {noPattern ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No attendance pattern applies for this class, section, and date. Ask an administrator to configure an active
              pattern in <span className="font-semibold">Admin → Attendance config</span>.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Students</CardTitle>
              {!isSlotCancelled ? (
                <CardDescription>
                  Save to apply changes.
                </CardDescription>
              ) : null}
              {lastUpdatedText && !isSlotCancelled ? <div className="mt-1 text-xs text-gray-500">{lastUpdatedText}</div> : null}
            </div>
            {!isSlotCancelled ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-end gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-[260px]">
                  <label className="text-sm font-medium text-gray-700">Search</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Name or roll number"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 sm:flex-none"
                    disabled={!hasChanges || bulkStatus === 'loading' || classId === 'all' || dayContextStatus !== 'succeeded'}
                    onClick={() => setDraftAbsentById(new Map())}
                  >
                    Reset changes
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 sm:flex-none"
                    disabled={!hasChanges || bulkStatus === 'loading' || classId === 'all' || dayContextStatus !== 'succeeded'}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {isSlotCancelled ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <Ban className="h-5 w-5 text-amber-700" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-amber-900">Class not taken</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    {slotSummaryLabel} on {formatDisplayDate(selectedDate)} was marked as class not taken.
                    This period is excluded from attendance calculations.
                  </p>
                  {cancelledSlotReason ? (
                    <p className="mt-2 text-xs text-amber-700">
                      <span className="font-medium">Reason:</span> {cancelledSlotReason}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setRestoreDialogOpen(true)}
                    disabled={cancelSlotStatus === 'loading'}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Restore this period
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {rosterError ? <div className="text-sm text-red-600 mb-3">{String(rosterError)}</div> : null}
              {rosterStatus === 'loading' ? (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[140px]">Set</TableHead>
                          <TableHead>Roll</TableHead>
                          <TableHead>Student</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableSkeletonRows columns={3} rows={5} />
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : !roster.length && rosterStatus === 'succeeded' ? (
                <div className="text-sm text-gray-600">No students found. Adjust filters and load roster.</div>
              ) : null}

              {roster.length > 0 && rosterStatus !== 'loading' ? (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-[140px]">Set</TableHead>
                          <TableHead>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 hover:text-gray-900 ${sortBy === 'roll' ? 'text-gray-900 font-semibold' : ''}`}
                              onClick={() => setSortBy(sortBy === 'roll' ? 'default' : 'roll')}
                            >
                              Roll
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              type="button"
                              className={`inline-flex items-center gap-1 hover:text-gray-900 ${sortBy === 'name' ? 'text-gray-900 font-semibold' : ''}`}
                              onClick={() => setSortBy(sortBy === 'name' ? 'default' : 'name')}
                            >
                              Student
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paged.map((s) => {
                          const id = String(s.id);
                          const absent = effectiveAbsentFor(id);
                          return (
                            <TableRow key={id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={!absent}
                                    onCheckedChange={(checked) => setStudentAbsentDraft(id, !checked)}
                                    aria-label={`Set ${studentName(s)} as ${absent ? 'present' : 'absent'}`}
                                    className={`${absent ? 'bg-red-600' : 'bg-green-600'} scale-90`}
                                  />
                                  <span className={`text-xs font-medium ${absent ? 'text-red-700' : 'text-green-700'}`}>
                                    {absent ? 'Absent' : 'Present'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-gray-900">{s.roll_number ?? '—'}</TableCell>
                              <TableCell className="text-gray-700">{studentName(s)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}

              {roster.length > 0 && rosterStatus !== 'loading' ? (
                <TablePagination
                  className="mt-4"
                  page={currentPage}
                  pageSize={pageSize}
                  pageSizeOptions={[10, 25, 50, 60]}
                  totalCount={totalCount}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-5 sm:pr-6">
            <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 sm:mx-0">
              <AlertTriangle className="h-7 w-7 text-amber-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="text-center sm:text-left">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Confirm attendance changes
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm text-gray-700">
                  Review what will be updated for this date and slot.
                </DialogDescription>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                <div className="font-medium text-gray-500 uppercase tracking-wide text-xs mb-3">Summary</div>
                <dl className="grid gap-2 sm:grid-cols-1">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600">Date</dt>
                    <dd className="font-medium text-gray-900 text-right">{formatDisplayDate(selectedDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600">Slot</dt>
                    <dd className="font-medium text-gray-900 text-right">{slotSummaryLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600">Class</dt>
                    <dd className="font-medium text-gray-900 text-right">{classSummaryLabel}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Changes</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-1">Will mark absent</div>
                    {changes.toAbsent.length ? (
                      <ul className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-gray-100 bg-white px-3 py-2 text-sm text-gray-800">
                        {changes.toAbsent.map((s) => (
                          <li key={String(s.id)}>• {studentName(s)} ({s.roll_number ?? '—'})</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-600">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-1">Will mark present (remove absence)</div>
                    {changes.toPresent.length ? (
                      <ul className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-gray-100 bg-white px-3 py-2 text-sm text-gray-800">
                        {changes.toPresent.map((s) => (
                          <li key={String(s.id)}>• {studentName(s)} ({s.roll_number ?? '—'})</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-gray-600">—</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={bulkStatus === 'loading'}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveChanges} disabled={bulkStatus === 'loading' || !hasChanges}>
                  {bulkStatus === 'loading' ? 'Saving…' : 'Confirm & save'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-5 sm:pr-6">
            <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 sm:mx-0">
              <Ban className="h-7 w-7 text-amber-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="text-center sm:text-left">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Mark class as not taken?
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm text-gray-700">
                  This will mark <span className="font-medium">{slotSummaryLabel}</span> on{' '}
                  <span className="font-medium">{formatDisplayDate(selectedDate)}</span> for{' '}
                  <span className="font-medium">{classSummaryLabel}</span> as not taken.
                  This period will not count towards student attendance calculations.
                </DialogDescription>
              </div>

              <div className="space-y-2">
                <label htmlFor="cancel-reason" className="text-sm font-medium text-gray-700">
                  Reason <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="cancel-reason"
                  type="text"
                  autoComplete="off"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Teacher absent, School event"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setCancelDialogOpen(false); setCancelReason(''); }}
                  disabled={cancelSlotStatus === 'loading'}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelSlot}
                  disabled={cancelSlotStatus === 'loading'}
                >
                  {cancelSlotStatus === 'loading' ? 'Saving…' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-5 sm:pr-6">
            <div className="mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 sm:mx-0">
              <RotateCcw className="h-7 w-7 text-blue-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="text-center sm:text-left">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Restore this period?
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm text-gray-700">
                  Are you sure you want to restore <span className="font-medium">{slotSummaryLabel}</span> on{' '}
                  <span className="font-medium">{formatDisplayDate(selectedDate)}</span>?
                  Student absences for this slot will count again in attendance calculations.
                </DialogDescription>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setRestoreDialogOpen(false)}
                  disabled={cancelSlotStatus === 'loading'}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleRestoreSlot}
                  disabled={cancelSlotStatus === 'loading'}
                >
                  {cancelSlotStatus === 'loading' ? 'Restoring…' : 'Confirm restore'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
