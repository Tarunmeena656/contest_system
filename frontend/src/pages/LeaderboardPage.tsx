import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorMessage, Loading } from '../components/Message';
import { useLoad } from '../hooks/useLoad';
import type { Overall } from '../types';

export function LeaderboardPage() {
  const { user } = useAuth();
  const board = useLoad(() => api.get<Overall>('/leaderboard?pageSize=50'), [user?.id]);

  return (
    <section className="card">
      <h2>Overall leaderboard</h2>
      <p className="muted">Total score across every finished contest. Ties share a rank.</p>
      {board.loading && <Loading />}
      <ErrorMessage error={board.error} />
      {board.data && board.data.items.length === 0 && <p className="muted">Nobody has finished a contest yet.</p>}
      {board.data && board.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Total score</th>
              <th>Contests</th>
              <th>Prizes</th>
            </tr>
          </thead>
          <tbody>
            {board.data.items.map((row) => (
              <tr key={row.user_id} className={board.data?.me?.user_id === row.user_id ? 'me' : ''}>
                <td>{row.rank}</td>
                <td>{row.name}</td>
                <td>{row.total_score}</td>
                <td>{row.contests_played}</td>
                <td>{row.prizes_won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {board.data?.me && <p className="muted">You are ranked #{board.data.me.rank}.</p>}
    </section>
  );
}
