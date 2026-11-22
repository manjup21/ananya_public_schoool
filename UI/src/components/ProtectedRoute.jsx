import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';

function mergeUser(authKitUser, reduxUser) {
  if (!authKitUser) return reduxUser;
  return {
    ...reduxUser,
    ...authKitUser,
    is_super_admin: authKitUser.is_super_admin ?? reduxUser?.is_super_admin,
    is_admin: authKitUser.is_admin ?? reduxUser?.is_admin,
    can_manage_fees: authKitUser.can_manage_fees ?? reduxUser?.can_manage_fees,
    can_switch_portal: authKitUser.can_switch_portal ?? reduxUser?.can_switch_portal,
    has_lecturer_profile: authKitUser.has_lecturer_profile ?? reduxUser?.has_lecturer_profile,
  };
}

function isFeeOnlyStaff(user) {
  return Boolean(user?.can_manage_fees) && !user?.is_admin && user?.role === 'lecturer';
}

export function ProtectedRoute({
  roles,
  requireCanManageFees = false,
  requireOperationalAdmin = false,
  requireSuperAdmin = false,
  requireAdminPortal = false,
  blockFeeOnlyStaff = false,
  allowPasswordSetup = false,
}) {
  const isAuthKitAuth = useIsAuthenticated();
  const authKitUser = useAuthUser();
  const reduxUser = useSelector((s) => s.auth.user);

  const user = mergeUser(authKitUser, reduxUser);
  const isAuthenticated = isAuthKitAuth || !!reduxUser;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles?.length) {
    if (!user?.role || !roles.includes(user.role)) {
      return <Navigate to="/login" replace />;
    }
  }

  if (user?.password_setup && !allowPasswordSetup) {
    return <Navigate to="/set-password" replace />;
  }

  if (requireAdminPortal && !user?.is_super_admin && !user?.is_admin) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !user?.is_super_admin) {
    return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'} replace />;
  }

  if (requireOperationalAdmin && !user?.is_admin) {
    return <Navigate to={user?.is_super_admin ? '/admin/staff' : '/login'} replace />;
  }

  if (requireCanManageFees && !user?.can_manage_fees) {
    const fallback =
      user?.role === 'admin'
        ? user?.is_super_admin && !user?.is_admin
          ? '/admin/staff'
          : '/admin/dashboard'
        : '/staff/dashboard';
    return <Navigate to={fallback} replace />;
  }

  if (blockFeeOnlyStaff && isFeeOnlyStaff(user)) {
    return <Navigate to="/staff/fees" replace />;
  }

  return <Outlet />;
}
