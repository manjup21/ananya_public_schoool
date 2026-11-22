import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import useSignIn from 'react-auth-kit/hooks/useSignIn';
import useSignOut from 'react-auth-kit/hooks/useSignOut';
import { meThunk, setAuth, clearAuth } from '../features/auth/authSlice';
import { TOKEN_STORAGE_KEY } from '../services/api';

/**
 * On mount, rehydrate Redux + AuthKit from the backend httpOnly cookie via /auth/me.
 * Blocks child rendering until the check completes to avoid flash-redirects.
 */
export function AuthBootstrap({ children }) {
  const dispatch = useDispatch();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const didRun = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        const user = await dispatch(meThunk()).unwrap();
        const token = window?.localStorage?.getItem(TOKEN_STORAGE_KEY);

        dispatch(setAuth({ user, token: token || null }));

        if (token) {
          signIn({
            auth: { token, type: 'Bearer' },
            userState: user,
          });
        }
      } catch {
        dispatch(clearAuth());
        signOut();
      } finally {
        setReady(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return children;
}
