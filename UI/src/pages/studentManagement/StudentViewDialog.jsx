import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { formatStudentGender, formatStudentResidenceType } from '../../utils/studentDisplay';
import { fetchStudentPhotoObjectUrl } from '../../features/students/studentsSlice';

export function StudentViewDialog({
  open,
  onOpenChange,
  student,
  classes,
  status,
  viewingStudentId,
}) {
  const klass = student ? classes.find((c) => c.id === student.class_id) : null;
  const section =
    student && student.section_id
      ? klass?.sections?.find((s) => s.id === student.section_id) ?? null
      : null;

  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    async function loadPhoto() {
      if (!open || !student?.id || !student?.photo_path) {
        setPhotoUrl('');
        return;
      }
      try {
        objectUrl = await fetchStudentPhotoObjectUrl(student.id);
        if (!cancelled) setPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) setPhotoUrl('');
      }
    }

    loadPhoto();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, student?.id, student?.photo_path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {student ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pr-10">
              <div className="flex min-w-0 items-start gap-3">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Passport"
                    className="h-24 w-20 shrink-0 rounded border border-gray-200 object-cover bg-gray-50"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">Student</div>
                  <div className="truncate text-xl font-semibold text-gray-900">
                    {[student.first_name, student.last_name].filter(Boolean).join(' ')}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    Roll No:{' '}
                    <span className="font-medium text-gray-900">{student.roll_number ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-700 text-right">
                <div>
                  <span className="text-gray-500">Class</span>{' '}
                  <span className="font-medium text-gray-900">{klass?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Section</span>{' '}
                  <span className="font-medium text-gray-900">{section?.section ?? '—'}</span>
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
                    <div className="text-xs text-gray-500">Gender</div>
                    <div className="text-sm font-medium text-gray-900">{formatStudentGender(student.gender)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Date of Birth</div>
                    <div className="text-sm font-medium text-gray-900">
                      {student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Residence Type</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatStudentResidenceType(student.residence_type)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Blood Group</div>
                    <div className="text-sm font-medium text-gray-900">{student.blood_group ?? '—'}</div>
                  </div>
                  <div className="sm:col-span-3">
                    <div className="text-xs text-gray-500">Specialisation</div>
                    <div className="text-sm font-medium text-gray-900">{student.specialisation ?? '—'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Guardian Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-500">Father Name</div>
                    <div className="text-sm font-medium text-gray-900">{student.father_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Mother Name</div>
                    <div className="text-sm font-medium text-gray-900">{student.mother_name ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Guardian Email</div>
                    <div className="text-sm font-medium text-gray-900">{student.guardian_email ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Guardian Phone</div>
                    <div className="text-sm font-medium text-gray-900">{student.guardian_phone ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Emergency Contact</div>
                    <div className="text-sm font-medium text-gray-900">
                      {student.emergency_contact_number ?? '—'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">Address</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <div className="text-xs text-gray-500">Location</div>
                    <div className="text-sm font-medium text-gray-900">{student.address_location ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">City</div>
                    <div className="text-sm font-medium text-gray-900">{student.address_city ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">District</div>
                    <div className="text-sm font-medium text-gray-900">{student.address_district ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">State</div>
                    <div className="text-sm font-medium text-gray-900">{student.address_state ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">PIN</div>
                    <div className="text-sm font-medium text-gray-900">{student.address_pin ?? '—'}</div>
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
        ) : status === 'loading' && viewingStudentId ? (
          <div className="py-6 text-sm text-gray-600">Loading…</div>
        ) : viewingStudentId ? (
          <div className="py-6 text-sm text-gray-600">Student not found.</div>
        ) : (
          <div className="py-6 text-sm text-gray-600">No student selected.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
