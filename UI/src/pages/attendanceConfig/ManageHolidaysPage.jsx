import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DeleteConfirmDialog } from '../../components/common/DeleteConfirmDialog';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { formatDateOnlyLocal, parseApiDateOnly } from '../../utils/dateOnly';
import {
  createSchoolHolidayThunk,
  deleteSchoolHolidayThunk,
  fetchSchoolHolidaysThunk,
  updateSchoolHolidayThunk,
} from '../../features/schoolHolidays/schoolHolidaysSlice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

function formatDisplayDate(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return '—';
  const d = new Date(`${yyyyMmDd.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(yyyyMmDd);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ManageHolidaysPage() {
  const dispatch = useDispatch();
  const items = useSelector((s) => s.schoolHolidays.items);
  const status = useSelector((s) => s.schoolHolidays.status);
  const loadError = useSelector((s) => s.schoolHolidays.error);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', is_active: true });
  const [deleteId, setDeleteId] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    dispatch(fetchSchoolHolidaysThunk({}));
  }, [dispatch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sorted = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : [];
    list.sort((a, b) => {
      const da = String(a.start_date ?? '');
      const db = String(b.start_date ?? '');
      if (da !== db) return da.localeCompare(db);
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
    return list;
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', start_date: '', end_date: '', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: String(row.name ?? ''),
      start_date: String(row.start_date ?? '').slice(0, 10),
      end_date: String(row.end_date ?? '').slice(0, 10),
      is_active: row.is_active !== false,
    });
    setDialogOpen(true);
  };

  const saveHoliday = async () => {
    const name = String(form.name ?? '').trim();
    if (!name || name.length > 150) {
      toast.error('Holiday name is required (max 150 characters)');
      return;
    }
    if (!form.start_date) {
      toast.error('Start date is required');
      return;
    }
    const endDate = String(form.end_date ?? '').trim() || form.start_date;
    if (endDate < form.start_date) {
      toast.error('End date must be on or after start date');
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await dispatch(
          updateSchoolHolidayThunk({
            id: editing.id,
            payload: {
              name,
              start_date: form.start_date,
              end_date: endDate,
              is_active: form.is_active,
            },
          })
        ).unwrap();
        toast.success('Holiday updated');
      } else {
        await dispatch(
          createSchoolHolidayThunk({
            name,
            start_date: form.start_date,
            end_date: String(form.end_date ?? '').trim() ? form.end_date : undefined,
          })
        ).unwrap();
        toast.success('Holiday created');
      }
      setDialogOpen(false);
      reload();
    } catch (e) {
      toast.error(String(e || 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await dispatch(deleteSchoolHolidayThunk(deleteId)).unwrap();
      toast.success('Holiday deleted');
      setDeleteOpen(false);
      setDeleteId(null);
      reload();
    } catch (e) {
      toast.error(String(e || 'Delete failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/admin/attendance-config"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to attendance configuration
          </Link>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">School holidays</h2>
          <p className="text-gray-600 mt-1">Attendance is blocked on these dates.</p>
        </div>
        <Button type="button" className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Add holiday
        </Button>
      </div>

      {loadError && status === 'failed' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{String(loadError)}</div>
      ) : null}

      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Holidays</CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' ? <div className="text-sm text-gray-600">Loading…</div> : null}
          {!sorted.length && status === 'succeeded' ? (
            <div className="text-sm text-gray-600">No holidays yet. Add one to block attendance on those dates.</div>
          ) : null}

          {sorted.length > 0 ? (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Name</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((row) => (
                      <TableRow key={String(row.id)}>
                        <TableCell className="font-medium text-gray-900">{row.name ?? '—'}</TableCell>
                        <TableCell className="text-gray-700">{formatDisplayDate(row.start_date)}</TableCell>
                        <TableCell className="text-gray-700">{formatDisplayDate(row.end_date)}</TableCell>
                        <TableCell>
                          {row.is_active !== false ? (
                            <Badge className="bg-emerald-600">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1 justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={() => openEdit(row)}
                              aria-label="Edit holiday"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="gap-1 text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setDeleteId(row.id);
                                setDeleteOpen(true);
                              }}
                              aria-label="Delete holiday"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle className="text-lg font-semibold text-gray-900 pr-10">
            {editing ? 'Edit school holiday' : 'Add school holiday'}
          </DialogTitle>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                maxLength={150}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="holiday-start-date" className="text-sm font-medium text-gray-700">
                  Start date *
                </label>
                <div className="mt-1">
                  <DatePicker
                    selected={parseApiDateOnly(form.start_date)}
                    onChange={(d) =>
                      setForm((p) => ({ ...p, start_date: d ? formatDateOnlyLocal(d) : '' }))
                    }
                    dateFormat="dd-MM-yyyy"
                    preventOpenOnFocus
                    shouldCloseOnSelect
                    customInput={
                      <DatePickerInput id="holiday-start-date" placeholder="dd-mm-yyyy" className="w-full" />
                    }
                    wrapperClassName="w-full"
                    popperPlacement="bottom-start"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="holiday-end-date" className="text-sm font-medium text-gray-700">
                  End date <span className="font-normal text-gray-500">(inclusive)</span>
                </label>
                <div className="mt-1">
                  <DatePicker
                    selected={parseApiDateOnly(form.end_date)}
                    onChange={(d) =>
                      setForm((p) => ({ ...p, end_date: d ? formatDateOnlyLocal(d) : '' }))
                    }
                    dateFormat="dd-MM-yyyy"
                    isClearable
                    preventOpenOnFocus
                    shouldCloseOnSelect
                    customInput={
                      <DatePickerInput id="holiday-end-date" placeholder="dd-mm-yyyy" className="w-full" />
                    }
                    wrapperClassName="w-full"
                    popperPlacement="bottom-start"
                  />
                </div>
              </div>
            </div>
            {editing ? (
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>
            ) : null}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveHoliday} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setDeleteId(null);
        }}
        title="Delete holiday?"
        description="This removes the holiday record. Attendance will be available again for those dates unless another holiday covers them."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
