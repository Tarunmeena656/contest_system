import { Link } from 'react-router';
import { fmtDate } from '../format';
import type { Contest } from '../types';
import { AccessBadge, Badge, StatusBadge } from './Badge';

export function ContestCard({ contest }: { contest: Contest }) {
  return (
    <Link to={`/contests/${contest.id}`} className="card contest-card">
      <div className="card-head">
        <h3>{contest.name}</h3>
        <StatusBadge status={contest.status} />
      </div>
      <p className="muted clamp">{contest.description || 'No description'}</p>
      <div className="badges">
        <AccessBadge level={contest.access_level} />
        <Badge tone="blue">{contest.difficulty}</Badge>
        {contest.tags.map((tag) => (
          <Badge key={tag}>#{tag}</Badge>
        ))}
      </div>
      <dl className="meta">
        <div>
          <dt>Starts</dt>
          <dd>{fmtDate(contest.start_time)}</dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>{fmtDate(contest.end_time)}</dd>
        </div>
        <div>
          <dt>Prize</dt>
          <dd>{contest.prize ?? 'none'}</dd>
        </div>
      </dl>
      {contest.status === 'active' && contest.can_participate && <span className="hint">Open for you, join now</span>}
      {contest.access_level === 'vip' && !contest.can_participate && (
        <span className="hint muted">VIP members only</span>
      )}
    </Link>
  );
}
