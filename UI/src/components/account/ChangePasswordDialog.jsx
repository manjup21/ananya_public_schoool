import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useSignOut from 'react-auth-kit/hooks/useSignOut';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { changePasswordThunk, resetChangePasswordStatus } from '../../features/lecturerAccount/lecturerAccountSlice';
import { logoutThunk, clearAuth } from '../../features/auth/authSlice';
import { PinPad } from '../common/PinPad';

const PIN_RE = /^\d{6}$/;
const BANNED = new Set(['000000', '123456']);

function pinError(pin, { currentPin } = {}) {
  if (!PIN_RE.test(pin)) return 'PIN must be 6 digits';
  if (BANNED.has(pin) || /^(\d)\1{5}$/.test(pin)) return 'Choose a different PIN';
  if (currentPin && pin === currentPin) return 'New PIN must be different from your current PIN';
  return null;
}

export function ChangePasswordDialog({ open, onOpenChange }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const changePasswordStatus = useSelector((s) => s.lecturerAccount.changePasswordStatus);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const close = () => {
    onOpenChange?.(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    dispatch(resetChangePasswordStatus());
  };

  useEffect(() => {
    if (!open) {
      setFieldErrors({});
      dispatch(resetChangePasswordStatus());
    }
  }, [dispatch, open]);

  const validate = () => {
    const next = {};
    if (!PIN_RE.test(currentPassword)) next.currentPassword = 'Current PIN must be 6 digits';
    const newErr = pinError(newPassword, { currentPin: currentPassword });
    if (newErr) next.newPassword = newErr;
    if (!confirmPassword) next.confirmPassword = 'Please confirm your new PIN';
    else if (newPassword !== confirmPassword) next.confirmPassword = 'PINs do not match';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const canSubmit = useMemo(
    () =>
      PIN_RE.test(currentPassword) &&
      !pinError(newPassword, { currentPin: currentPassword }) &&
      newPassword === confirmPassword,
    [confirmPassword, currentPassword, newPassword]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await dispatch(changePasswordThunk({ currentPassword, newPassword })).unwrap();
      toast.success('PIN updated successfully');
      close();
      try {
        await dispatch(logoutThunk()).unwrap();
      } catch {
        // ignore
      } finally {
        dispatch(clearAuth());
        signOut();
        navigate('/login', { replace: true });
      }
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Could not change PIN');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange?.(true) : close())}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>Enter your current 6-digit PIN, then choose a new one.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} method="post" className="space-y-5">
          <div>
            <PinPad
              id="current-pin"
              label="Current PIN"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            {fieldErrors.currentPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.currentPassword}</p>
            ) : null}
          </div>

          <div>
            <PinPad
              id="new-pin"
              label="New PIN"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            {fieldErrors.newPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">Avoid easy PINs such as repeated digits (111111).</p>
            )}
          </div>

          <div>
            <PinPad
              id="confirm-pin"
              label="Re-enter new PIN"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || changePasswordStatus === 'loading'}>
              {changePasswordStatus === 'loading' ? 'Updating…' : 'Update PIN'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
