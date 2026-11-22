import { cn } from '../ui/utils';

const LOGO_SRC = '/school-logo.png?v=2';
const LOGO_ALT = 'Ananya Public School';

export function AppLogo({ variant = 'sidebar', className, showTitle = true }) {
  const isLogin = variant === 'login';

  return (
    <div
      className={cn(
        'flex items-center',
        isLogin ? 'flex-col text-center gap-3' : 'min-w-0 gap-2.5',
        className
      )}
    >
      <img
        src={LOGO_SRC}
        alt={LOGO_ALT}
        className={cn(
          'object-contain shrink-0',
          isLogin ? 'h-32 sm:h-40 w-auto' : 'h-11 w-11'
        )}
      />
      {showTitle && isLogin ? (
        <span className="block max-w-sm">
          <span className="block text-lg sm:text-xl font-bold text-gray-900">
            Ananya Public School
          </span>
          <span className="block text-sm text-gray-600">Chikkabennuru, Chitradurga</span>
        </span>
      ) : null}
      {showTitle && !isLogin ? (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold text-gray-900">Ananya Public</span>
          <span className="block truncate text-xs text-gray-600">School</span>
        </span>
      ) : null}
    </div>
  );
}
