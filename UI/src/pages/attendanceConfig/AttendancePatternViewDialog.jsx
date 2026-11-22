import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import {
  classNameById,
  daysCompact,
  DOW,
  fmtDateRange,
  normalizeSlotsArray,
  scopeLabel,
  sectionNameById,
} from './attendanceConfigHelpers';

export function AttendancePatternViewDialog({ open, onOpenChange, pattern, classes, onEdit }) {
  const same = (pattern?.same_slots_all_days ?? pattern?.sameSlotsAllDays);
  const slotsGlobal = normalizeSlotsArray(pattern?.slots_global ?? pattern?.slotsGlobal);
  const slotsByDow = pattern?.slots_by_dow ?? pattern?.slotsByDow;
  const dowLabel = (key) => DOW.find((d) => String(d.id) === String(key))?.short ?? String(key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {pattern ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Attendance Pattern</div>
                <div className="truncate text-xl font-semibold text-gray-900">{pattern.name}</div>
              </div>
              <div className="flex items-center gap-2 mt-6 mr-8">
                <Badge variant="secondary">{scopeLabel(pattern.scope)}</Badge>
                <Badge variant={pattern.is_active === false ? 'outline' : 'default'}>
                  {pattern.is_active === false ? 'Inactive' : 'Active'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Scope</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Scope</div>
                    <div className="text-sm font-medium text-gray-900">{scopeLabel(pattern.scope)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Class</div>
                    <div className="text-sm font-medium text-gray-900">
                      {pattern.scope === 'global' ? '—' : classNameById(classes, pattern.class_id ?? pattern.classId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Section</div>
                    <div className="text-sm font-medium text-gray-900">
                      {pattern.scope !== 'section'
                        ? '—'
                        : sectionNameById(classes, pattern.class_id ?? pattern.classId, pattern.section_id ?? pattern.sectionId)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Schedule</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Date range</div>
                    <div className="text-sm font-medium text-gray-900">
                      {fmtDateRange(pattern.start_date ?? pattern.startDate, pattern.end_date ?? pattern.endDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Days</div>
                    <div className="text-sm font-medium text-gray-900">
                      {daysCompact(pattern.days_of_week ?? pattern.daysOfWeek) || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Status</div>
                    <div className="text-sm font-medium text-gray-900">{pattern.is_active === false ? 'Inactive' : 'Active'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Slots</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {same === true && slotsGlobal.length ? (
                    <div>
                      <div className="text-xs text-gray-500">Slots (same for all working days)</div>
                      <div className="text-sm font-medium text-gray-900">
                        {slotsGlobal
                          .map((s) => String(s?.slot_name ?? s?.name ?? '').trim())
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </div>
                    </div>
                  ) : same === false && slotsByDow && typeof slotsByDow === 'object' ? (
                    <div>
                      <div className="text-xs text-gray-500">Slots (varies by day)</div>
                      <div className="mt-2 space-y-2">
                        {Object.entries(slotsByDow).length ? (
                          Object.entries(slotsByDow).map(([dow, list]) => (
                            <div key={dow} className="flex items-start gap-3">
                              <div className="w-20 text-xs font-semibold text-gray-600">{dowLabel(dow)}</div>
                              <div className="text-sm font-medium text-gray-900">
                                {normalizeSlotsArray(list)
                                  .map((s) => String(s?.slot_name ?? s?.name ?? '').trim())
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm font-medium text-gray-900">—</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-gray-500">Slots per day</div>
                        <div className="text-sm font-medium text-gray-900">{pattern.slots_per_day ?? pattern.slotsPerDay ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Slot times</div>
                        <div className="text-sm font-medium text-gray-900">
                          {Array.isArray(pattern.slot_times ?? pattern.slotTimes) && (pattern.slot_times ?? pattern.slotTimes).length
                            ? (pattern.slot_times ?? pattern.slotTimes).join(', ')
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" onClick={onEdit}>
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-gray-600">Pattern not found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

