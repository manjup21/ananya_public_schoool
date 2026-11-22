import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Mail, Lock, IdCard, Eye, EyeOff } from 'lucide-react';
import { AppLogo } from '../components/common/AppLogo';
import { LoginWaveFooter } from '../components/common/LoginWaveFooter';
import { authHomePath } from '../utils/authHome';
import { InstallAppPrompt } from '../components/common/InstallAppPrompt';
import { useDispatch, useSelector } from 'react-redux';
import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import { loginThunk, clearAuth, logoutThunk } from '../features/auth/authSlice';
import { toast } from 'sonner';
import { Spinner } from '../components/ui/spinner';
import { isAutofillEvent } from '../utils/autofill';

function cleanEmployeeId(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();
}

const isAdminLoginId = (value) => value.includes('@') || /^\d{10}$/.test(value);

export function LoginPage() {
  const dispatch = useDispatch();
  const signIn = useSignIn();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminEmailError, setAdminEmailError] = useState('');
  const [lecturerEmployeeId, setLecturerEmployeeId] = useState('');
  const [lecturerEmployeeIdError, setLecturerEmployeeIdError] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('lecturer');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autofillNote, setAutofillNote] = useState('');

  const switchTab = (tab) => {
    setActiveTab(tab);
    setAutofillNote('');
  };

  // Deferred so Chrome can finish filling the password into the still-mounted form first;
  // switching tabs unmounts it, and `password` state is shared by both tabs.
  const switchTabAfterAutofill = (tab, note) => {
    setTimeout(() => {
      setActiveTab(tab);
      setAutofillNote(note);
    }, 0);
  };

  // Chrome offers every saved login for this site on both tabs, so route a filled credential
  // to the tab it belongs to: emails and 10-digit phones are admin logins, anything else is a staff employee ID.
  const onEmployeeIdChange = (e) => {
    const raw = String(e.target.value ?? '');
    if (isAdminLoginId(raw.trim()) && isAutofillEvent(e)) {
      setAdminEmail(raw.trim().toLowerCase());
      setLecturerEmployeeId('');
      setLecturerEmployeeIdError('');
      switchTabAfterAutofill('admin', 'Switched to Admin because the saved login you picked is an admin email or phone.');
      return;
    }
    const noSpaces = raw.replace(/\s+/g, '');
    setLecturerEmployeeId(cleanEmployeeId(noSpaces));
    setLecturerEmployeeIdError(
      /[^a-zA-Z0-9_-]/.test(noSpaces) ? 'Only letters, numbers, "-" and "_" are allowed' : ''
    );
  };

  const onAdminEmailChange = (e) => {
    const raw = String(e.target.value ?? '');
    setAdminEmailError('');
    if (raw.trim() && !isAdminLoginId(raw.trim()) && isAutofillEvent(e)) {
      setLecturerEmployeeId(cleanEmployeeId(raw));
      setLecturerEmployeeIdError('');
      setAdminEmail('');
      switchTabAfterAutofill(
        'lecturer',
        'Switched to Staff/Account because the saved login you picked is an employee ID.'
      );
      return;
    }
    setAdminEmail(raw.trimStart().toLowerCase());
  };

  if (isAuthenticated && user) {
    return <Navigate to={authHomePath(user)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const adminId = adminEmail.trim();
    const isPhone = /^\d+$/.test(adminId);
    if (activeTab === 'admin' && isPhone && adminId.length !== 10) {
      setAdminEmailError('Phone number must be 10 digits');
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      toast.error('Enter your 6-digit PIN');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = await dispatch(
        loginThunk(
          activeTab === 'lecturer'
            ? { employeeId: lecturerEmployeeId, password }
            : isPhone
              ? { phone: adminId, password }
              : { email: adminId, password }
        )
      ).unwrap();
      const authState = payload.user;
      if (activeTab === 'admin') {
        if (authState?.role !== 'admin' || (!authState?.is_super_admin && !authState?.is_admin)) {
          try {
            await dispatch(logoutThunk()).unwrap();
          } catch {
            /* ignore */
          }
          dispatch(clearAuth());
          toast.error('This account cannot use Admin login. Use the Staff/Account tab if you are staff.');
          return;
        }
      } else if (authState?.role !== 'lecturer') {
        try {
          await dispatch(logoutThunk()).unwrap();
        } catch {
          /* ignore */
        }
        dispatch(clearAuth());
        toast.error('Staff login failed. Check your employee ID and PIN.');
        return;
      }

      const ok = signIn({
        auth: {
          token: payload.token,
          type: 'Bearer',
        },
        userState: authState,
      });
      if (!ok) throw new Error('Unable to persist session');

      navigate(authHomePath(authState), { replace: true });
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPinChange = (e) => {
    setPassword(String(e.target.value ?? '').replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-linear-to-b from-blue-50 via-white to-blue-50 flex flex-col">
      <LoginWaveFooter />
      <div className="relative z-10 flex flex-1 flex-col px-4 pt-8 pb-28 lg:pb-8">
        <div className="m-auto w-full max-w-md">
        <div className="text-center mb-8">
          <AppLogo variant="login" className="mb-4" />
          <p className="text-gray-600 mt-2">Welcome back! Please login to continue.</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Choose your role and enter your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={switchTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="lecturer">Staff/Account</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>

              {autofillNote ? (
                <p className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700" role="status">
                  {autofillNote}
                </p>
              ) : null}

              <TabsContent value="lecturer">
                <form onSubmit={handleSubmit} method="post" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lecturer-employee-id">Employee ID</Label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="lecturer-employee-id"
                        name="username"
                        type="text"
                        autoComplete="username"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="Enter employee ID"
                        value={lecturerEmployeeId}
                        onChange={onEmployeeIdChange}
                        className="pl-10"
                        required
                      />
                    </div>
                    {lecturerEmployeeIdError ? (
                      <p className="text-xs text-red-600">{lecturerEmployeeIdError}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lecturer-password">PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="lecturer-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="current-password"
                        placeholder="6-digit PIN"
                        value={password}
                        onChange={onPinChange}
                        className="pl-10 pr-10 tracking-widest"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide PIN' : 'Show PIN'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Forgot PIN?</span> Ask the administrator to reset it.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Spinner className="h-4 w-4" /> Signing in…</> : 'Sign In as Staff/Account'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={handleSubmit} method="post" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email or phone</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="admin-email"
                        name="username"
                        type="text"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="Email or 10-digit phone number"
                        value={adminEmail}
                        onChange={onAdminEmailChange}
                        aria-invalid={Boolean(adminEmailError)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {adminEmailError ? <p className="text-xs text-red-600">{adminEmailError}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        id="admin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="current-password"
                        placeholder="6-digit PIN"
                        value={password}
                        onChange={onPinChange}
                        className="pl-10 pr-10 tracking-widest"
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide PIN' : 'Show PIN'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Forgot PIN?</span> Ask the super admin to reset it.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <><Spinner className="h-4 w-4" /> Signing in…</> : 'Sign In as Admin'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-6 text-center text-xs text-gray-500">
              <strong>Staff/Account:</strong> employee ID and 6-digit PIN.{' '}
              <strong>Admin:</strong> email or phone number and 6-digit PIN.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
      <InstallAppPrompt />
    </div>
  );
}
