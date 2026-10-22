import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { RoleBadge } from './Badge';
import { TrophyIcon } from './Icons';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand">
          <span className="logo">
            <TrophyIcon width={18} height={18} />
          </span>
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
              <span className="who">
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
