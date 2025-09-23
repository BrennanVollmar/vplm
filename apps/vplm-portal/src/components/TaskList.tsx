import { useEffect, useState } from 'react'
import { addTask, getTasks, toggleTask, deleteTask, type JobTask, logJob, getActor } from '../features/offline/db'

export default function TaskList({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<JobTask[]>([])
  const [text, setText] = useState('')

  useEffect(() => { (async () => setItems(await getTasks(jobId)))() }, [jobId])

  async function add() {
    const t = text.trim()
    if (!t) return
    const item: JobTask = { id: crypto.randomUUID(), jobId, label: t, done: false, createdAt: new Date().toISOString() }
    await addTask(item)
    await logJob(jobId, 'task_add', `Added task: ${t}`, getActor())
    setText('')
    setItems(await getTasks(jobId))
  }

  async function toggle(id: string, done: boolean) {
    await toggleTask(id, done)
    await logJob(jobId, 'task_toggle', `Marked task ${done ? 'done' : 'open'}`, getActor())
    setItems(await getTasks(jobId))
  }

  return (
    <div className="grid">
      <div className="row">
        <input className="input" placeholder="Add task (e.g., applied chemical)" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" onClick={add}>Add</button>
      </div>
      {items.length === 0 ? <div className="muted">No tasks yet</div> : (
        <ul className="list">
            {items.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map((t) => (
              <li key={t.id}>
                <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
                  <label className="row" style={{ gap: 8 }}>
                    <input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
                    <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
                  </label>
                  <button className="btn warn" onClick={async () => { if (!confirm('Really delete this task?')) return; await deleteTask(t.id); await logJob(jobId, 'task_delete', 'Deleted a task', getActor()); setItems(await getTasks(jobId)) }}>Delete</button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
