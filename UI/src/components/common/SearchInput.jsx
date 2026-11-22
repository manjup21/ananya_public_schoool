import { Search } from 'lucide-react';

import { Input } from '../ui/input';
import { cn } from '../ui/utils';

const SIZES = {
  md: { icon: 'left-3 h-5 w-5', input: 'pl-10' },
  sm: { icon: 'left-2.5 h-4 w-4', input: 'pl-8' },
};

/** Text input with a leading search icon; `onValueChange` receives the string value. */
export function SearchInput({
  value,
  onValueChange,
  size = 'md',
  className,
  iconClassName,
  inputClassName,
  ...inputProps
}) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400', s.icon, iconClassName)}
      />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(s.input, inputClassName)}
        {...inputProps}
      />
    </div>
  );
}
