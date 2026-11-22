import { useState } from 'react';
import { useSelector } from 'react-redux';
import { KeyRound, UserCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ChangePasswordDialog } from '../components/account/ChangePasswordDialog';

function ProfileField({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap wrap-break-word">{value ?? '—'}</p>
    </div>
  );
}

export function AdminAccountPage() {
  const user = useSelector((s) => s.auth.user);
  const [pwdOpen, setPwdOpen] = useState(false);

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-5">
            <ProfileField label="Display name" value={user?.name} />
            <ProfileField label="Email" value={user?.email} />
            <ProfileField label="Role" value={user?.role} />
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  );
}

