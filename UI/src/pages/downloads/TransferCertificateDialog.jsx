import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { FormSelect } from '../../components/common/FormSelect';
import { FormDatePicker } from '../../components/common/FormDatePicker';
import { Spinner } from '../../components/ui/spinner';
import { STUDENT_GENDER_OPTIONS } from '../../utils/studentDisplay';
import { certificateAc } from '../../utils/certificateFormAutofill';
import { PASSPORT_PHOTO, processPassportPhoto } from '../../utils/passportPhoto';
import { fetchStudentPhotoDataUrl } from '../../utils/studentPhotoDataUrl';
import {
  createEmptyTcExtras,
  createEmptyTcManualStudent,
  prefillTcExtrasFromStudent,
} from './transferCertificateData';
import { blankStr as blank } from '../../utils/pdfHelpers';

function Field({ id, label, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function TransferCertificateDialogInner({
  student,
  className = '',
  downloading = false,
  onDownload,
  onOpenChange,
  manualMode = false,
}) {
  const [form, setForm] = useState(() =>
    manualMode ? createEmptyTcExtras() : prefillTcExtrasFromStudent(student, className)
  );
  const [manualStudent, setManualStudent] = useState(createEmptyTcManualStudent);
  const [error, setError] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoNote, setPhotoNote] = useState('');
  const [loadingStoredPhoto, setLoadingStoredPhoto] = useState(false);
  const inputRef = useRef(null);
  const photoOverrideRef = useRef(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const updateManual = (patch) => setManualStudent((prev) => ({ ...prev, ...patch }));

  const studentId = student?.id || '';
  const hasStoredPhoto = Boolean(student?.photo_path);

  useEffect(() => {
    if (manualMode || !studentId || !hasStoredPhoto || photoOverrideRef.current) return;
    let cancelled = false;
    async function loadStored() {
      setLoadingStoredPhoto(true);
      try {
        const dataUrl = await fetchStudentPhotoDataUrl(studentId);
        if (!cancelled && !photoOverrideRef.current) {
          setForm((prev) => ({ ...prev, photoDataUrl: dataUrl }));
          setPhotoNote('Using photo saved on the student record. You can replace it for this TC only.');
        }
      } catch {
        /* no file on disk */
      } finally {
        if (!cancelled) setLoadingStoredPhoto(false);
      }
    }
    loadStored();
    return () => {
      cancelled = true;
    };
  }, [manualMode, studentId, hasStoredPhoto]);

  const fullName = student
    ? `${blank(student.first_name)} ${blank(student.last_name)}`.trim()
    : '';

  const handlePhoto = async (file) => {
    if (!file) return;
    setPhotoProcessing(true);
    setPhotoNote('');
    try {
      const result = await processPassportPhoto(file);
      photoOverrideRef.current = true;
      update({ photoDataUrl: result.dataUrl });
      setPhotoNote(
        result.wasResized
          ? `Photo adjusted to ${PASSPORT_PHOTO.widthPx}×${PASSPORT_PHOTO.heightPx}px (this download only).`
          : `Photo ready (${PASSPORT_PHOTO.widthPx}×${PASSPORT_PHOTO.heightPx}px). Not saved to student record.`
      );
    } catch (err) {
      update({ photoDataUrl: null });
      toast.error(String(err?.message || err || 'Invalid photo'));
    } finally {
      setPhotoProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clearPhoto = () => {
    photoOverrideRef.current = true;
    update({ photoDataUrl: null });
    setPhotoNote('');
  };

  const handleDownload = () => {
    if (manualMode) {
      const studentRequired = [
        ['first_name', 'Student name'],
        ['gender', 'Gender'],
        ['date_of_birth', 'Date of birth'],
        ['father_name', 'Father name'],
      ];
      for (const [key, label] of studentRequired) {
        if (!blank(manualStudent[key])) {
          setError(`${label} is required`);
          return;
        }
      }
    }

    const required = [
      ['tcNo', 'Transfer Certificate No'],
      ['admissionNo', 'Admission No.'],
      ['nationality', 'Nationality'],
      ['classLeaving', 'Class at leaving'],
      ['dateOfIssue', 'Date of Issue'],
    ];
    for (const [key, label] of required) {
      if (!blank(form[key])) {
        setError(`${label} is required`);
        return;
      }
    }
    setError('');

    if (manualMode) {
      onDownload?.({
        manualStudent: {
          first_name: blank(manualStudent.first_name),
          last_name: blank(manualStudent.last_name),
          gender: blank(manualStudent.gender),
          date_of_birth: blank(manualStudent.date_of_birth),
          father_name: blank(manualStudent.father_name),
          mother_name: blank(manualStudent.mother_name),
          roll_number: blank(manualStudent.roll_number) || blank(form.admissionNo),
        },
        extras: form,
      });
      return;
    }

    onDownload?.({ extras: form });
  };

  const canSubmit = manualMode || Boolean(student);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {manualMode ? 'Transfer Certificate — new data' : 'Transfer Certificate'}
        </DialogTitle>
        <DialogDescription>
          {manualMode
            ? 'Enter TC details manually, then download. Nothing is saved to the student record.'
            : 'Confirm or fill missing TC fields, then download. Stored student photo is used when available; an upload here is for this PDF only.'}
        </DialogDescription>
      </DialogHeader>

      <form autoComplete="on" onSubmit={(e) => e.preventDefault()} className="space-y-5">
        {manualMode ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="tc-manual-first" label="First name *">
              <Input
                id="tc-manual-first"
                name="given-name"
                autoComplete={certificateAc('given-name')}
                value={manualStudent.first_name}
                onChange={(e) => updateManual({ first_name: e.target.value })}
              />
            </Field>
            <Field id="tc-manual-last" label="Last name">
              <Input
                id="tc-manual-last"
                name="family-name"
                autoComplete={certificateAc('family-name')}
                value={manualStudent.last_name}
                onChange={(e) => updateManual({ last_name: e.target.value })}
              />
            </Field>
            <FormSelect
              id="tc-manual-gender"
              label="Gender"
              required
              value={manualStudent.gender}
              onValueChange={(v) => updateManual({ gender: v })}
              placeholder="Select gender"
              options={STUDENT_GENDER_OPTIONS}
            />
            <FormDatePicker
              id="tc-manual-dob"
              label="Date of birth"
              required
              value={manualStudent.date_of_birth}
              onChange={(iso) => updateManual({ date_of_birth: iso })}
              name="bday"
              autoComplete={certificateAc('bday')}
              maxDate={new Date()}
            />
            <Field id="tc-manual-father" label="Father name *">
              <Input
                id="tc-manual-father"
                value={manualStudent.father_name}
                onChange={(e) => updateManual({ father_name: e.target.value })}
              />
            </Field>
            <Field id="tc-manual-mother" label="Mother name">
              <Input
                id="tc-manual-mother"
                value={manualStudent.mother_name}
                onChange={(e) => updateManual({ mother_name: e.target.value })}
              />
            </Field>
          </div>
        ) : student ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm space-y-1">
            <div>
              <span className="text-gray-500">Student: </span>
              <span className="font-medium text-gray-900">{fullName || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Father: </span>
              <span className="font-medium text-gray-900">{blank(student.father_name) || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">Mother: </span>
              <span className="font-medium text-gray-900">{blank(student.mother_name) || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500">DOB: </span>
              <span className="font-medium text-gray-900">
                {student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600 py-2">Loading student…</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="tc-no" label="Transfer Certificate No *">
            <Input id="tc-no" value={form.tcNo} onChange={(e) => update({ tcNo: e.target.value })} />
          </Field>
          <Field id="tc-admission" label="Admission No. *">
            <Input
              id="tc-admission"
              value={form.admissionNo}
              onChange={(e) => update({ admissionNo: e.target.value })}
            />
          </Field>
          <Field id="tc-year" label="Academic year (header)">
            <Input
              id="tc-year"
              placeholder="e.g. 2025-26"
              value={form.academicYear}
              onChange={(e) => update({ academicYear: e.target.value })}
            />
          </Field>
          <Field id="tc-class" label="Class at leaving *">
            <Input
              id="tc-class"
              placeholder="e.g. 10th Standard"
              value={form.classLeaving}
              onChange={(e) => update({ classLeaving: e.target.value })}
            />
          </Field>
          <Field id="tc-nationality" label="Nationality *">
            <Input
              id="tc-nationality"
              value={form.nationality}
              onChange={(e) => update({ nationality: e.target.value })}
            />
          </Field>
          <Field id="tc-religion" label="Religion">
            <Input
              id="tc-religion"
              value={form.religion}
              onChange={(e) => update({ religion: e.target.value })}
            />
          </Field>
          <Field id="tc-caste" label="Caste" className="sm:col-span-2">
            <Input id="tc-caste" value={form.caste} onChange={(e) => update({ caste: e.target.value })} />
          </Field>
          <Field id="tc-exam" label="Examination attended" className="sm:col-span-2">
            <Input
              id="tc-exam"
              placeholder="e.g. CBSE CLASS X BOARD EXAM"
              value={form.examinationAttended}
              onChange={(e) => update({ examinationAttended: e.target.value })}
            />
          </Field>
          <Field id="tc-reg" label="Register No.">
            <Input
              id="tc-reg"
              value={form.registerNo}
              onChange={(e) => update({ registerNo: e.target.value })}
            />
          </Field>
          <Field id="tc-result" label="Result">
            <Input
              id="tc-result"
              placeholder="e.g. PASS"
              value={form.examResult}
              onChange={(e) => update({ examResult: e.target.value })}
            />
          </Field>
          <Field id="tc-month" label="Exam month">
            <Input
              id="tc-month"
              placeholder="e.g. MARCH"
              value={form.examMonth}
              onChange={(e) => update({ examMonth: e.target.value })}
            />
          </Field>
          <Field id="tc-exam-year" label="Exam year">
            <Input
              id="tc-exam-year"
              placeholder="e.g. 2026"
              value={form.examYear}
              onChange={(e) => update({ examYear: e.target.value })}
            />
          </Field>
          <Field id="tc-qualified" label="Qualified for next higher class">
            <Input
              id="tc-qualified"
              value={form.qualifiedNextClass}
              onChange={(e) => update({ qualifiedNextClass: e.target.value })}
            />
          </Field>
          <Field id="tc-conduct" label="Conduct">
            <Input
              id="tc-conduct"
              value={form.conduct}
              onChange={(e) => update({ conduct: e.target.value })}
            />
          </Field>
          <FormDatePicker
            id="tc-app-date"
            label="Date of Application"
            value={form.dateOfApplication}
            onChange={(iso) => update({ dateOfApplication: iso })}
            name="tc-app-date"
          />
          <FormDatePicker
            id="tc-issue-date"
            label="Date of Issue"
            required
            value={form.dateOfIssue}
            onChange={(iso) => update({ dateOfIssue: iso })}
            name="tc-issue-date"
          />
        </div>

        <div className="space-y-3 rounded-md border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <ImagePlus className="h-4 w-4" />
            Student photo (optional)
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="h-36 w-28 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
              {form.photoDataUrl ? (
                <img src={form.photoDataUrl} alt="Passport preview" className="h-full w-full object-cover" />
              ) : loadingStoredPhoto ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <span className="text-xs text-gray-400">No photo</span>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <input
                ref={inputRef}
                type="file"
                accept={PASSPORT_PHOTO.accept}
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={photoProcessing || loadingStoredPhoto}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {form.photoDataUrl ? 'Change photo' : 'Upload photo'}
                </Button>
                {form.photoDataUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                {hasStoredPhoto && !manualMode
                  ? 'Saved student photo is shown when available. Replace only if needed for this TC (not written back to the student).'
                  : 'JPEG / PNG / WebP, max 2 MB. Cropped to passport size for the TC.'}
              </p>
              {photoProcessing ? <p className="text-xs text-gray-600">Processing…</p> : null}
              {photoNote ? <p className="text-xs text-gray-600">{photoNote}</p> : null}
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleDownload}
          disabled={downloading || photoProcessing || !canSubmit}
        >
          {downloading ? (
            <>
              <Spinner className="h-4 w-4" /> Downloading…
            </>
          ) : (
            'Download TC'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

/** DialogContent must be a direct child of Dialog (custom Dialog clones `open` onto it). */
export function TransferCertificateDialog({
  open,
  onOpenChange,
  student,
  className = '',
  downloading = false,
  onDownload,
  manualMode = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {open ? (
          <TransferCertificateDialogInner
            key={manualMode ? 'manual' : student?.id || 'loading'}
            student={student}
            className={className}
            downloading={downloading}
            onDownload={onDownload}
            onOpenChange={onOpenChange}
            manualMode={manualMode}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
