import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { DatePickerInput } from './DatePickerInput';
import { formatDateOnlyLocal, parseApiDateOnly } from '../../utils/dateOnly';

/**
 * ISO date string (yyyy-MM-dd) in/out — same react-datepicker pattern as Student form.
 */
export function FormDatePicker({
  id,
  label,
  required = false,
  value,
  onChange,
  autoComplete = 'off',
  name,
  placeholder = 'dd-mm-yyyy',
  maxDate,
  minDate,
  className,
  'aria-label': ariaLabel,
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? ' *' : null}
        </Label>
      ) : null}
      <DatePicker
        id={id}
        selected={parseApiDateOnly(value)}
        onChange={(d) => onChange?.(formatDateOnlyLocal(d))}
        dateFormat="dd-MM-yyyy"
        preventOpenOnFocus
        shouldCloseOnSelect
        maxDate={maxDate}
        minDate={minDate}
        customInput={
          <DatePickerInput
            id={id}
            name={name}
            autoComplete={autoComplete}
            aria-label={ariaLabel || label}
            placeholder={placeholder}
            className="w-full"
          />
        }
        wrapperClassName="w-full"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
      />
    </div>
  );
}
