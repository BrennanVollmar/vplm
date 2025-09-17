import { useParams, Link, useNavigate } from 'react-router-dom'
import JobSummary from '../components/JobSummary'

export default function JobSummaryPage() {
  const navigate = useNavigate()
  const { jobId = '' } = useParams()
  return (
    <div className="grid">
      <div className="row">
        {jobId ? (
          <Link to={`/job/${jobId}`} className="btn secondary">Back to Job</Link>
        ) : (
          <button className="btn secondary" onClick={() => navigate(-1)}>Back</button>
        )}
      </div>
      <section className="card">
        <h2>Job Summary</h2>
        <JobSummary jobId={jobId} />
      </section>
    </div>
  )
}
