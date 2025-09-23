import { Link, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from './routes/index'
import JobPage from './routes/job'
import OfflinePage from './routes/offline'
import SyncBadge from './components/SyncBadge'
import JobSummaryPage from './routes/summary'
import SettingsPage from './routes/settings'
import GlobalSearch from './components/GlobalSearch'
import { useAuth } from './lib/auth'
import LoginPage from './routes/login'
import AdminPage from './routes/admin'
import FishRunSummary from './components/FishRunSummary'

export default function App() {
  const { user, logout } = useAuth()
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
          <NavLink to="/" end>Job Creation/Editing</NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/offline">Offline</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/help">Help</NavLink>
          {user?.role === 'developer' && <NavLink to="/admin">Developer</NavLink>}
        </nav>
        <div className="header-actions">
          <GlobalSearch />
          <SyncBadge />
          {user ? (
            <button className="btn secondary" onClick={logout}>Sign Out</button>
          ) : (
            <Link className="btn" to="/login">Sign In</Link>
          )}
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Guard><Dashboard /></Guard>} />
          <Route path="/job/:jobId" element={<Guard><JobPage /></Guard>} />
          <Route path="/job/:jobId/summary" element={<Guard><JobSummaryPage /></Guard>} />
          <Route path="/fish-run/:runId/summary" element={<Guard><FishRunSummaryWrapper /></Guard>} />
          <Route path="/offline" element={<Guard><OfflinePage /></Guard>} />
          <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
          <Route path="/help" element={<Guard><HelpPage /></Guard>} />
          <Route path="/map" element={<Guard><AllJobsMap /></Guard>} />
          <Route path="/calculators" element={<Guard><CalculatorsPage /></Guard>} />
          <Route path="/fishery" element={<Guard><FisheryPage /></Guard>} />
          <Route path="/chem-ref" element={<Guard><ChemRefPage /></Guard>} />
          <Route path="/time" element={<Guard><TimePage /></Guard>} />
          <Route path="/water-quality" element={<Guard><WaterQualityPage /></Guard>} />
          <Route path="/acreage" element={<Guard><AcreageTools /></Guard>} />
          <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
          <Route path="/admin" element={<Guard devOnly><AdminPage /></Guard>} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

function Guard({ children, devOnly }: { children: any; devOnly?: boolean }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (devOnly && user.role !== 'developer') return <Navigate to="/" replace />
  return children
}

function HelpPage() {
  const sections = [
    { key: 'help_jobs', title: 'Job Creation & Editing', defaultText: 'WHEN TO USE: Start a new project or visit.\n\nSTEPS:\n1) Enter Client, Site, Address (City/County/Zip optional).\n2) On site, capture device location (optional).\n3) Use Job page accordions: Time, Mapping, Notes, Photos, Measurements, Water, Safety, Chemicals, Summary.\n\nEXAMPLE:\nClient: Smith Ranch\nSite: North Pond\nAddress: 123 FM 100\nCity: Llano, County: Llano, Zip: 78643.' },
    { key: 'help_mapping', title: 'Mapping Tools', defaultText: 'WHEN TO USE: Outline pond boundaries, record depths, mark misc features.\n\nSTEPS:\n1) Draw polygons to outline ponds.\n2) Add depth points (ft) inside polygons.\n3) Add misc points (spillways, inlets).\n4) Use “Capture Map Snapshot” to save a screenshot into Photos.\n\nEXAMPLE:\nOutline main pond; record depth transects; mark spillway and inflow.' },
    { key: 'help_photos', title: 'Photos & Camera', defaultText: 'WHEN TO USE: Document site conditions and treatments.\n\nSTEPS:\n1) Use Camera to take photos; location is captured if permitted.\n2) Click any photo to open fullscreen; use arrows to navigate; Delete asks to confirm.\n3) Map snapshots appear here automatically.\n\nEXAMPLE:\nBefore/after shots of algae and water clarity.' },
    { key: 'help_voice', title: 'Notes & Voice', defaultText: 'WHEN TO USE: Hands‑free notes while working or driving.\n\nSTEPS:\n1) Dictate to append finalized text (no interim duplicates).\n2) Record Voice Memo; playback in list; Transcribe with Whisper (OpenAI key in Developer).\n3) Delete options ask to confirm to avoid mistakes.\n\nEXAMPLE:\nDictate patrol observations; record short memos between sites and transcribe later.' },
    { key: 'help_water', title: 'Water Quality', defaultText: 'WHEN TO USE: Log water metrics.\n\nSTEPS:\nAdd entries for secchi depth, pH, DO, temperature, alkalinity, hardness. Include units and depths as needed.\n\nEXAMPLE:\nDO 6.8 mg/L @ surface; Temp 82°F; Secchi 28 in.' },
    { key: 'help_export', title: 'Export & PDF', defaultText: 'WHEN TO USE: Share summaries or reports.\n\nSTEPS:\n1) Offline → Export PDFs (per job or fish run) → Open PDF view.\n2) Use browser Print → Save as PDF for a clean report.\n\nEXAMPLE:\nExport Smith Ranch – North Pond summary; export fish run itinerary.' },
  ]
  return (
    <div className="grid">
      <section className="card">
        <h2>Help & Examples</h2>
        <div className="accordion">
          {sections.map(sec => (
            <EditableHelp key={sec.key} storageKey={sec.key} title={sec.title} defaultText={sec.defaultText} />
          ))}
        </div>
      </section>
    </div>
  )
}

import { useEffect as useEffectH, useState as useStateH } from 'react'
function EditableHelp({ storageKey, title, defaultText }: { storageKey: string; title: string; defaultText: string }) {
  const [open, setOpen] = useStateH(false)
  const [text, setText] = useStateH('')
  useEffectH(() => { setText(localStorage.getItem(storageKey) || defaultText) }, [storageKey, defaultText])
  function save() { localStorage.setItem(storageKey, text); alert('Saved') }
  return (
    <section className="accordion-item accent-blue">
      <button className="accordion-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="accordion-panel">
          <textarea className="textarea" style={{ width: '100%', minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={save}>Save</button></div>
        </div>
      )}
    </section>
  )}

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

import { useParams as useParamsFR } from 'react-router-dom'
function FishRunSummaryWrapper() {
  const { runId = '' } = useParamsFR()
  return <FishRunSummary runId={runId} />
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
