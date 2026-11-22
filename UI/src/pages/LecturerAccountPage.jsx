import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserCircle, KeyRound } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChangePasswordDialog } from '../components/account/ChangePasswordDialog';
import {
  fetchLecturerProfileThunk,
} from '../features/lecturerAccount/lecturerAccountSlice';

function formatDisplayDate(value) {
  if (value == null || String(value).trim() === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ProfileField({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap wrap-break-word">{value ?? '—'}</p>
    </div>
  );
}

export function LecturerAccountPage() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const profile = useSelector((s) => s.lecturerAccount.profile);
  const profileStatus = useSelector((s) => s.lecturerAccount.profileStatus);
  const profileError = useSelector((s) => s.lecturerAccount.profileError);

  const [pwdOpen, setPwdOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchLecturerProfileThunk());
  }, [dispatch]);

  const displayName = profile
    ? [profile.title, profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || '—'
    : '—';

  const subjectsText =
    profile?.subjects != null && String(profile.subjects).trim() !== ''
      ? String(profile.subjects)
      : '—';

  return (
    <div className="w-full min-h-0 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <UserCircle className="h-7 w-7 shrink-0 text-blue-600" aria-hidden />
            My account
          </h1>        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end shrink-0">
          <Button type="button" className="w-full sm:w-auto lg:min-w-44" onClick={() => setPwdOpen(true)}>
            <KeyRound className="h-4 w-4 mr-2" aria-hidden />
            Change PIN
          </Button>
        </div>
      </header>

      <Card className="w-full border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>Profile</CardTitle>        </CardHeader>
        <CardContent className="space-y-8 pt-2">
          {profileStatus === 'loading' ? (
            <p className="text-sm text-gray-500">Loading profile…</p>
          ) : profileStatus === 'failed' ? (
            <p className="text-sm text-red-600">{profileError}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-5">
              <ProfileField label="Employee ID" value={profile?.employee_id} />
              <ProfileField label="Display name" value={displayName} />
              <ProfileField label="Title" value={profile?.title} />
              <ProfileField label="First name" value={profile?.first_name} />
              <ProfileField label="Last name" value={profile?.last_name} />
              <ProfileField label="Email" value={profile?.email} />
              <ProfileField label="Phone" value={profile?.phone} />
              <ProfileField label="Subjects" value={subjectsText} />
              <ProfileField label="Date of birth" value={formatDisplayDate(profile?.date_of_birth)} />
              <ProfileField label="Member since" value={formatDisplayDate(profile?.created_at)} />
            </div>
          )}
          {user ? (
            <div className="pt-8 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Login account</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ProfileField label="Login name" value={user.name} />
                <ProfileField label="Login email" value={user.email} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  );
}
