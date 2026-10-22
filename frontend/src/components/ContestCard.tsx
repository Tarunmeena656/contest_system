import { Link } from 'react-router';
import { timeUntil } from '../format';
import type { Contest } from '../types';
import { AccessBadge, Badge, StatusBadge } from './Badge';
import { ClockIcon, TrophyIcon } from './Icons';

function timing(contest: Contest): string {
  if (contest.status === 'active') return `Ends ${timeUntil(contest.end_time)}`;
  if (contest.status === 'upcoming') return `Starts ${timeUntil(contest.start_time)}`;
  return `Ended ${timeUntil(contest.end_time)}`;
}

export function ContestCard({ contest }: { contest: Contest }) {
  return (
    <Link to={`/contests/${contest.id}`} className={`card contest-card status-${contest.status}`}>
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
      <div className="card-foot">
        <span className={`icon-text ${contest.prize ? 'prize' : 'muted'}`}>
          <TrophyIcon /> {contest.prize ?? 'No prize'}
        </span>
        <span className="icon-text muted">
          <ClockIcon /> {timing(contest)}
        </span>
      </div>
      {contest.status === 'active' && contest.can_participate && <span className="hint">Open for you, join now</span>}
      {contest.access_level === 'vip' && !contest.can_participate && (
        <span className="hint muted">VIP members only</span>
      )}
    </Link>
  );
}
