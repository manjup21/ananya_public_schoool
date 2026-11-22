export function staffHomePath(user) {
  if (user?.can_manage_fees && !user?.is_admin) return '/staff/fees';
  return '/staff/dashboard';
}

export function adminHomePath(user) {
  if (user?.is_super_admin && !user?.is_admin) return '/admin/staff';
  return '/admin/dashboard';
}

/** Where a signed-in staff/admin user lands; password-setup sessions must set a password first. */
export function authHomePath(user) {
  if (user?.password_setup) return '/set-password';
  return user?.role === 'admin' ? adminHomePath(user) : staffHomePath(user);
}
