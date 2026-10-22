import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { fromLocalInput, toLocalInput } from '../format';
import type { Contest } from '../types';
import { ErrorMessage } from './Message';

interface Props {
  // when given, the form edits this contest; otherwise it creates one
  initial?: Contest;
  onSaved(contest: Contest): void;
}

const week = 7 * 24 * 60 * 60 * 1000;

export function ContestForm({ initial, onSaved }: Props) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    access_level: initial?.access_level ?? 'normal',
    difficulty: initial?.difficulty ?? 'intermediate',
    tags: initial?.tags.join(', ') ?? '',
    prize: initial?.prize ?? '',
    start_time: toLocalInput(initial?.start_time ?? new Date().toISOString()),
    end_time: toLocalInput(initial?.end_time ?? new Date(Date.now() + week).toISOString()),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const update = (field: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: form.name,
      description: form.description,
      access_level: form.access_level,
      difficulty: form.difficulty,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      prize: form.prize.trim() || null,
      start_time: fromLocalInput(form.start_time),
      end_time: fromLocalInput(form.end_time),
    };
    try {
      const saved = initial
        ? await api.patch<Contest>(`/contests/${initial.id}`, body)
        : await api.post<Contest>('/contests', body);
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Name
        <input value={form.name} onChange={(e) => update('name', e.target.value)} required minLength={3} />
      </label>
      <label>
        Description
        <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />
      </label>
      <div className="row">
        <label>
          Access
          <select value={form.access_level} onChange={(e) => update('access_level', e.target.value)}>
            <option value="normal">Normal</option>
            <option value="vip">VIP only</option>
          </select>
        </label>
        <label>
          Difficulty
          <select value={form.difficulty} onChange={(e) => update('difficulty', e.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Starts
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => update('start_time', e.target.value)}
            required
          />
        </label>
        <label>
          Ends
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => update('end_time', e.target.value)}
            required
          />
        </label>
      </div>
      <div className="row">
        <label>
          Tags (comma separated)
          <input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="javascript, backend" />
        </label>
        <label>
          Prize (optional)
          <input value={form.prize} onChange={(e) => update('prize', e.target.value)} placeholder="Rs 1,000 voucher" />
        </label>
      </div>
      <ErrorMessage error={error} />
      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Create contest'}
        </button>
      </div>
    </form>
  );
}
