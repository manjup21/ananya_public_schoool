import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Plus } from 'lucide-react';
import { SearchInput } from '../components/common/SearchInput';
import { toast } from 'sonner';
import 'react-datepicker/dist/react-datepicker.css';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { useDispatch, useSelector } from 'react-redux';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import { useNavigate } from 'react-router-dom';
import {
  createLecturerThunk,
  deleteLecturerThunk,
  fetchLecturersThunk,
  resetLecturerPasswordThunk,
  updateLecturerThunk,
} from '../features/lecturers/lecturersSlice';
import { formatDateOnlyLocal, parseApiDateOnly } from '../utils/dateOnly';
import { logoutThunk, clearAuth, refreshSessionThunk } from '../features/auth/authSlice';
import { LecturerFormFields } from './lecturerManagement/LecturerFormFields';
import { LecturersTable } from './lecturerManagement/LecturersTable';
import { LecturerViewDialog } from './lecturerManagement/LecturerViewDialog';
import { LecturerResetPasswordDialog } from './lecturerManagement/LecturerResetPasswordDialog';
import { validateLecturerForm } from './lecturerManagement/lecturerFormHelpers';
import { Spinner } from '../components/ui/spinner';

export function LecturerManagement() {
  const dispatch = useDispatch();
  const { items, total, status, error } = useSelector((s) => s.lecturers);
  const authUser = useAuthUser();
  const reduxUser = useSelector((s) => s.auth.user);
  const user = reduxUser ?? authUser;
  const signIn = useSignIn();
  const signOut = useSignOut();
  const navigate = useNavigate();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingLecturerId, setEditingLecturerId] = useState(null);
  const [viewingLecturer, setViewingLecturer] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingLecturer, setDeletingLecturer] = useState(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resettingLecturer, setResettingLecturer] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [makeSuperAdminToo, setMakeSuperAdminToo] = useState(false);
  const [makeAdminToo, setMakeAdminToo] = useState(false);
  const [makeFeeManagerToo, setMakeFeeManagerToo] = useState(false);
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('+91');
    setEmployeeId('');
    setDateOfBirth(null);
    setSubjects([]);
    setMakeSuperAdminToo(false);
    setMakeAdminToo(false);
    setMakeFeeManagerToo(false);
    setErrors({});
  };

  const clearFieldError = (field) =>
    setErrors((p) => (p?.[field] ? { ...p, [field]: undefined } : p));

  useEffect(() => {
    dispatch(fetchLecturersThunk({ page: 1, limit: 50, search: '' }));
  }, [dispatch]);

  const handleCreateLecturer = async () => {
    const { ok, errors: nextErrors } = validateLecturerForm({
      title,
      firstName,
      lastName,
      email,
      phone,
      employeeId,
      dateOfBirth,
      subjects,
    });
    setErrors(nextErrors);
    if (!ok) {
      toast.error('Please fill all required fields (*)');
      return;
    }

    const fullName = `${title} ${firstName.trim()} ${lastName.trim()}`.trim();
    setSaving(true);
    try {
      const dob =
        dateOfBirth instanceof Date ? formatDateOnlyLocal(dateOfBirth) : String(dateOfBirth || '').trim();
      const created = await dispatch(
        createLecturerThunk({
          title,
          first_name: firstName,
          last_name: lastName,
          employee_id: employeeId,
          email,
          phone,
          date_of_birth: dob,
          subjects,
          is_super_admin: makeSuperAdminToo,
          is_admin: makeAdminToo,
          can_manage_fees: makeFeeManagerToo,
        })
      ).unwrap();
      const initialPw = created?.initial_password;
      toast.success(
        initialPw
          ? `Staff "${fullName}" added. Default login PIN: ${initialPw}`
          : `Staff "${fullName}" added successfully!`
      );
      setIsCreateDialogOpen(false);
      resetForm();
      dispatch(fetchLecturersThunk({ page: 1, limit: 50, search: '' }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (lecturer) => {
    setViewingLecturer(lecturer ?? null);
    setEditingLecturerId(lecturer.id);
    setTitle(lecturer.title ?? '');
    setFirstName(lecturer.first_name ?? '');
    setLastName(lecturer.last_name ?? '');
    setEmail(lecturer.email ?? '');
    setPhone(lecturer.phone ?? '+91');
    setEmployeeId(lecturer.employee_id ?? '');
    setDateOfBirth(parseApiDateOnly(lecturer.date_of_birth));
    setMakeSuperAdminToo(Boolean(lecturer?.is_super_admin));
    setMakeAdminToo(Boolean(lecturer?.is_admin));
    setMakeFeeManagerToo(Boolean(lecturer?.can_manage_fees));
    setSubjects(
      String(lecturer.subjects || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setErrors({});
    setIsEditDialogOpen(true);
  };

  const openView = (lecturer) => {
    setViewingLecturer(lecturer ?? null);
    setIsViewDialogOpen(true);
  };

  const handleUpdateLecturer = async () => {
    const { ok, errors: nextErrors } = validateLecturerForm({
      title,
      firstName,
      lastName,
      email,
      phone,
      employeeId,
      dateOfBirth,
      subjects,
    });
    setErrors(nextErrors);
    if (!ok) {
      toast.error('Please fill all required fields (*)');
      return;
    }

    setSaving(true);
    try {
      const isSelf = Boolean(user?.id) && String(viewingLecturer?.user_id || '') === String(user?.id || '');
      const dob =
        dateOfBirth instanceof Date ? formatDateOnlyLocal(dateOfBirth) : String(dateOfBirth || '').trim();
      await dispatch(
        updateLecturerThunk({
          lecturerId: editingLecturerId,
          payload: {
            title,
            first_name: firstName,
            last_name: lastName,
            employee_id: employeeId,
            email,
            phone,
            date_of_birth: dob,
            subjects,
            is_super_admin: makeSuperAdminToo,
            is_admin: makeAdminToo,
            can_manage_fees: makeFeeManagerToo,
          },
        })
      ).unwrap();
      const accessBits = [
        makeSuperAdminToo ? 'Super Admin' : null,
        makeAdminToo ? 'Admin' : null,
        makeFeeManagerToo ? 'Fee Management' : null,
      ].filter(Boolean);
      toast.success(
        accessBits.length
          ? `Staff updated. Access enabled: ${accessBits.join(' + ')}.`
          : 'Staff updated'
      );

      if (isSelf) {
        try {
          const payload = await dispatch(refreshSessionThunk()).unwrap();
          const okSession = signIn({
            auth: { token: payload.token, type: 'Bearer' },
            userState: payload.user,
          });
          if (!okSession) throw new Error('Unable to persist session');
          const nextUser = payload.user;
          let home = '/staff/dashboard';
          if (nextUser?.role === 'admin') {
            home = nextUser.is_super_admin && !nextUser.is_admin ? '/admin/staff' : '/admin/dashboard';
          } else if (nextUser?.can_manage_fees && !nextUser?.is_admin) {
            home = '/staff/fees';
          }
          window.location.assign(home);
          return;
        } catch {
          try {
            await dispatch(logoutThunk()).unwrap();
          } catch {
            /* ignore */
          }
          dispatch(clearAuth());
          signOut();
          navigate('/login', { replace: true });
          return;
        }
      }

      setIsEditDialogOpen(false);
      setEditingLecturerId(null);
      resetForm();
      dispatch(fetchLecturersThunk({ page: 1, limit: 50, search: '' }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to update staff');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (lecturer) => {
    setDeletingLecturer(lecturer);
    setIsDeleteDialogOpen(true);
  };

  const openResetPassword = (lecturer) => {
    setResettingLecturer(lecturer);
    setResetPasswordValue('');
    setShowResetPassword(false);
    setIsResetDialogOpen(true);
  };

  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    if (!resettingLecturer?.id) return;
    setResetting(true);
    try {
      const res = await dispatch(resetLecturerPasswordThunk(resettingLecturer.id)).unwrap();
      const pw = res?.temporary_password || '';
      setResetPasswordValue(pw);
      toast.success('PIN reset to 000000. Share it with the staff member.');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to reset PIN');
    } finally {
      setResetting(false);
    }
  };

  const copyResetPassword = async () => {
    if (!resetPasswordValue) return;
    try {
      await navigator.clipboard.writeText(resetPasswordValue);
      toast.success('Default PIN copied');
    } catch {
      toast.error('Unable to copy');
    }
  };

  const confirmDelete = async () => {
    if (!deletingLecturer?.id) return;
    try {
      await dispatch(deleteLecturerThunk(deletingLecturer.id)).unwrap();
      toast.success('Staff deleted');
      setIsDeleteDialogOpen(false);
      setDeletingLecturer(null);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Delete failed');
    }
  };

  const lecturers = useMemo(() => {
    const list = items ?? [];
    const q = String(searchQuery ?? '').trim().toLowerCase();
    if (!q) return list;

    return list.filter((lecturer) => {
      const employeeIdText = String(lecturer?.employee_id ?? '').toLowerCase();
      const emailText = String(lecturer?.email ?? '').toLowerCase();
      const nameText = [lecturer?.title, lecturer?.first_name, lecturer?.last_name, lecturer?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const rawSubjects = lecturer?.subjects;
      const subjectList = Array.isArray(rawSubjects)
        ? rawSubjects
        : String(rawSubjects ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const subjectsText = subjectList.join(' ').toLowerCase();

      return (
        employeeIdText.includes(q) ||
        emailText.includes(q) ||
        nameText.includes(q) ||
        subjectsText.includes(q)
      );
    });
  }, [items, searchQuery]);

  // Note: errors state is currently shown only via toast (parity with original
  // implementation). Keeping the object around so field-level hints can be
  // wired up later without another round of plumbing.
  void errors;

  const formFieldProps = {
    title,
    setTitle,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    employeeId,
    setEmployeeId,
    email,
    setEmail,
    phone,
    setPhone,
    dateOfBirth,
    setDateOfBirth,
    subjects,
    setSubjects,
    clearFieldError,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                setIsCreateDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="gap-2 w-full sm:w-auto"
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsCreateDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Add New Staff</DialogTitle>
                  <DialogDescription>Enter staff details and assign subjects</DialogDescription>
                </DialogHeader>
                <LecturerFormFields {...formFieldProps} />
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 space-y-2.5">
                  <p className="text-sm font-medium text-gray-900">Additional access</p>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                    <label htmlFor="make-super-admin-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="make-super-admin-too"
                        checked={makeSuperAdminToo}
                        onCheckedChange={setMakeSuperAdminToo}
                      />
                      <span className="text-sm text-gray-900">Super Admin</span>
                    </label>
                    <label htmlFor="make-admin-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="make-admin-too"
                        checked={makeAdminToo}
                        onCheckedChange={setMakeAdminToo}
                      />
                      <span className="text-sm text-gray-900">Admin</span>
                    </label>
                    <label htmlFor="make-fee-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="make-fee-too"
                        checked={makeFeeManagerToo}
                        onCheckedChange={setMakeFeeManagerToo}
                      />
                      <span className="text-sm text-gray-900">Fee Management</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">Leave all unchecked for staff-only access.</p>
                </div>
                <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/80 px-3 py-2 text-sm text-blue-950">
                  <p className="font-medium text-blue-900">Login PIN (default)</p>
                  <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">
                    New staff get default PIN <code className="rounded bg-white/80 px-1">000000</code>.
                    They sign in on the Staff tab with <strong>employee ID</strong> and that PIN, then must
                    set a new 6-digit PIN before continuing.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleCreateLecturer} disabled={saving}>
                    {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Add Staff'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isEditDialogOpen}
              onOpenChange={(open) => {
                setIsEditDialogOpen(open);
                if (!open) {
                  setEditingLecturerId(null);
                  resetForm();
                }
              }}
            >
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Edit Staff</DialogTitle>
                  <DialogDescription>Update staff details</DialogDescription>
                </DialogHeader>
                <LecturerFormFields idPrefix="edit" {...formFieldProps} />
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 space-y-2.5">
                  <p className="text-sm font-medium text-gray-900">Additional access</p>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                    <label htmlFor="edit-make-super-admin-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="edit-make-super-admin-too"
                        checked={makeSuperAdminToo}
                        onCheckedChange={setMakeSuperAdminToo}
                      />
                      <span className="text-sm text-gray-900">Super Admin</span>
                    </label>
                    <label htmlFor="edit-make-admin-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="edit-make-admin-too"
                        checked={makeAdminToo}
                        onCheckedChange={setMakeAdminToo}
                      />
                      <span className="text-sm text-gray-900">Admin</span>
                    </label>
                    <label htmlFor="edit-make-fee-too" className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox
                        id="edit-make-fee-too"
                        checked={makeFeeManagerToo}
                        onCheckedChange={setMakeFeeManagerToo}
                      />
                      <span className="text-sm text-gray-900">Fee Management</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">Leave all unchecked for staff-only access.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingLecturerId(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleUpdateLecturer} disabled={saving}>
                    {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Save Changes'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <DeleteConfirmDialog
              open={isDeleteDialogOpen}
              onOpenChange={(open) => {
                setIsDeleteDialogOpen(open);
                if (!open) setDeletingLecturer(null);
              }}
              description={
                <>
                  You will delete{' '}
                  <span className="font-medium text-gray-900">
                    {[deletingLecturer?.title, deletingLecturer?.first_name, deletingLecturer?.last_name]
                      .filter(Boolean)
                      .join(' ') || 'this staff member'}
                  </span>
                  . This action cannot be undone.
                </>
              }
              onConfirm={confirmDelete}
            />

            <LecturerResetPasswordDialog
              open={isResetDialogOpen}
              onOpenChange={(open) => {
                setIsResetDialogOpen(open);
                if (!open) {
                  setResettingLecturer(null);
                  setResetPasswordValue('');
                  setShowResetPassword(false);
                }
              }}
              lecturer={resettingLecturer}
              resetPasswordValue={resetPasswordValue}
              showResetPassword={showResetPassword}
              onToggleShow={() => setShowResetPassword((v) => !v)}
              onReset={handleResetPassword}
              resetting={resetting}
              onCopy={copyResetPassword}
            />

            <LecturerViewDialog
              open={isViewDialogOpen}
              onOpenChange={(open) => {
                setIsViewDialogOpen(open);
                if (!open) setViewingLecturer(null);
              }}
              lecturer={viewingLecturer}
            />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <SearchInput
              placeholder="Search by name, email, employee ID, or subject..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
          </div>
          <LecturersTable
            lecturers={lecturers}
            status={status}
            onView={openView}
            onEdit={openEdit}
            onResetPassword={openResetPassword}
            onDelete={openDeleteConfirm}
          />
          <div className="mt-4 text-sm text-gray-600">
            {error ? (
              <span className="text-red-600">{String(error)}</span>
            ) : (
              <>Showing {lecturers.length} of {total} lecturers</>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
