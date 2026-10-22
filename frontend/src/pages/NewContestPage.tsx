import { useNavigate } from 'react-router';
import { ContestForm } from '../components/ContestForm';

export function NewContestPage() {
  const navigate = useNavigate();
  return (
    <section className="card">
      <h2>New contest</h2>
      <p className="muted">Create the contest first, then add or generate questions on its page.</p>
      <ContestForm onSaved={(contest) => navigate(`/contests/${contest.id}`)} />
    </section>
  );
}
