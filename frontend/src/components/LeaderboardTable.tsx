import { fmtDate, initials } from '../format';
import type { LeaderboardRow } from '../types';

function Row({ row, me, suffix }: { row: LeaderboardRow; me: boolean; suffix?: string }) {
  return (
    <tr className={me ? 'me' : ''}>
      <td>
        <span className={`rank${row.rank <= 3 ? ` rank-${row.rank}` : ''}`}>{row.rank}</span>
      </td>
      <td>
        <span className="person">
          <span className="avatar">{initials(row.name)}</span>
          {row.name}
          {suffix}
        </span>
      </td>
      <td className="num">{row.score}</td>
      <td className="muted small">{fmtDate(row.submitted_at)}</td>
    </tr>
  );
}

export function LeaderboardTable({ rows, me }: { rows: LeaderboardRow[]; me: LeaderboardRow | null }) {
  if (!rows.length) return <p className="muted">No submissions yet. Be the first on the board.</p>;
  const onPage = me ? rows.some((r) => r.user_id === me.user_id) : true;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th className="num">Score</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.user_id} row={row} me={me?.user_id === row.user_id} />
          ))}
          {me && !onPage && <Row row={me} me suffix=" (you)" />}
        </tbody>
      </table>
    </div>
  );
}
