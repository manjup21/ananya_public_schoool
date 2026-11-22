import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = 'Warning!',
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  maxWidthClassName = 'max-w-md',
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange?.(v); }}>
      <DialogContent className={maxWidthClassName}>
        <div className="flex flex-col gap-6 py-2 sm:flex-row sm:items-start sm:gap-5">
          <div className="h-14 w-14 shrink-0 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-gray-600" aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-gray-600">
              {description}
            </DialogDescription>
            <div className="mt-5 flex gap-3 sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)} disabled={busy}>
                {cancelText}
              </Button>
              <Button type="button" variant="destructive" onClick={handleConfirm} disabled={busy}>
                {busy ? <><Spinner className="h-4 w-4" /> Deleting…</> : confirmText}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

