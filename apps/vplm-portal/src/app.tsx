import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from './routes/index'
import JobPage from './routes/job'
import OfflinePage from './routes/offline'
import SyncBadge from './components/SyncBadge'
import JobSummaryPage from './routes/summary'
import SettingsPage from './routes/settings'
import ThemeToggle from './components/ThemeToggle'
import GlobalSearch from './components/GlobalSearch'

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const input = document.querySelector<HTMLInputElement>('header .search input')
        if (input) { e.preventDefault(); input.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div>
      <header className="app-header">
        <Link to="/" className="brand">VPLM Portal</Link>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/offline">Offline</NavLink>
          <NavLink to="/tools">Tools</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/help">Help</NavLink>
        </nav>
        <div className="header-actions">
          <GlobalSearch />
          <ThemeToggle />
          <SyncBadge />
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/job/:jobId" element={<JobPage />} />
          <Route path="/job/:jobId/summary" element={<JobSummaryPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/map" element={<AllJobsMap />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/calculators" element={<CalculatorsPage />} />
          <Route path="/fishery" element={<FisheryPage />} />
          <Route path="/chem-ref" element={<ChemRefPage />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/water-quality" element={<WaterQualityPage />} />
          <Route path="/acreage" element={<AcreageTools />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

function HelpPage() {
  return (
    <div className="grid">
      <section className="card">
        <h2>Help & Tips</h2>
        <ul className="list">
          <li>Use the search box in the header to quickly find jobs and notes.</li>
          <li>Offline mode shows your local data and lets you export/import.</li>
          <li>Field Mode increases control sizes for gloves-on use.</li>
          <li>Dark theme is available from the header toggle.</li>
          <li>GPS: use Map & GPS to track or outline sites.</li>
          <li>Tools consolidate Fishery, Chemical Reference, Time, Water, Acreage, and Profile.</li>
        </ul>
      </section>
    </div>
  )
}

import AllJobsMap from './routes/map'

function NotFoundPage() {
  return (
    <div className="grid">
      <section className="card">
        <h2>Page not found</h2>
        <p className="muted">The page you’re looking for doesn’t exist.</p>
        <Link className="btn" to="/">Back to Dashboard</Link>
      </section>
    </div>
  )
}

import FisheryPage from './routes/fishery'
import ChemRefPage from './routes/chem-ref'
import TimePage from './routes/time'
import WaterQualityPage from './routes/water-quality'
import AcreageTools from './routes/acreage'
import ProfilePage from './routes/profile'

function ToolsPage() {
  return (
    <div className="grid">
      <section className="card">
        <h2>Tools</h2>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn" to="/calculators">Calculators</Link>
          <Link className="btn" to="/fishery">Fishery Study</Link>
          <Link className="btn" to="/chem-ref">Chemical Reference</Link>
          <Link className="btn" to="/time">Time Tracking</Link>
          <Link className="btn" to="/water-quality">Water Quality</Link>
          <Link className="btn" to="/acreage">Acreage Tools</Link>
          <Link className="btn" to="/profile">Profile</Link>
          <Link className="btn warn" to="/reset">Reset App Cache</Link>
        </div>
      </section>
    </div>
  )
}

import ResetPage from './routes/reset'
import CalculatorsPage from './routes/calculators'
