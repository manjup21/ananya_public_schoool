import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Spinner } from '../../components/ui/spinner';

function OptionRow({ id, checked, onChange, title, description, disabled }) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-md border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
    >
      <Checkbox
        id={id}
        className="mt-0.5 h-5 w-5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-600">{description}</span>
      </span>
    </label>
  );
}

function ReportOptionsForm({ title, confirming, progressLabel, onConfirm, onOpenChange }) {
  const [includeFinalResult, setIncludeFinalResult] = useState(true);
  const [includePartB, setIncludePartB] = useState(true);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Choose which sections to include. The student photo is taken from the student record.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-1">
        <OptionRow
          id="report-include-final"
          checked={includeFinalResult}
          onChange={setIncludeFinalResult}
          disabled={confirming}
          title="Include Final Result"
          description="Total marks, grade and percentage per subject across all exams, plus the promotion message."
        />
        <OptionRow
          id="report-include-part-b"
          checked={includePartB}
          onChange={setIncludePartB}
          disabled={confirming}
          title="Include Part B - Co-Curricular Activities"
          description="Grades entered for Part B subjects (shown only when the exams have Part B grades)."
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" disabled={confirming} onClick={() => onOpenChange?.(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={confirming}
          onClick={() =>
            onConfirm?.({
              partB: { include: includePartB, fields: [] },
              totalMarks: { include: includeFinalResult },
            })
          }
        >
          {confirming ? (
            <>
              <Spinner className="h-4 w-4" /> {progressLabel || 'Generating...'}
            </>
          ) : (
            'Download'
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

/** DialogContent must be a direct child of Dialog (custom Dialog clones `open` onto it). */
export function ReportOptionsDialog({
  open,
  onOpenChange,
  title = 'Download progress report',
  confirming = false,
  progressLabel = '',
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ReportOptionsForm
            title={title}
            confirming={confirming}
            progressLabel={progressLabel}
            onConfirm={onConfirm}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
