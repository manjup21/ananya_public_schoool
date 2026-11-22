import { Delete } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({ id, label, value, onChange, length = 6, autoComplete = 'off' }) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, length);

  const setDigits = (next) => onChange(String(next).replace(/\D/g, '').slice(0, length));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-gray-500" aria-live="polite">
          {digits.length} of {length} digits
        </span>
      </div>
      <label htmlFor={id} className="relative block cursor-text">
        <input
          id={id}
          inputMode="numeric"
          autoComplete={autoComplete}
          pattern="[0-9]*"
          maxLength={length}
          value={digits}
          onChange={(e) => setDigits(e.target.value)}
          className="absolute inset-0 h-full w-full opacity-0"
        />
        <span className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={`flex h-12 items-center justify-center rounded-md border bg-white text-xl font-semibold text-gray-900 shadow-sm transition-colors ${
                i === digits.length ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-300'
              }`}
            >
              {digits[i] ?? ''}
            </span>
          ))}
        </span>
      </label>
      <p className="text-xs text-gray-500">Enter a {length}-digit number using the keypad or your keyboard.</p>
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {KEYS.map((key) => {
          if (key === '') return <span key="gap" />;
          if (key === 'del') {
            return (
              <Button
                key="del"
                type="button"
                variant="outline"
                className="h-12 text-gray-700"
                onClick={() => setDigits(digits.slice(0, -1))}
                aria-label="Delete digit"
                tabIndex={-1}
              >
                <Delete className="h-5 w-5" />
              </Button>
            );
          }
          return (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-12 text-lg"
              onClick={() => setDigits(digits + key)}
              tabIndex={-1}
            >
              {key}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
