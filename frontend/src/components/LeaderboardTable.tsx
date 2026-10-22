import { fmtDate } from '../format';
import type { LeaderboardRow } from '../types';

export function LeaderboardTable({ rows, me }: { rows: LeaderboardRow[]; me: LeaderboardRow | null }) {
  if (!rows.length) return <p className="muted">No submissions yet.</p>;
  const onPage = me ? rows.some((r) => r.user_id === me.user_id) : true;
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Score</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.user_id} className={me?.user_id === row.user_id ? 'me' : ''}>
            <td>{row.rank}</td>
            <td>{row.name}</td>
            <td>{row.score}</td>
            <td>{fmtDate(row.submitted_at)}</td>
          </tr>
        ))}
        {me && !onPage && (
          <tr className="me">
            <td>{me.rank}</td>
            <td>{me.name} (you)</td>
            <td>{me.score}</td>
            <td>{fmtDate(me.submitted_at)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
