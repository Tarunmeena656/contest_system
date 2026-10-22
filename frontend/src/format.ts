import type { QuestionType } from './types';

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

// "in 3 days", "tomorrow", "2 hours ago"
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return diff >= 0 ? 'in under a minute' : 'just now';
}

// <input type="datetime-local"> works in local time without a zone
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export const typeLabel: Record<QuestionType, string> = {
  'single-select': 'Single choice',
  'multi-select': 'Multiple choice',
  'true-false': 'True / False',
};

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
