import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { typeLabel } from '../format';
import type { QuestionType } from '../types';
import { ErrorMessage, Message } from './Message';

interface Props {
  contestId: string;
  onAdded(): void;
}

const types: QuestionType[] = ['single-select', 'multi-select', 'true-false'];

export function QuestionEditor({ contestId, onAdded }: Props) {
  const [type, setType] = useState<QuestionType>('single-select');
  const [text, setText] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [correct, setCorrect] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);

  const options =
    type === 'true-false'
      ? ['True', 'False']
      : optionsText
          .split('\n')
          .map((o) => o.trim())
          .filter(Boolean);

  function changeType(next: QuestionType) {
    setType(next);
    setCorrect([]);
  }

  function toggleCorrect(option: string) {
    setCorrect((prev) => {
      if (type !== 'multi-select') return [option];
      return prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option];
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.post(`/contests/${contestId}/questions`, {
        questions: [{ type, text, options, correct_answers: correct, explanation: explanation.trim() || null, points }],
      });
      setText('');
      setOptionsText('');
      setCorrect([]);
      setExplanation('');
      setSaved(true);
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="row">
        <label>
          Type
          <select value={type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Points
          <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
        </label>
      </div>
      <label>
        Question
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} required minLength={5} />
      </label>
      {type !== 'true-false' && (
        <label>
          Options, one per line (2 to 6)
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} required />
        </label>
      )}
      <fieldset className="inline-options">
        <legend>Correct {type === 'multi-select' ? 'answers' : 'answer'}</legend>
        {options.length === 0 && <span className="muted">Add options first</span>}
        {options.map((option) => (
          <label key={option} className="option small">
            <input
              type={type === 'multi-select' ? 'checkbox' : 'radio'}
              name="correct"
              checked={correct.includes(option)}
              onChange={() => toggleCorrect(option)}
            />
            {option}
          </label>
        ))}
      </fieldset>
      <label>
        Explanation (optional, shown after submitting)
        <input value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </label>
      <ErrorMessage error={error} />
      {saved && <Message kind="success">Question added.</Message>}
      <div className="actions">
        <button type="submit" disabled={busy || correct.length === 0}>
          {busy ? 'Adding…' : 'Add question'}
        </button>
      </div>
    </form>
  );
}
