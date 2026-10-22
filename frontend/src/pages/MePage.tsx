import { Link } from 'react-router';
import { api } from '../api';
import { useAuth } from '../auth';
import { AccessBadge, Badge, StatusBadge } from '../components/Badge';
import { ErrorMessage, Loading } from '../components/Message';
import { fmtDate } from '../format';
import { useLoad } from '../hooks/useLoad';
import type { HistoryItem, InProgressItem, Page, Prize } from '../types';

export function MePage() {
  const { user } = useAuth();
  const history = useLoad(() => api.get<Page<HistoryItem>>('/me/history?pageSize=50'), [user?.id]);
  const inProgress = useLoad(() => api.get<{ items: InProgressItem[] }>('/me/in-progress'), [user?.id]);
  const prizes = useLoad(() => api.get<{ items: Prize[]; total: number }>('/me/prizes'), [user?.id]);

  return (
    <div className="stack">
      <section className="card">
        <h2>In progress</h2>
        <p className="muted">Contests you joined but have not submitted yet.</p>
        {inProgress.loading && <Loading />}
        <ErrorMessage error={inProgress.error} />
        {inProgress.data?.items.length === 0 && <p className="muted">Nothing in progress.</p>}
        {inProgress.data && inProgress.data.items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Contest</th>
                <th>Joined</th>
                <th>Ends</th>
                <th>Questions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inProgress.data.items.map((item) => (
                <tr key={item.contest_id}>
                  <td>
                    <Link to={`/contests/${item.contest_id}`}>{item.name}</Link>{' '}
                    <AccessBadge level={item.access_level} />
                  </td>
                  <td>{fmtDate(item.joined_at)}</td>
                  <td>{fmtDate(item.end_time)}</td>
                  <td>{item.question_count}</td>
                  <td>
                    {item.missed ? <Badge tone="red">missed</Badge> : <Badge tone="green">open, answer now</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>History</h2>
        {history.loading && <Loading />}
        <ErrorMessage error={history.error} />
        {history.data?.items.length === 0 && <p className="muted">You have not finished a contest yet.</p>}
        {history.data && history.data.items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Contest</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Rank</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {history.data.items.map((item) => (
                <tr key={item.contest_id}>
                  <td>
                    <Link to={`/contests/${item.contest_id}`}>{item.name}</Link> <StatusBadge status={item.status} />
                  </td>
                  <td>{fmtDate(item.submitted_at)}</td>
                  <td>{item.score}</td>
                  <td>#{item.rank}</td>
                  <td>
                    {item.won ? (
                      <Badge tone="gold">won{item.prize ? `: ${item.prize}` : ''}</Badge>
                    ) : item.finalized_at ? (
                      <span className="muted">finished</span>
                    ) : (
                      <span className="muted">awaiting result</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Prizes</h2>
        {prizes.loading && <Loading />}
        <ErrorMessage error={prizes.error} />
        {prizes.data?.items.length === 0 && <p className="muted">No prizes yet. Win a contest!</p>}
        {prizes.data && prizes.data.items.length > 0 && (
          <ul className="prizes">
            {prizes.data.items.map((prize) => (
              <li key={prize.id}>
                <strong>{prize.prize}</strong> for{' '}
                <Link to={`/contests/${prize.contest_id}`}>{prize.contest_name}</Link>, awarded{' '}
                {fmtDate(prize.awarded_at)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
