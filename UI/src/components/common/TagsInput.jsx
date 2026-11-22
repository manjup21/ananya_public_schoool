import { useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

function normalizeTag(t) {
  return t.trim().replace(/\s+/g, ' ');
}

export function TagsInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'Add a subject',
  helperText = 'Press comma (,), space, or Enter to add',
  required = false,
  error,
}) {
  const [draft, setDraft] = useState('');

  const tags = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const addTag = (raw) => {
    const next = normalizeTag(raw);
    if (!next) return;
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) return;
    onChange([...tags, next]);
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label} {required ? '*' : null}
        </label>
      ) : null}

      <div className="rounded-md border border-gray-200 p-2 bg-white">
        {tags.length ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => removeTag(t)}
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : null}

        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ',') {
              e.preventDefault();
              addTag(draft);
              setDraft('');
            }
            if (e.key === ' ') {
              e.preventDefault();
              addTag(draft);
              setDraft('');
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(draft);
              setDraft('');
            }
            if (e.key === 'Backspace' && draft === '' && tags.length) {
              removeTag(tags[tags.length - 1]);
            }
          }}
        />
      </div>

      {helperText ? <p className="text-xs text-gray-500">{helperText}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

