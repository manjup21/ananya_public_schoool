import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { FormSelect } from '../../components/common/FormSelect';
import { DOW, SCOPE_FORM_OPTIONS } from './attendanceConfigHelpers';
import { Switch } from '../../components/ui/switch';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';

export function AttendancePatternFormDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  isEditing = false,
  form,
  errors,
  classOptionsForm,
  sectionOptionsForm,
  onChangeName,
  onChangeScope,
  onChangeClass,
  onChangeSection,
  onToggleSection,
  onChangeStartDate,
  onChangeEndDate,
  onToggleDay,
  onToggleSameSlotsAllDays,
  onAddSlot,
  onRemoveSlot,
  onMoveSlot,
  onChangeSlotName,
  onApplyPreset,
  onCopySlotsDay,
  onPasteSlotsDay,
  onCancel,
  onSave,
  saving = false,
}) {
  const workingDays = Array.isArray(form.daysOfWeek) ? form.daysOfWeek : [];
  const sameSlotsAllDays = form.sameSlotsAllDays !== false;
  const slotsGlobal = Array.isArray(form.slotsGlobal) ? form.slotsGlobal : [];
  const slotsByDow = form.slotsByDow && typeof form.slotsByDow === 'object' ? form.slotsByDow : {};

  const selectedWorkingDays = DOW.filter((d) => workingDays.includes(d.id));
  const firstDayId = selectedWorkingDays[0]?.id ?? null;

  const [activeDayId, setActiveDayId] = useState(firstDayId);
  const hasClipboard = Boolean(form?.__slotsClipboard?.slots?.length);
  const clipboardFromDayId = form?.__slotsClipboard?.fromDayId ?? null;

  useEffect(() => {
    if (sameSlotsAllDays) return;
    const ids = selectedWorkingDays.map((d) => d.id);
    if (!ids.length) {
      setActiveDayId(null);
      return;
    }
    if (activeDayId == null || !ids.includes(activeDayId)) {
      setActiveDayId(ids[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameSlotsAllDays, workingDays]);

  const slotsForActiveDay = !sameSlotsAllDays && activeDayId != null
    ? (Array.isArray(slotsByDow[activeDayId]) ? slotsByDow[activeDayId] : [])
    : [];

  const showEditor = sameSlotsAllDays ? true : activeDayId != null;

  const slotList = sameSlotsAllDays ? slotsGlobal : slotsForActiveDay;

  const slotsEmpty = !Array.isArray(slotList) || slotList.length < 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pattern-name">Pattern Name *</Label>
              <Input
                id="pattern-name"
                placeholder=""
                value={form.name}
                onChange={(e) => onChangeName(e.target.value)}
              />
              {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
            </div>

            <FormSelect
              id="pattern-scope"
              label="Scope"
              required
              value={form.scope}
              onValueChange={onChangeScope}
              options={SCOPE_FORM_OPTIONS}
              placeholder="Select scope"
              error={errors.scope}
            />
          </div>

          {(form.scope === 'class' || form.scope === 'section') ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect
                id="pattern-class"
                label="Class"
                required
                value={form.classId}
                onValueChange={onChangeClass}
                options={classOptionsForm}
                placeholder="Select class"
                error={errors.classId}
              />
              {form.scope === 'section' ? (
                isEditing ? (
                  <FormSelect
                    id="pattern-section"
                    label="Section"
                    required
                    value={form.sectionId}
                    onValueChange={onChangeSection}
                    options={sectionOptionsForm}
                    placeholder="Select section"
                    error={errors.sectionId}
                  />
                ) : (
                  <div className="space-y-2">
                    <Label>Sections *</Label>
                    <div className="rounded-md border border-gray-200 bg-white p-3 max-h-44 overflow-y-auto">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sectionOptionsForm
                          .filter((o) => (typeof o === 'string' ? o : o.value) !== '')
                          .map((opt) => {
                            const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
                            const checked = (form.sectionIds ?? []).includes(o.value);
                            return (
                              <label key={o.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <Checkbox checked={checked} onCheckedChange={() => onToggleSection?.(o.value)} />
                                <span className="font-medium">{o.label}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Selected: <span className="font-medium text-gray-900">{(form.sectionIds ?? []).length}</span>
                    </div>
                    {errors.sectionIds ? <p className="text-xs text-red-600">{errors.sectionIds}</p> : null}
                  </div>
                )
              ) : (
                <div />
              )}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <DatePicker
                selected={form.startDate}
                onChange={onChangeStartDate}
                dateFormat="yyyy-MM-dd"
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={<DatePickerInput placeholder="Select start date" className="w-full" />}
                wrapperClassName="w-full"
              />
              {errors.startDate ? <p className="text-xs text-red-600">{errors.startDate}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <DatePicker
                selected={form.endDate}
                onChange={onChangeEndDate}
                dateFormat="yyyy-MM-dd"
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={<DatePickerInput placeholder="Select end date" className="w-full" />}
                wrapperClassName="w-full"
              />
              {errors.endDate ? <p className="text-xs text-red-600">{errors.endDate}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Working days *</Label>
            <div className="flex flex-wrap gap-3">
              {DOW.map((d) => {
                const checked = (form.daysOfWeek ?? []).includes(d.id);
                return (
                  <label
                    key={d.id}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => onToggleDay(d.id)} />
                    <span className="font-medium">{d.short}</span>
                  </label>
                );
              })}
            </div>
            {errors.daysOfWeek ? <p className="text-xs text-red-600">{errors.daysOfWeek}</p> : null}
            <p className="text-xs text-gray-500">Attendance can be taken only on selected working days.</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-900">Attendance slots</div>
                <div className="text-xs text-gray-500">Define the slot names used while taking attendance.</div>
              </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Label htmlFor="same-slots" className="text-sm text-gray-700">
                  Use same slots for all working days
                </Label>
                <Switch
                  id="same-slots"
                  checked={sameSlotsAllDays}
                  onCheckedChange={(v) => onToggleSameSlotsAllDays?.(v)}
                />
              </div>
            </div>

            {!sameSlotsAllDays ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {selectedWorkingDays.map((d) => {
                    const isActive = d.id === activeDayId;
                    return (
                      <Button
                        key={d.id}
                        type="button"
                        variant={isActive ? 'default' : 'outline'}
                        className="h-8 px-3"
                        onClick={() => setActiveDayId(d.id)}
                      >
                        {d.short}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    Configure slots for <span className="font-medium text-gray-900">{DOW.find((d) => d.id === activeDayId)?.label ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => onCopySlotsDay?.(activeDayId)}
                      disabled={activeDayId == null}
                      title="Copy slots for this day"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    {hasClipboard && activeDayId != null && clipboardFromDayId !== activeDayId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => onPasteSlotsDay?.(activeDayId)}
                        title="Paste copied slots into this day"
                      >
                        Paste
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onApplyPreset?.('daily')}>
                Daily
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onApplyPreset?.('twice')}>
                Morning / Afternoon
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onApplyPreset?.('periods8')}>
                Periods 1–8
              </Button>
            </div>

            {showEditor ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-900">{sameSlotsAllDays ? 'Slots' : 'Slots for this day'}</div>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onAddSlot?.(activeDayId)}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add slot</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {slotsEmpty ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                      No slots yet. Click <span className="font-medium">Add slot</span> or use a preset.
                    </div>
                  ) : (
                    <div key={`${sameSlotsAllDays ? 'global' : String(activeDayId)}`}>
                      {slotList.map((slot, idx) => (
                        <div key={slot.id ?? `${idx}`} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
                        <div className="w-10 text-xs font-semibold text-gray-600 text-center">{idx + 1}</div>
                        <Input
                          value={slot.name ?? ''}
                          onChange={(e) => onChangeSlotName?.(activeDayId, slot.id, e.target.value)}
                          placeholder=""
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onMoveSlot?.(activeDayId, slot.id, 'up')}
                            disabled={idx === 0}
                            title="Move up"
                            aria-label="Move slot up"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onMoveSlot?.(activeDayId, slot.id, 'down')}
                            disabled={idx === slotList.length - 1}
                            title="Move down"
                            aria-label="Move slot down"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveSlot?.(activeDayId, slot.id)}
                            title="Delete"
                            aria-label="Delete slot"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                      ))}
                    </div>
                  )}
                </div>

                {errors.slots ? <p className="text-xs text-red-600">{errors.slots}</p> : null}
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                Select at least one working day to configure slots.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

