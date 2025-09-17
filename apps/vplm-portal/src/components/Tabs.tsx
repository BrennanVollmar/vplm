import { useId, useState } from 'react'

export interface TabItem {
  id?: string
  label: string
  content: React.ReactNode
}

export default function Tabs({ items, initial = 0 }: { items: TabItem[]; initial?: number }) {
  const [active, setActive] = useState(initial)
  const base = useId()
  return (
    <div className="tabs">
      <div role="tablist" aria-label="Sections" className="tab-list">
        {items.map((t, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            id={`${base}-tab-${i}`}
            className="tab"
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.map((t, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="tab-panel"
        >
          {t.content}
        </div>
      ))}
    </div>
  )
}

