import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

export function LecturerViewDialog({ open, onOpenChange, lecturer }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {lecturer ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pr-10">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Staff</div>
                <div className="truncate text-xl font-semibold text-gray-900">
                  {[lecturer.title, lecturer.first_name, lecturer.last_name].filter(Boolean).join(' ') || '—'}
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  Employee ID:{' '}
                  <span className="font-medium text-gray-900">{lecturer.employee_id ?? '—'}</span>
                </div>
              </div>
              <div className="text-sm text-gray-700 text-right">
                <div>
                  <span className="text-gray-500">Email</span>{' '}
                  <span className="font-medium text-gray-900">{lecturer.email ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Phone</span>{' '}
                  <span className="font-medium text-gray-900">{lecturer.phone ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Basic Info</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">Title</div>
                    <div className="text-sm font-medium text-gray-900">{lecturer.title ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">First Name</div>
                    <div className="text-sm font-medium text-gray-900">{lecturer.first_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Last Name</div>
                    <div className="text-sm font-medium text-gray-900">{lecturer.last_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Date of Birth</div>
                    <div className="text-sm font-medium text-gray-900">
                      {lecturer.date_of_birth ? String(lecturer.date_of_birth).slice(0, 10) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Member since</div>
                    <div className="text-sm font-medium text-gray-900">
                      {lecturer.created_at ? String(lecturer.created_at).slice(0, 10) : '—'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Subjects</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {String(lecturer.subjects || '')
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 50)
                      .map((subject) => (
                        <Badge key={subject} variant="secondary" className="text-xs">
                          {subject}
                        </Badge>
                      ))}
                    {String(lecturer.subjects || '').trim() === '' ? (
                      <span className="text-sm text-gray-600">—</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-gray-600">No staff selected.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
