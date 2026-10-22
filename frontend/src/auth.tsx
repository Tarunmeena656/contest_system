import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, SESSION_EXPIRED, setToken } from './api';
import type { User } from './types';

interface Session {
  token: string;
  user: User;
}

interface AuthValue {
  user: User | null;
  // false until the stored session has been checked against the api
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
}

const STORAGE_KEY = 'contest-session';
const AuthContext = createContext<AuthValue | null>(null);

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const stored = loadSession();
    setToken(stored?.token ?? null);
    return stored;
  });
  const [ready, setReady] = useState(false);

  function save(next: Session | null) {
    setToken(next?.token ?? null);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // private mode or blocked storage: the session still works for this tab
    }
    setSession(next);
  }

  // on load, confirm the stored token still works and refresh the user (role may have changed)
  useEffect(() => {
    const stored = loadSession();
    if (!stored) {
      setReady(true);
      return;
    }
    api
      .get<User>('/auth/me')
      .then((user) => save({ token: stored.token, user }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) save(null);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const expired = () => save(null);
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    ready,
    async login(email, password) {
      save(await api.post<Session>('/auth/login', { email, password }));
    },
    async register(name, email, password) {
      save(await api.post<Session>('/auth/register', { name, email, password }));
    },
    logout() {
      save(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
