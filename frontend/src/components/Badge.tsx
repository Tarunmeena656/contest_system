import type { ReactNode } from 'react';
import type { AccessLevel, ContestStatus, Role } from '../types';

type Tone = 'grey' | 'blue' | 'green' | 'gold' | 'red' | 'amber';

export function Badge({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: ContestStatus }) {
  const tone = status === 'active' ? 'green' : status === 'upcoming' ? 'amber' : 'grey';
  return <Badge tone={tone}>{status}</Badge>;
}

export function AccessBadge({ level }: { level: AccessLevel }) {
  return <Badge tone={level === 'vip' ? 'gold' : 'grey'}>{level === 'vip' ? 'VIP' : 'Normal'}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={role === 'admin' ? 'red' : role === 'vip' ? 'gold' : 'grey'}>{role}</Badge>;
}
