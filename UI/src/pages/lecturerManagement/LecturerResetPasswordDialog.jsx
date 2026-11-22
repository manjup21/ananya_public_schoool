import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react';

export function LecturerResetPasswordDialog({
  open,
  onOpenChange,
  lecturer,
  resetPasswordValue,
  showResetPassword,
  onToggleShow,
  onReset,
  onCopy,
  resetting = false,
}) {
  const displayName =
    [lecturer?.title, lecturer?.first_name, lecturer?.last_name].filter(Boolean).join(' ') || 'this staff member';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset staff PIN</DialogTitle>
          <DialogDescription>
            This will reset the login PIN to <strong>000000</strong> for{' '}
            <span className="font-medium text-gray-900">{displayName}</span>. They must change it after signing in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" className="w-full gap-2" onClick={onReset} disabled={resetting}>
            {resetting ? (
              <>
                <Spinner className="h-4 w-4" /> Resetting…
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Reset to 000000
              </>
            )}
          </Button>

          {resetPasswordValue ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Default PIN</p>
                  <p className="mt-1 font-mono text-sm text-gray-900 tracking-widest">
                    {showResetPassword ? resetPasswordValue : '••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={onToggleShow}
                    aria-label={showResetPassword ? 'Hide PIN' : 'Show PIN'}
                    title={showResetPassword ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onCopy}>
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Share this with the staff member. They will be asked to set a new PIN on login.
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
