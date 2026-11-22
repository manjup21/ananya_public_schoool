import { useState } from 'react';
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
import { blankStr as blank } from '../../utils/pdfHelpers';

function createStudyForm(initial) {
  return {
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    father_name: '',
    enrolment_number: '',
    fromClass: '',
    toClass: '',
    fromYear: '',
    toYear: '',
    caste: '',
    ...(initial ?? {}),
  };
}

function TextField({ id, label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StudyCertificateForm({ initialValues, downloading, onDownload, onOpenChange }) {
  const [form, setForm] = useState(() => createStudyForm(initialValues));
  const [error, setError] = useState('');
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const fromRecord = Boolean(initialValues);

  const handleDownload = () => {
    const required = [
      ['first_name', 'Student name'],
      ['gender', 'Gender'],
      ['date_of_birth', 'Date of birth'],
      ['father_name', 'Parent / guardian name'],
      ['enrolment_number', 'Admission No.'],
    ];
    for (const [key, label] of required) {
      if (!blank(form[key])) {
        setError(`${label} is required`);
        return;
      }
    }
    setError('');
    onDownload?.({
      student: {
        first_name: blank(form.first_name),
        last_name: blank(form.last_name),
        gender: blank(form.gender),
        date_of_birth: blank(form.date_of_birth),
        father_name: blank(form.father_name),
        enrolment_number: blank(form.enrolment_number),
        roll_number: blank(form.enrolment_number),
      },
      details: {
        fromClass: blank(form.fromClass),
        toClass: blank(form.toClass),
        fromYear: blank(form.fromYear),
        toYear: blank(form.toYear),
        caste: blank(form.caste),
      },
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{fromRecord ? 'Study Certificate' : 'Study Certificate - new data'}</DialogTitle>
        <DialogDescription>
          {fromRecord
            ? 'Details are filled from the student record. Add the study period and caste, or leave them blank to write by hand.'
            : 'Enter certificate details manually, then download. Nothing is saved to the student record.'}{' '}
          Blank fields print as empty lines.
        </DialogDescription>
      </DialogHeader>

      <form
        autoComplete="on"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 sm:grid-cols-2 py-1"
      >
        <div className="space-y-2">
          <Label htmlFor="study-first">First name *</Label>
          <Input
            id="study-first"
            name="given-name"
            autoComplete={certificateAc('given-name')}
            value={form.first_name}
            onChange={(e) => update({ first_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="study-last">Last name</Label>
          <Input
            id="study-last"
            name="family-name"
            autoComplete={certificateAc('family-name')}
            value={form.last_name}
            onChange={(e) => update({ last_name: e.target.value })}
          />
        </div>
        <FormSelect
          id="study-gender"
          label="Gender"
          required
          value={form.gender}
          onValueChange={(v) => update({ gender: v })}
          placeholder="Select gender"
          options={STUDENT_GENDER_OPTIONS}
        />
        <FormDatePicker
          id="study-dob"
          label="Date of birth"
          required
          value={form.date_of_birth}
          onChange={(iso) => update({ date_of_birth: iso })}
          name="bday"
          autoComplete={certificateAc('bday')}
          maxDate={new Date()}
        />
        <TextField
          id="study-parent"
          label="Father / guardian name *"
          className="sm:col-span-2"
          value={form.father_name}
          onChange={(v) => update({ father_name: v })}
        />
        <TextField
          id="study-admission"
          label="Admission No. *"
          value={form.enrolment_number}
          onChange={(v) => update({ enrolment_number: v })}
        />
        <TextField
          id="study-caste"
          label="Caste"
          value={form.caste}
          onChange={(v) => update({ caste: v })}
        />
        <TextField
          id="study-from-class"
          label="Studied from (class)"
          placeholder="e.g. 1st Std"
          value={form.fromClass}
          onChange={(v) => update({ fromClass: v })}
        />
        <TextField
          id="study-to-class"
          label="Studied to (class)"
          placeholder="e.g. 10th Std"
          value={form.toClass}
          onChange={(v) => update({ toClass: v })}
        />
        <TextField
          id="study-from-year"
          label="Academic year from"
          placeholder="e.g. 2016-17"
          value={form.fromYear}
          onChange={(v) => update({ fromYear: v })}
        />
        <TextField
          id="study-to-year"
          label="Academic year to"
          placeholder="e.g. 2026-27"
          value={form.toYear}
          onChange={(v) => update({ toYear: v })}
        />
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
          Cancel
        </Button>
        <Button type="button" onClick={handleDownload} disabled={downloading}>
          {downloading ? (
            <>
              <Spinner className="h-4 w-4" /> Downloading...
            </>
          ) : (
            'Download certificate'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

/** DialogContent must be a direct child of Dialog (custom Dialog clones `open` onto it). */
export function StudyCertificateDialog({
  open,
  onOpenChange,
  downloading = false,
  onDownload,
  initialValues = null,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {open ? (
          <StudyCertificateForm
            key={initialValues?.key ?? 'study-new'}
            initialValues={initialValues}
            downloading={downloading}
            onDownload={onDownload}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
