import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { useAuth } from '../auth';
import { AccessBadge, Badge, StatusBadge } from '../components/Badge';
import { ContestForm } from '../components/ContestForm';
import { GeneratePanel } from '../components/GeneratePanel';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { ErrorMessage, Loading, Message } from '../components/Message';
import { QuestionEditor } from '../components/QuestionEditor';
import { QuestionForm } from '../components/QuestionForm';
import { ResultView } from '../components/ResultView';
import { fmtDate, plural, typeLabel } from '../format';
import { useLoad } from '../hooks/useLoad';
import type {
  Answer,
  ContestDetail,
  ContestResult,
  FinalizeResult,
  Leaderboard,
  Question,
  SubmitResult,
} from '../types';

export function ContestPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const detail = useLoad(() => api.get<ContestDetail>(`/contests/${id}`), [id, user?.id]);
  const contest = detail.data;
  const isAdmin = user?.role === 'admin';
  const joined = !!contest?.my_participation;
  const submitted = !!contest?.my_participation?.submitted_at;
  const canSeeQuestions = !!user && !!contest && (isAdmin || joined);

  const questions = useLoad(
    () =>
      canSeeQuestions
        ? api.get<{ questions: Question[] }>(`/contests/${id}/questions`).then((r) => r.questions)
        : Promise.resolve<Question[]>([]),
    [id, canSeeQuestions, user?.id],
  );
  const board = useLoad(() => api.get<Leaderboard>(`/contests/${id}/leaderboard?pageSize=20`), [id, user?.id]);
  const result = useLoad(
    () => (submitted ? api.get<ContestResult>(`/contests/${id}/result`) : Promise.resolve(null)),
    [id, submitted],
  );

  const [actionError, setActionError] = useState<unknown>(null);
  const [lastSubmit, setLastSubmit] = useState<SubmitResult | null>(null);
  const [finalized, setFinalized] = useState<FinalizeResult | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  async function join() {
    setActionError(null);
    try {
      await api.post(`/contests/${id}/join`);
      await detail.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  async function submit(answers: Answer[]) {
    const res = await api.post<SubmitResult>(`/contests/${id}/submit`, { answers });
    setLastSubmit(res);
    await Promise.all([detail.reload(), board.reload()]);
  }

  async function finalize() {
    setActionError(null);
    try {
      setFinalized(await api.post<FinalizeResult>(`/contests/${id}/finalize`));
      await Promise.all([detail.reload(), board.reload()]);
    } catch (err) {
      setActionError(err);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this contest with all its questions and submissions?')) return;
    try {
      await api.delete(`/contests/${id}`);
      navigate('/');
    } catch (err) {
      setActionError(err);
    }
  }

  if (detail.loading && !contest) return <Loading what="Loading contest" />;
  if (detail.error) return <ErrorMessage error={detail.error} />;
  if (!contest) return null;

  const winner = board.data?.items.find((r) => r.user_id === contest.winner_user_id);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>{contest.name}</h2>
          <StatusBadge status={contest.status} />
        </div>
        <p>{contest.description}</p>
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
          <div>
            <dt>Questions</dt>
            <dd>{contest.question_count}</dd>
          </div>
          <div>
            <dt>Participants</dt>
            <dd>{contest.participant_count}</dd>
          </div>
        </dl>
        {contest.finalized_at && (
          <Message kind="success">
            Finished.{' '}
            {winner ? `Winner: ${winner.name} with ${plural(winner.score, 'point')}` : 'No winner, nobody submitted.'}
            {contest.prize && winner && ` Prize: ${contest.prize}.`}
          </Message>
        )}
      </section>

      <section className="card">
        <h3>Your participation</h3>
        <ErrorMessage error={actionError} />
        <Participation
          contest={contest}
          joined={joined}
          submitted={submitted}
          signedIn={!!user}
          questions={questions.data ?? []}
          questionsLoading={questions.loading}
          result={result.data}
          lastSubmit={lastSubmit}
          onJoin={join}
          onSubmit={submit}
        />
      </section>

      <section className="card">
        <h3>Leaderboard</h3>
        {board.loading && <Loading />}
        <ErrorMessage error={board.error} />
        {board.data && <LeaderboardTable rows={board.data.items} me={board.data.me} />}
      </section>

      {isAdmin && (
        <section className="card admin">
          <div className="card-head">
            <h3>Admin tools</h3>
            <button type="button" className="secondary" onClick={() => setShowAdmin((v) => !v)}>
              {showAdmin ? 'Hide' : 'Show'}
            </button>
          </div>
          {showAdmin && (
            <div className="stack">
              <details open>
                <summary>Edit contest</summary>
                <ContestForm initial={contest} onSaved={() => detail.reload()} />
              </details>
              <details>
                <summary>Questions ({questions.data?.length ?? 0}) with answers</summary>
                {questions.data?.length ? (
                  <ol className="admin-questions">
                    {questions.data.map((q) => (
                      <li key={q.id}>
                        <span className="muted small">
                          {typeLabel[q.type]} · {plural(q.points, 'point')}
                        </span>
                        <div>{q.text}</div>
                        <div className="muted small">
                          Options: {q.options.join(' | ')}. Correct: {q.correct_answers?.join(', ')}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">No questions yet.</p>
                )}
              </details>
              <details>
                <summary>Add a question</summary>
                <QuestionEditor contestId={id} onAdded={() => Promise.all([questions.reload(), detail.reload()])} />
              </details>
              <details>
                <summary>Generate questions with AI</summary>
                <GeneratePanel contestId={id} onSaved={() => Promise.all([questions.reload(), detail.reload()])} />
              </details>
              <div className="actions">
                <button type="button" className="danger" onClick={remove}>
                  Delete contest
                </button>
                <button
                  type="button"
                  onClick={finalize}
                  disabled={contest.status !== 'ended' || !!contest.finalized_at}
                  title={
                    contest.finalized_at
                      ? 'Already finalized'
                      : contest.status !== 'ended'
                        ? 'Available once the contest has ended; the worker also does this automatically'
                        : ''
                  }
                >
                  Finalize and award prize
                </button>
              </div>
              {finalized && (
                <Message kind="success">
                  Finalized.{' '}
                  {finalized.winnerUserId
                    ? `Prize ${finalized.prize ?? '(none)'} awarded.`
                    : 'No submissions, no winner.'}
                </Message>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

interface ParticipationProps {
  contest: ContestDetail;
  joined: boolean;
  submitted: boolean;
  signedIn: boolean;
  questions: Question[];
  questionsLoading: boolean;
  result: ContestResult | null;
  lastSubmit: SubmitResult | null;
  onJoin(): Promise<void>;
  onSubmit(answers: Answer[]): Promise<void>;
}

function Participation(p: ParticipationProps) {
  if (!p.signedIn) {
    return (
      <p>
        <Link to={`/login?next=/contests/${p.contest.id}`}>Sign in</Link> or{' '}
        <Link to={`/register?next=/contests/${p.contest.id}`}>register</Link> to join this contest.
      </p>
    );
  }
  if (p.submitted) {
    return (
      <div className="stack">
        {p.lastSubmit && (
          <Message kind="success">
            Submitted! You scored {p.lastSubmit.score} of {p.lastSubmit.maxScore} ({p.lastSubmit.correctCount} of{' '}
            {p.lastSubmit.totalQuestions} correct) and are currently ranked #{p.lastSubmit.rank}.
          </Message>
        )}
        {p.result ? <ResultView result={p.result} /> : <Loading what="Loading your result" />}
      </div>
    );
  }
  if (p.joined) {
    if (p.contest.status === 'ended') {
      return <Message>You joined this contest but did not submit before it ended.</Message>;
    }
    if (p.questionsLoading) return <Loading what="Loading questions" />;
    if (!p.questions.length) return <Message>This contest has no questions yet. Check back soon.</Message>;
    return (
      <div className="stack">
        <Message>
          You joined on {fmtDate(p.contest.my_participation!.joined_at)}. Answer the{' '}
          {plural(p.questions.length, 'question')} below and submit once; the contest closes{' '}
          {fmtDate(p.contest.end_time)}.
        </Message>
        <QuestionForm questions={p.questions} onSubmit={p.onSubmit} />
      </div>
    );
  }
  if (p.contest.status === 'upcoming') return <Message>Joining opens when the contest starts.</Message>;
  if (p.contest.status === 'ended') return <Message>This contest has ended.</Message>;
  if (!p.contest.can_participate) {
    return <Message>This contest is for VIP members only. An admin can upgrade your account.</Message>;
  }
  return (
    <div className="actions start">
      <button type="button" onClick={p.onJoin}>
        Join this contest
      </button>
      <span className="muted">
        {plural(p.contest.question_count, 'question')}, {p.contest.prize ? `prize: ${p.contest.prize}` : 'no prize'}
      </span>
    </div>
  );
}
