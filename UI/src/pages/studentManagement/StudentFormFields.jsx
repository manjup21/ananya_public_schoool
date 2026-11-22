import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { FormSelect } from '../../components/common/FormSelect';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import {
  sanitizeNameInput,
  normalizeIndiaPhone,
  STUDENT_PHOTO_ACCEPT,
  validateStudentPhotoFile,
} from './studentFormHelpers';
import { processPassportPhoto, PASSPORT_PHOTO } from '../../utils/passportPhoto';
import { STUDENT_GENDER_OPTIONS, STUDENT_RESIDENCE_TYPE_OPTIONS } from '../../utils/studentDisplay';
import { fetchStudentPhotoObjectUrl } from '../../features/students/studentsSlice';
import { toast } from 'sonner';

/**
 * Shared field set for the Add / Edit Student dialogs.
 *
 * Props:
 *  - form / updateForm: the student form state and setter (camelCase).
 *  - classes: list of classes from the store.
 *  - classSections: sections for the currently selected class.
 *  - idPrefix: string prepended to input ids so Add + Edit dialogs don't collide
 *    when both are rendered in the DOM at the same time.
 *  - studentId: when editing, used to load existing photo preview.
 */
export function StudentFormFields({
  form,
  updateForm,
  classes,
  classSections,
  idPrefix = '',
  studentId = null,
}) {
  const withId = (name) => (idPrefix ? `${idPrefix}-${name}` : name);
  const sectionRequired = classSections.length > 0;
  const photoInputRef = useRef(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const hasPreview = Boolean(
    form.photoPreviewUrl || (form.existingPhotoPath && !form.removeExistingPhoto && existingPhotoUrl)
  );

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    async function loadExisting() {
      if (!studentId || !form.existingPhotoPath || form.removeExistingPhoto || form.photoFile) {
        setExistingPhotoUrl('');
        return;
      }
      try {
        objectUrl = await fetchStudentPhotoObjectUrl(studentId);
        if (!cancelled) setExistingPhotoUrl(objectUrl);
      } catch {
        if (!cancelled) setExistingPhotoUrl('');
      }
    }

    loadExisting();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [studentId, form.existingPhotoPath, form.removeExistingPhoto, form.photoFile]);

  const clearPhoto = () => {
    if (form.photoPreviewUrl) URL.revokeObjectURL(form.photoPreviewUrl);
    if (photoInputRef.current) photoInputRef.current.value = '';
    updateForm({
      photoFile: null,
      photoPreviewUrl: '',
      removeExistingPhoto: Boolean(form.existingPhotoPath),
    });
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          id={withId('gender')}
          label="Gender"
          required
          value={form.gender}
          onValueChange={(v) => updateForm({ gender: v })}
          placeholder="Select gender"
          options={STUDENT_GENDER_OPTIONS}
        />
        <div className="space-y-2">
          <Label htmlFor={withId('roll-number')}>Roll Number *</Label>
          <Input
            id={withId('roll-number')}
            placeholder="Enter roll number"
            value={form.rollNumber}
            onChange={(e) => updateForm({ rollNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={withId('first-name')}>First Name *</Label>
          <Input
            id={withId('first-name')}
            name="student-first-name"
            autoComplete="section-student given-name"
            placeholder="Enter first name"
            value={form.firstName}
            onChange={(e) => updateForm({ firstName: sanitizeNameInput(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={withId('last-name')}>Last Name</Label>
          <Input
            id={withId('last-name')}
            name="student-last-name"
            autoComplete="section-student family-name"
            placeholder="Enter last name"
            value={form.lastName}
            onChange={(e) => updateForm({ lastName: sanitizeNameInput(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={withId('date-of-birth')}>Date of Birth *</Label>
          <div className="w-full">
            <DatePicker
              id={withId('date-of-birth')}
              selected={form.dateOfBirth}
              onChange={(d) => updateForm({ dateOfBirth: d })}
              dateFormat="yyyy-MM-dd"
              preventOpenOnFocus
              shouldCloseOnSelect
              customInput={<DatePickerInput placeholder="Select date" className="w-full" />}
              wrapperClassName="w-full"
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              maxDate={new Date()}
            />
          </div>
        </div>
        <FormSelect
          id={withId('residence-type')}
          label="Day Scholar / Hosteller"
          required
          value={form.residenceType}
          onValueChange={(v) => updateForm({ residenceType: v })}
          placeholder="Select"
          options={STUDENT_RESIDENCE_TYPE_OPTIONS}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={withId('specialisation')}>Specialisation</Label>
        <Input
          id={withId('specialisation')}
          placeholder="Enter specialisation"
          value={form.specialisation}
          onChange={(e) => updateForm({ specialisation: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          id={withId('class')}
          label="Class"
          required
          value={form.classId}
          onValueChange={(v) => updateForm({ classId: v, sectionId: '' })}
          placeholder="Select Class"
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FormSelect
          id={withId('section')}
          label="Section"
          required={sectionRequired}
          value={form.sectionId}
          onValueChange={(v) => updateForm({ sectionId: v })}
          placeholder={
            !form.classId
              ? 'Select class first'
              : sectionRequired
                ? 'Select section'
                : 'No sections (optional)'
          }
          options={classSections.map((s) => ({ value: s.id, label: s.section }))}
          contentClassName="w-full"
        />
      </div>

      <div className="border-t pt-4 space-y-4">
        <h4 className="font-medium text-gray-900">Address</h4>
        <div className="space-y-2">
          <Label htmlFor={withId('address-location')}>Location</Label>
          <Input
            id={withId('address-location')}
            name="student-address-line1"
            autoComplete="section-student address-line1"
            placeholder="Enter location"
            value={form.addressLocation}
            onChange={(e) => updateForm({ addressLocation: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={withId('address-city')}>City</Label>
            <Input
              id={withId('address-city')}
              name="student-city"
              autoComplete="section-student address-level2"
              placeholder="Enter city"
              value={form.addressCity}
              onChange={(e) => updateForm({ addressCity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={withId('address-district')}>District</Label>
            <Input
              id={withId('address-district')}
              placeholder="Enter district"
              value={form.addressDistrict}
              onChange={(e) => updateForm({ addressDistrict: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={withId('address-state')}>State</Label>
            <Input
              id={withId('address-state')}
              name="student-state"
              autoComplete="section-student address-level1"
              placeholder="Enter state"
              value={form.addressState}
              onChange={(e) => updateForm({ addressState: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={withId('address-pin')}>Pin</Label>
            <Input
              id={withId('address-pin')}
              name="student-postal-code"
              autoComplete="section-student postal-code"
              placeholder="Enter PIN code"
              inputMode="numeric"
              value={form.addressPin}
              onChange={(e) => updateForm({ addressPin: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h4 className="font-medium text-gray-900">Parent / Contact Details</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={withId('father-name')}>Father Name *</Label>
            <Input
              id={withId('father-name')}
              placeholder="Enter father name"
              value={form.fatherName}
              onChange={(e) => updateForm({ fatherName: sanitizeNameInput(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={withId('mother-name')}>Mother Name</Label>
            <Input
              id={withId('mother-name')}
              placeholder="Enter mother name"
              value={form.motherName}
              onChange={(e) => updateForm({ motherName: sanitizeNameInput(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={withId('guardian-email')}>Guardian Email</Label>
            <Input
              id={withId('guardian-email')}
              name="guardian-email"
              autoComplete="section-guardian email"
              type="email"
              placeholder="Enter email address"
              value={form.guardianEmail}
              onChange={(e) => updateForm({ guardianEmail: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={withId('guardian-phone')}>Guardian Phone Number *</Label>
            <Input
              id={withId('guardian-phone')}
              name="guardian-phone"
              type="tel"
              autoComplete="section-guardian tel"
              placeholder="Enter phone number"
              inputMode="tel"
              value={form.guardianPhone}
              onFocus={() => {
                if (!form.guardianPhone) updateForm({ guardianPhone: '+91' });
              }}
              onChange={(e) =>
                updateForm({ guardianPhone: normalizeIndiaPhone(e.target.value, { allowEmpty: false }) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={withId('emergency-contact')}>Emergency Contact Number</Label>
            <Input
              id={withId('emergency-contact')}
              name="emergency-phone"
              type="tel"
              autoComplete="section-emergency tel"
              placeholder="Enter emergency contact"
              inputMode="tel"
              value={form.emergencyContactNumber}
              onFocus={() => {
                if (!form.emergencyContactNumber) updateForm({ emergencyContactNumber: '+91' });
              }}
              onChange={(e) =>
                updateForm({ emergencyContactNumber: normalizeIndiaPhone(e.target.value, { allowEmpty: true }) })
              }
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-4">
        <h4 className="font-medium text-gray-900">Other Details</h4>
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <FormSelect
            id={withId('blood-group')}
            label="Blood Group"
            value={form.bloodGroup}
            onValueChange={(v) => updateForm({ bloodGroup: v })}
            placeholder="Select blood group"
            options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
          />
          <div className="space-y-2">
            <Label htmlFor={withId('passport-photo')}>Passport photo</Label>
            <input
              ref={photoInputRef}
              id={withId('passport-photo')}
              type="file"
              accept={STUDENT_PHOTO_ACCEPT}
              className="sr-only"
              disabled={photoProcessing}
              onChange={async (e) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                const err = validateStudentPhotoFile(file, { rawPick: true });
                if (err) {
                  e.target.value = '';
                  toast.error(err);
                  return;
                }
                setPhotoProcessing(true);
                try {
                  const result = await processPassportPhoto(file);
                  if (form.photoPreviewUrl) URL.revokeObjectURL(form.photoPreviewUrl);
                  updateForm({
                    photoFile: result.file,
                    photoPreviewUrl: result.previewUrl,
                    removeExistingPhoto: false,
                  });
                  if (result.wasResized) {
                    toast.success(
                      `Photo resized to ${PASSPORT_PHOTO.widthPx}×${PASSPORT_PHOTO.heightPx}px (under 1 MB)`
                    );
                  }
                } catch (processErr) {
                  toast.error(String(processErr?.message || processErr || 'Invalid photo'));
                } finally {
                  setPhotoProcessing(false);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={photoProcessing}
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {photoProcessing ? 'Processing…' : hasPreview ? 'Change photo' : 'Upload photo'}
              </Button>
              {hasPreview ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearPhoto} disabled={photoProcessing}>
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              Optional. JPEG, PNG or WebP up to 5 MB — auto-cropped to passport size and compressed under 1 MB.
            </p>
            {hasPreview ? (
              <img
                src={form.photoPreviewUrl || existingPhotoUrl}
                alt="Passport preview"
                className="mt-1 h-24 w-20 rounded border border-gray-200 object-cover bg-gray-50"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
