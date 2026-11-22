import { forwardRef } from 'react';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

/**
 * readOnly input for react-datepicker `customInput` — reduces mobile keyboard on focus.
 */
export const DatePickerInput = forwardRef(function DatePickerInput(
  { className, onFocus, ...props },
  ref
) {
  return (
    <Input
      {...props}
      ref={ref}
      readOnly
      inputMode="none"
      autoComplete="off"
      className={cn('cursor-pointer', className)}
      onFocus={(e) => {
        e.target.blur();
        onFocus?.(e);
      }}
    />
  );
});
