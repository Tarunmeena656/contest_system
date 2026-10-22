import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { RoleBadge } from '../components/Badge';
import { ErrorMessage, Loading, Message } from '../components/Message';
import { fmtDate } from '../format';
import { useLoad } from '../hooks/useLoad';
import type { Page, Role, User } from '../types';

const roles: Role[] = ['user', 'vip', 'admin'];

export function UsersPage() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');

  const users = useLoad(
    () => api.get<Page<User>>(`/users?pageSize=50${query ? `&q=${encodeURIComponent(query)}` : ''}`),
    [query],
  );

  async function changeRole(user: User, role: Role) {
    setError(null);
    setNotice('');
    try {
      const updated = await api.patch<User>(`/users/${user.id}/role`, { role });
      users.setData((prev) =>
        prev ? { ...prev, items: prev.items.map((u) => (u.id === updated.id ? updated : u)) } : prev,
      );
      setNotice(`${updated.name} is now ${updated.role}. They need to sign in again for the new role to apply.`);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section className="card">
      <h2>Users</h2>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
        <button type="submit">Search</button>
      </form>
      <ErrorMessage error={error} />
      {notice && <Message kind="success">{notice}</Message>}
      {users.loading && <Loading />}
      <ErrorMessage error={users.error} />
      {users.data && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Change role</th>
            </tr>
          </thead>
          <tbody>
            {users.data.items.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <RoleBadge role={user.role} />
                </td>
                <td>{fmtDate(user.created_at)}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user, e.target.value as Role)}
                    disabled={user.id === me?.id}
                    title={user.id === me?.id ? 'You cannot change your own role' : ''}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {users.data && <p className="muted small">{users.data.total} users</p>}
    </section>
  );
}
