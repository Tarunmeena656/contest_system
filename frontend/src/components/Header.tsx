import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { RoleBadge } from './Badge';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand">
          Contest System
        </Link>
        <nav>
          <NavLink to="/" end>
            Contests
          </NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          {user && <NavLink to="/me">My contests</NavLink>}
          {user?.role === 'admin' && (
            <>
              <NavLink to="/admin/contests/new">New contest</NavLink>
              <NavLink to="/admin/users">Users</NavLink>
            </>
          )}
        </nav>
        <div className="account">
          {user ? (
            <>
              <span>
                {user.name} <RoleBadge role={user.role} />
              </span>
              <button
                type="button"
                className="link"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register" className="button small">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
