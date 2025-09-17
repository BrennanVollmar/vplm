import { Link, useParams } from 'react-router-dom'
import NotesPanel from '../components/NotesPanel'
import MeasureForm from '../components/MeasureForm'
import CameraCapture from '../components/CameraCapture'
import ChemLookup from '../components/ChemLookup'
import { useEffect, useState } from 'react'
import type { ChemProduct } from '../types'
import PhotoGallery from '../components/PhotoGallery'
import Accordion from '../components/Accordion'
import PondsMap from '../components/PondsMap'
import WaterQualityForm from '../components/WaterQualityForm'
import TankMixForm from '../components/TankMixForm'
import SafetyChecklist from '../components/SafetyChecklist'
import TaskList from '../components/TaskList'
import JobTimePanel from '../components/JobTimePanel'
import JobEdit from '../components/JobEdit'
import ActionLog from '../components/ActionLog'

export default function JobPage() {
  const { jobId = '' } = useParams()
  const [selectedChem, setSelectedChem] = useState<ChemProduct | null>(null)

  return (
    <div className="grid">
      <JobHeader jobId={jobId} />
      <Accordion
        items={[
          { label: 'Time', accent: 'amber', startOpen: true, content: <div className="grid card"><JobTimePanel jobId={jobId} /></div> },
          { label: 'Ponds & Mapping', accent: 'cyan', content: <div className="grid card"><PondsMap jobId={jobId} /></div> },
          { label: 'Notes', accent: 'amber', content: <div className="grid card"><NotesPanel jobId={jobId} /></div> },
          { label: 'Measurements', accent: 'blue', content: <div className="grid card"><MeasureForm jobId={jobId} /></div> },
          { label: 'Tasks', accent: 'green', content: <div className="grid card"><TaskList jobId={jobId} /></div> },
          { label: 'Details', accent: 'purple', content: <div className="grid card"><JobEdit jobId={jobId} /></div> },
          { label: 'Activity Log', accent: 'amber', content: <div className="grid card"><ActionLog jobId={jobId} /></div> },
          { label: 'Photos', accent: 'purple', content: (
            <div className="grid card">
              <div className="row"><CameraCapture jobId={jobId} /></div>
              <PhotoGallery jobId={jobId} />
            </div>
          ) },
          { label: 'Calculators', accent: 'cyan', content: <div className="grid card"><CalcTab /></div> },
          { label: 'Tank Mix', accent: 'blue', content: <div className="grid card"><TankMixForm /></div> },
          { label: 'Water Quality', accent: 'green', content: <div className="grid card"><WaterQualityForm jobId={jobId} /></div> },
          { label: 'Safety', accent: 'amber', content: <div className="grid card"><SafetyChecklist jobId={jobId} /></div> },
          { label: 'Chemicals', accent: 'green', content: (
            <div className="grid card">
              <ChemLookup onSelect={setSelectedChem} />
              {selectedChem && (
                <div><strong>Selected:</strong> {selectedChem.brand} - {selectedChem.active}</div>
              )}
            </div>
          ) },
          { label: 'Summary', accent: 'purple', content: (
            <div className="grid card">
              <Link className="btn" to={`/job/${jobId}/summary`}>Open Job Summary</Link>
            </div>
          ) },
        ]}
      />
    </div>
  )
}

import { db } from '../features/offline/db'

function JobHeader({ jobId }: { jobId: string }) {
  const [meta, setMeta] = useState<any>(null)
  useEffect(() => {
    const load = async () => setMeta(await db.jobs.get(jobId))
    load()
  }, [jobId])
  return (
    <div className="card">
      <h2>Job: {meta?.clientName || jobId}</h2>
      <div style={{ color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {meta?.createdAt && <span>Created {new Date(meta.createdAt).toLocaleString()}</span>}
        {meta?.createdBy && <span style={{ marginLeft: 12 }}>by {meta.createdBy}</span>}
        {typeof meta?.lat === 'number' && typeof meta?.lon === 'number' && (
          <span style={{ marginLeft: 12 }}>
            (lat {meta.lat.toFixed(5)}, lon {meta.lon.toFixed(5)})
          </span>
        )}
        <WeatherWidget lat={meta?.lat} lon={meta?.lon} />
      </div>
    </div>
  )
}

import CalcPanel from '../components/CalcPanel'
import WeatherWidget from '../components/WeatherWidget'
function CalcTab() {
  return (
    <div>
      <CalcPanel />
    </div>
  )
}
