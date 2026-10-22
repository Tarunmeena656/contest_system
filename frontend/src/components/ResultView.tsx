import { fmtDate, plural } from '../format';
import type { ContestResult } from '../types';

export function ResultView({ result }: { result: ContestResult }) {
  const max = result.answers.reduce((sum, a) => sum + a.points, 0);
  const correct = result.answers.filter((a) => a.is_correct).length;

  return (
    <div>
      <p className="score">
        Your score: <strong>{result.participation.score ?? 0}</strong> / {max} · {correct} of {result.answers.length}{' '}
        correct · submitted {fmtDate(result.participation.submitted_at ?? result.participation.joined_at)}
      </p>
      {result.answers.map((answer, index) => (
        <div key={answer.question_id} className={`question review ${answer.is_correct ? 'correct' : 'wrong'}`}>
          <p>
            <span className="muted small">
              Q{index + 1} · {plural(answer.points, 'point')} · {answer.is_correct ? 'correct' : 'wrong'}
            </span>
            <span className="question-text">{answer.text}</span>
          </p>
          <ul className="options-review">
            {answer.options.map((option) => {
              const chosen = answer.selected.includes(option);
              const right = answer.correct_answers.includes(option);
              return (
                <li key={option} className={right ? 'right' : chosen ? 'chosen-wrong' : ''}>
                  {option}
                  {right && ' ✓'}
                  {chosen && !right && ' ✗'}
                  {chosen && <span className="muted small"> (your answer)</span>}
                </li>
              );
            })}
          </ul>
          {answer.explanation && <p className="muted">{answer.explanation}</p>}
        </div>
      ))}
    </div>
  );
}
