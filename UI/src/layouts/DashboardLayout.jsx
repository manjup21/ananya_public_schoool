import { Outlet, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Layers,
  GraduationCap,
  Bell,
  CalendarCheck,
  CalendarClock,
  UserCircle,
  Wallet,
  Download,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated';
import { useDispatch, useSelector } from 'react-redux';
import { logoutThunk, clearAuth, switchPortalThunk } from '../features/auth/authSlice';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
import { AppLogo } from '../components/common/AppLogo';

const lecturerMarksSubNav = [
  { name: 'Exam template', href: '/staff/marks/exam-sheet' },
  { name: 'Enter results', href: '/staff/marks/results' },
  { name: 'View / export', href: '/staff/marks/view' },
  { name: 'Consolidated results', href: '/staff/marks/consolidated' },
];

const adminNotificationsSubNav = [
  { name: 'Attendance', href: '/admin/notifications/attendance' },
  { name: 'Examinations', href: '/admin/notifications/exams' },
  { name: 'Fee dues', href: '/admin/notifications/fees' },
];

const navigation = [
  { name: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard, portal: 'lecturer', staffScope: 'full' },
  { name: 'Students', href: '/staff/students', icon: Users, portal: 'lecturer', staffScope: 'full' },
  { name: 'Attendance', href: '/staff/attendance', icon: ClipboardList, portal: 'lecturer', staffScope: 'full' },
  {
    name: 'Examinations',
    icon: FileText,
    portal: 'lecturer',
    staffScope: 'full',
    children: lecturerMarksSubNav,
  },
  {
    name: 'Fee Management',
    href: '/staff/fees',
    icon: Wallet,
    portal: 'lecturer',
    staffScope: 'fees',
  },
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    portal: 'admin',
    adminScope: 'operational',
  },
  { name: 'Students', href: '/admin/students', icon: Users, portal: 'admin', adminScope: 'operational' },
  { name: 'Downloads', href: '/admin/downloads', icon: Download, portal: 'admin', adminScope: 'operational' },
  { name: 'Staff', href: '/admin/staff', icon: GraduationCap, portal: 'admin', adminScope: 'super' },
  {
    name: 'Classes & subjects',
    href: '/admin/classes',
    icon: Layers,
    portal: 'admin',
    adminScope: 'operational',
  },
  {
    name: 'Examination',
    href: '/admin/examinations',
    icon: CalendarCheck,
    portal: 'admin',
    adminScope: 'operational',
  },
  {
    name: 'Student Report',
    href: '/admin/student-reports',
    icon: FileText,
    portal: 'admin',
    adminScope: 'operational',
  },
  {
    name: 'Attendance config',
    href: '/admin/attendance-config',
    icon: CalendarClock,
    portal: 'admin',
    adminScope: 'operational',
  },
  {
    name: 'Notifications',
    icon: Bell,
    portal: 'admin',
    adminScope: 'operational',
    children: adminNotificationsSubNav,
  },
  {
    name: 'Fee Management',
    href: '/admin/fees',
    icon: Wallet,
    portal: 'admin',
    adminScope: 'fees',
  },
];

export function DashboardLayout() {
  const dispatch = useDispatch();
  const authUser = useAuthUser();
  const reduxUser = useSelector((s) => s.auth.user);
  const signIn = useSignIn();
  const signOut = useSignOut();
  const isAuthenticated = useIsAuthenticated();
  // Prefer AuthKit for role-based navigation.
  // Reason: Redux `user` can be rehydrated from `/auth/me` in a way that doesn't match the
  // currently active portal session (e.g. dual-role users). AuthKit reflects the login portal.
  // Merge portal flags from Redux `/auth/me` when AuthKit user is active (AuthKit may omit flags).
  const user = authUser
    ? {
        ...reduxUser,
        ...authUser,
        is_super_admin: authUser.is_super_admin ?? reduxUser?.is_super_admin,
        is_admin: authUser.is_admin ?? reduxUser?.is_admin,
        can_switch_portal: authUser.can_switch_portal ?? reduxUser?.can_switch_portal,
        can_manage_fees: authUser.can_manage_fees ?? reduxUser?.can_manage_fees,
        has_lecturer_profile: authUser.has_lecturer_profile ?? reduxUser?.has_lecturer_profile,
        db_role: authUser.db_role ?? reduxUser?.db_role,
      }
    : reduxUser;
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const s = new Set();
    if (location.pathname.startsWith('/staff/marks')) s.add('Examinations');
    if (location.pathname.startsWith('/admin/notifications')) s.add('Notifications');
    return s;
  });

  const [loggingOut, setLoggingOut] = useState(false);
  const [switchingPortal, setSwitchingPortal] = useState(false);
  const shouldRedirect = !isAuthenticated || !user;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await dispatch(logoutThunk()).unwrap();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Logout failed');
    } finally {
      dispatch(clearAuth());
      signOut();
      navigate('/login', { replace: true });
    }
  };

  const handleSwitchPortal = async () => {
    if (switchingPortal) return;
    const goingToStaff = user.role === 'admin';
    if (goingToStaff && !user.has_lecturer_profile) {
      toast.error('No staff profile is linked to this admin account. Create or link a staff member first.');
      return;
    }
    setSwitchingPortal(true);
    try {
      const payload = await dispatch(
        switchPortalThunk({ portal: goingToStaff ? 'staff' : 'admin' })
      ).unwrap();
      const ok = signIn({
        auth: { token: payload.token, type: 'Bearer' },
        userState: payload.user,
      });
      if (!ok) throw new Error('Unable to persist session');
      setSidebarOpen(false);
      toast.success(goingToStaff ? 'Switched to Staff portal' : 'Switched to Admin portal');
      navigate(
        goingToStaff
          ? user.can_manage_fees && !user.is_admin
            ? '/staff/fees'
            : '/staff/dashboard'
          : user.is_super_admin && !user.is_admin
            ? '/admin/staff'
            : '/admin/dashboard',
        { replace: true }
      );
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Failed to switch portal');
    } finally {
      setSwitchingPortal(false);
    }
  };

  const currentPath = location.pathname;

  const toggleGroup = (name) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    if (currentPath.startsWith('/staff/marks')) {
      setExpandedGroups((prev) => (prev.has('Examinations') ? prev : new Set(prev).add('Examinations')));
    }
    if (currentPath.startsWith('/admin/notifications')) {
      setExpandedGroups((prev) => (prev.has('Notifications') ? prev : new Set(prev).add('Notifications')));
    }
  }, [currentPath]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

  if (shouldRedirect) {
    return <Navigate to="/login" replace />;
  }

  const isFeeOnlyStaff =
    user.role === 'lecturer' && Boolean(user.can_manage_fees) && !user.is_admin;

  const filteredNavigation = navigation.filter((item) => {
    if (item.portal !== user.role) return false;

    if (user.role === 'lecturer') {
      if (isFeeOnlyStaff) return item.staffScope === 'fees';
      if (item.staffScope === 'fees') return Boolean(user.can_manage_fees);
      return item.staffScope === 'full';
    }

    if (user.role === 'admin') {
      if (item.adminScope === 'super') return Boolean(user.is_super_admin);
      if (item.adminScope === 'operational') return Boolean(user.is_admin);
      if (item.adminScope === 'fees') return Boolean(user.is_admin && user.can_manage_fees);
    }

    return false;
  });
  const isNavActive = (href) => currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
            <AppLogo variant="sidebar" />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              if (item.children?.length) {
                const groupOpen = expandedGroups.has(item.name);
                const childActive = item.children.some((c) => isNavActive(c.href));
                return (
                  <div key={item.name} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.name)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                        childActive
                          ? 'bg-blue-50/80 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                      aria-expanded={groupOpen}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="font-medium flex-1 min-w-0">{item.name}</span>
                      {groupOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                      )}
                    </button>
                    {groupOpen ? (
                      <div className="ml-3 pl-4 border-l border-gray-200 space-y-0.5 pb-1">
                        {item.children.map((sub) => {
                          const subActive = isNavActive(sub.href);
                          return (
                            <NavLink
                              key={sub.href}
                              to={sub.href}
                              className={cn(
                                'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                                subActive
                                  ? 'bg-blue-100 text-blue-800 font-medium'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                              )}
                              onClick={() => setSidebarOpen(false)}
                            >
                              {sub.name}
                            </NavLink>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }
              const isActive = isNavActive(item.href);
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-gray-50">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.can_switch_portal && user.role === 'lecturer'
                    ? 'Admin (Staff mode)'
                    : user.role === 'lecturer'
                      ? 'Staff'
                      : user.role}
                </p>
              </div>
            </div>
            {user.can_switch_portal ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full mt-2 justify-start text-gray-700 hover:bg-gray-100"
                onClick={handleSwitchPortal}
                disabled={switchingPortal}
                title={
                  user.role === 'admin' && !user.has_lecturer_profile
                    ? 'Link a staff profile to this admin account first'
                    : undefined
                }
              >
                {switchingPortal ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" /> Switching…
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    {user.role === 'admin' ? 'Switch to Staff' : 'Switch to Admin'}
                  </>
                )}
              </Button>
            ) : null}
            {user.role === 'lecturer' ? (
              <NavLink
                to="/staff/account"
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mt-2 w-full',
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <UserCircle className="h-5 w-5" />
                <span className="font-medium">My account</span>
              </NavLink>
            ) : user.role === 'admin' ? (
              <NavLink
                to="/admin/account"
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mt-2 w-full',
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <UserCircle className="h-5 w-5" />
                <span className="font-medium">My account</span>
              </NavLink>
            ) : null}
            <Button
              type="button"
              onClick={handleLogout}
              variant="ghost"
              className="w-full mt-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={loggingOut}
            >
              {loggingOut ? <><Spinner className="h-4 w-4 mr-2" /> Logging out…</> : <><LogOut className="h-4 w-4 mr-2" /> Logout</>}
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
          <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700 shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1 min-w-0 lg:flex lg:items-center lg:justify-between">
              <h1 className="text-base sm:text-xl font-semibold text-gray-900 capitalize truncate">
                {(user.role === 'lecturer' ? 'Staff' : user.role)} Portal
              </h1>
              <div className="hidden lg:flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-3 sm:p-6 lg:p-8">
          <PageErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
