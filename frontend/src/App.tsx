import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth';
import { Header } from './components/Header';
import { Message } from './components/Message';
import { ContestPage } from './pages/ContestPage';
import { ContestsPage } from './pages/ContestsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LoginPage } from './pages/LoginPage';
import { MePage } from './pages/MePage';
import { NewContestPage } from './pages/NewContestPage';
import { RegisterPage } from './pages/RegisterPage';
import { UsersPage } from './pages/UsersPage';
import type { Role } from './types';

function Protected({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (role && user.role !== role) return <Message kind="error">This page is for admins.</Message>;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<ContestsPage />} />
          <Route path="/contests/:id" element={<ContestPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/me"
            element={
              <Protected>
                <MePage />
              </Protected>
            }
          />
          <Route
            path="/admin/contests/new"
            element={
              <Protected role="admin">
                <NewContestPage />
              </Protected>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Protected role="admin">
                <UsersPage />
              </Protected>
            }
          />
          <Route path="*" element={<Message kind="error">Page not found.</Message>} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>Contest System</span>
          <span className="muted">Node.js · Express · PostgreSQL · React</span>
          <a href="https://github.com/Tarunmeena656/contest_system" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
