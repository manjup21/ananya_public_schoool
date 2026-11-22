import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { AppLogo } from '../components/common/AppLogo';
import { LoginWaveFooter } from '../components/common/LoginWaveFooter';
import { clearAuth, logoutThunk, setPasswordThunk } from '../features/auth/authSlice';
import { authHomePath } from '../utils/authHome';
import { PinPad } from '../components/common/PinPad';

/** Forced after signing in with the default PIN (000000). */
export function SetPasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const authKitUser = useAuthUser();
  const reduxUser = useSelector((s) => s.auth.user);
  const user = reduxUser ?? authKitUser;
  const [step, setStep] = useState('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user?.password_setup) return <Navigate to={user ? authHomePath(user) : '/login'} replace />;

  const save = async (nextConfirm) => {
    if (pin !== nextConfirm) {
      toast.error('PIN entries do not match');
      setConfirmPin('');
      setStep('enter');
      setPin('');
      return;
    }
    setSaving(true);
    try {
      const payload = await dispatch(
        setPasswordThunk({ newPassword: pin, confirmPassword: nextConfirm })
      ).unwrap();
      signIn({ auth: { token: payload.token, type: 'Bearer' }, userState: payload.user });
      toast.success('PIN updated');
      navigate(authHomePath(payload.user), { replace: true });
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Could not set the PIN');
      setConfirmPin('');
      setStep('confirm');
    } finally {
      setSaving(false);
    }
  };

  const onChange = (next) => {
    if (step === 'enter') {
      setPin(next);
      if (next.length === 6) setStep('confirm');
      return;
    }
    setConfirmPin(next);
    if (next.length === 6) save(next);
  };

  const handleSignOut = async () => {
    try {
      await dispatch(logoutThunk()).unwrap();
    } catch {
      /* ignore */
    }
    dispatch(clearAuth());
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-linear-to-b from-blue-50 via-white to-blue-50 flex flex-col">
      <LoginWaveFooter />
      <div className="relative z-10 flex flex-1 flex-col px-4 pt-8 pb-28 lg:pb-8">
        <div className="m-auto w-full max-w-md">
          <div className="text-center mb-8">
            <AppLogo variant="login" className="mb-4" />
            <p className="text-gray-600 mt-2">Welcome{user?.name ? `, ${user.name}` : ''}!</p>
          </div>
          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Set a new PIN</CardTitle>
              <CardDescription className="text-center">
                {step === 'enter' ? 'Choose a 6-digit PIN before continuing.' : 'Enter the same PIN again'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PinPad
                id="staff-set-pin"
                label={step === 'enter' ? 'New PIN' : 'Confirm PIN'}
                value={step === 'enter' ? pin : confirmPin}
                onChange={onChange}
                autoComplete="new-password"
              />
              {step === 'confirm' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                  onClick={() => {
                    setStep('enter');
                    setPin('');
                    setConfirmPin('');
                  }}
                >
                  Start over
                </Button>
              ) : null}
              {saving ? (
                <div className="flex justify-center">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : null}
              <p className="mt-2 text-center text-sm">
                <button type="button" className="text-blue-600 hover:text-blue-700 font-medium" onClick={handleSignOut}>
                  Sign out
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
