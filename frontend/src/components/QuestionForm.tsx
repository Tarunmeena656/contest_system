import { useState, type FormEvent } from 'react';
import { plural, typeLabel } from '../format';
import type { Answer, Question } from '../types';
import { ErrorMessage } from './Message';

interface Props {
  questions: Question[];
  onSubmit(answers: Answer[]): Promise<void>;
}

export function QuestionForm({ questions, onSubmit }: Props) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function choose(question: Question, option: string, checked: boolean) {
    setPicked((prev) => {
      if (question.type !== 'multi-select') return { ...prev, [question.id]: [option] };
      const current = prev[question.id] ?? [];
      return { ...prev, [question.id]: checked ? [...current, option] : current.filter((o) => o !== option) };
    });
  }

  const answered = Object.values(picked).filter((s) => s.length > 0).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      answered < questions.length &&
      !window.confirm(
        `You answered ${answered} of ${questions.length} questions. Submit anyway? Answers cannot be changed later.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const answers = Object.entries(picked)
        .filter(([, selected]) => selected.length > 0)
        .map(([questionId, selected]) => ({ questionId, selected }));
      await onSubmit(answers);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="question-form">
      {questions.map((question, index) => (
        <fieldset key={question.id} className="question">
          <legend>
            <span className="muted small">
              Q{index + 1} · {typeLabel[question.type]} · {plural(question.points, 'point')}
            </span>
            <span className="question-text">{question.text}</span>
          </legend>
          {question.options.map((option) => {
            const selected = picked[question.id]?.includes(option) ?? false;
            return (
              <label key={option} className={`option${selected ? ' selected' : ''}`}>
                <input
                  type={question.type === 'multi-select' ? 'checkbox' : 'radio'}
                  name={question.id}
                  checked={selected}
                  onChange={(e) => choose(question, option, e.target.checked)}
                />
                {option}
              </label>
            );
          })}
        </fieldset>
      ))}
      <ErrorMessage error={error} />
      <div className="actions">
        <span className="muted">
          {answered} of {questions.length} answered
        </span>
        <button type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit answers'}
        </button>
      </div>
    </form>
  );
}
