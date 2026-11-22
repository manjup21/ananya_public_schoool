import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FormSelect } from '../../components/common/FormSelect';
import { TagsInput } from '../../components/common/TagsInput';
import DatePicker from 'react-datepicker';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { TITLES } from '../../constants/titles';
import { sanitizeLecturerNameInput, normalizeIndiaPhone } from './lecturerFormHelpers';

/**
 * Shared field set for the Add / Edit Staff dialogs.
 * Accepts individual setters so the parent component retains ownership of
 * state, exactly as the original file did. `idPrefix` guarantees unique
 * element ids when both Add and Edit dialogs are mounted at once.
 */
export function LecturerFormFields({
  idPrefix = '',
  title,
  setTitle,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  employeeId,
  setEmployeeId,
  email,
  setEmail,
  phone,
  setPhone,
  dateOfBirth,
  setDateOfBirth,
  subjects,
  setSubjects,
  clearFieldError,
}) {
  const withId = (name) => (idPrefix ? `${idPrefix}-${name}` : name);
  const clear = (field) => {
    if (typeof clearFieldError === 'function') clearFieldError(field);
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormSelect
          id={withId('lecturer-title')}
          label="Title"
          required
          value={title}
          onValueChange={(v) => {
            setTitle(v);
            clear('title');
          }}
          options={TITLES}
          placeholder="Select title"
        />
        <div className="space-y-2">
          <Label htmlFor={withId('first-name')}>First Name *</Label>
          <Input
            id={withId('first-name')}
            name="staff-first-name"
            autoComplete="section-staff given-name"
            placeholder="Enter first name"
            value={firstName}
            onChange={(e) => {
              setFirstName(sanitizeLecturerNameInput(e.target.value));
              clear('firstName');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={withId('last-name')}>Last Name *</Label>
          <Input
            id={withId('last-name')}
            name="staff-last-name"
            autoComplete="section-staff family-name"
            placeholder="Enter last name"
            value={lastName}
            onChange={(e) => {
              setLastName(sanitizeLecturerNameInput(e.target.value));
              clear('lastName');
            }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={withId('employee-id')}>Employee ID *</Label>
          <Input
            id={withId('employee-id')}
            placeholder="Enter employee ID"
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              clear('employeeId');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={withId('email')}>Email *</Label>
          <Input
            id={withId('email')}
            name="staff-email"
            autoComplete="section-staff email"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => {
              setEmail(String(e.target.value ?? '').toLowerCase());
              clear('email');
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={withId('phone')}>Phone Number *</Label>
          <Input
            id={withId('phone')}
            name="staff-phone"
            type="tel"
            autoComplete="section-staff tel"
            placeholder="Enter phone number"
            value={phone}
            onFocus={() => {
              if (!phone) setPhone('+91');
            }}
            onChange={(e) => {
              setPhone(normalizeIndiaPhone(e.target.value));
              clear('phone');
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Date of Birth *</Label>
        <div className="w-full">
          <DatePicker
            selected={dateOfBirth}
            onChange={(d) => {
              setDateOfBirth(d);
              clear('dateOfBirth');
            }}
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
      <div className="space-y-2">
        <TagsInput
          id={withId('subjects')}
          label="Subjects"
          required
          value={subjects}
          onChange={(next) => {
            setSubjects(next);
            clear('subjects');
          }}
          placeholder="Enter subject"
          helperText="Press comma (,), space, or Enter to add"
        />
      </div>
    </div>
  );
}
