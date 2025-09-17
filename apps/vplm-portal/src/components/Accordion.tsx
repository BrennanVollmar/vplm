import { useEffect, useId, useRef, useState } from 'react'

export interface AccordionItem {
  id?: string
  label: string
  content: React.ReactNode
  startOpen?: boolean
  accent?: 'green' | 'blue' | 'amber' | 'cyan' | 'purple'
}

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const base = useId()
  return (
    <div className="accordion">
      {items.map((it, idx) => (
        <Accord key={idx} base={base} index={idx} item={it} />
      ))}
    </div>
  )
}

function Accord({ base, index, item }: { base: string; index: number; item: AccordionItem }) {
  const [open, setOpen] = useState(Boolean(item.startOpen))
  const panelId = `${base}-panel-${index}`
  const btnId = `${base}-btn-${index}`
  const accent = item.accent ? `accent-${item.accent}` : 'accent-green'
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (open) {
      const el = panelRef.current
      // Defer to next frame so layout is updated
      requestAnimationFrame(() => {
        try { el?.dispatchEvent(new CustomEvent('accordion:open', { bubbles: true })) } catch {}
      })
    }
  }, [open])
  return (
    <section className={`accordion-item ${accent}`}>
      <button
        id={btnId}
        className="accordion-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{item.label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div ref={panelRef} id={panelId} role="region" aria-labelledby={btnId} hidden={!open} className="accordion-panel">
        {item.content}
      </div>
    </section>
  )
}
