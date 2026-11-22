import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { ChevronDown, X } from 'lucide-react';

function normalizeOptions(options) {
  return (Array.isArray(options) ? options : []).map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
}

export function MultiSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select',
  required = false,
  disabled = false,
}) {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState(null);

  const opts = useMemo(() => normalizeOptions(options), [options]);
  const selected = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedBadges = useMemo(
    () => opts.filter((o) => selectedSet.has(o.value)),
    [opts, selectedSet]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return opts;
    return opts.filter((o) => String(o.label ?? '').toLowerCase().includes(s));
  }, [opts, q]);

  useEffect(() => {
    const fn = (e) => {
      const insideTrigger = ref.current && ref.current.contains(e.target);
      const insideContent = contentRef.current && contentRef.current.contains(e.target);
      if (!insideTrigger && !insideContent) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const toggle = (val) => {
    if (selectedSet.has(val)) {
      onChange?.(selected.filter((v) => v !== val));
    } else {
      onChange?.([...selected, val]);
    }
  };

  const clearOne = (val) => onChange?.(selected.filter((v) => v !== val));

  return (
    <div className="space-y-2" ref={ref}>
      {label ? (
        <Label htmlFor={id}>
          {label} {required ? '*' : null}
        </Label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
          disabled && 'bg-gray-50'
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn('min-w-0 truncate', !selectedBadges.length && 'text-gray-500')}>
          {selectedBadges.length ? `${selectedBadges.length} selected` : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {selectedBadges.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedBadges.map((o) => (
            <Badge key={o.value} variant="secondary" className="gap-1">
              {o.label}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => clearOne(o.value)}
                aria-label={`Remove ${o.label}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}

      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={contentRef}
              className="fixed z-60 rounded-md border border-gray-200 bg-white shadow-lg"
              style={{ left: coords.left, top: coords.top, width: coords.width }}
            >
              <div className="p-2 border-b border-gray-100">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search..."
                />
              </div>
              <div className="max-h-[min(15rem,calc(100dvh-10rem))] overflow-auto overscroll-contain py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No results</div>
                ) : (
                  filtered.map((o) => {
                    const isOn = selectedSet.has(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50',
                          isOn && 'bg-gray-50'
                        )}
                        onClick={() => toggle(o.value)}
                      >
                        <span className="text-gray-900 min-w-0 truncate text-left">{o.label}</span>
                        <span className={cn('text-xs shrink-0', isOn ? 'text-blue-600' : 'text-gray-400')}>
                          {isOn ? 'Selected' : ''}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
