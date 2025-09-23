import { useEffect, useRef, useState } from 'react'
import type { AddressSuggestion } from '../lib/places'
import { fetchAddressSuggestions } from '../lib/places'

type AddressAutocompleteProps = {
  id?: string
  label?: string
  value: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
  helpText?: string
  onChange: (value: string) => void
  onSelect?: (suggestion: AddressSuggestion) => void
  onEnter?: () => void
}

export default function AddressAutocomplete({
  id,
  label,
  value,
  placeholder,
  required,
  disabled,
  autoFocus,
  helpText,
  onChange,
  onSelect,
  onEnter,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fetchTokenRef = useRef(0)
  const cacheRef = useRef<Map<string, { ts: number; data: AddressSuggestion[] }>>(new Map())
  const skipFetchRef = useRef(false)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const query = value.trim()
    if (!query) {
      setSuggestions([])
      setOpen(false)
      return
    }
    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }
    if (query.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const normalized = query.toLowerCase()
    const cached = cacheRef.current.get(normalized)
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      setSuggestions(cached.data)
      setOpen(cached.data.length > 0)
      setActiveIndex(cached.data.length > 0 ? 0 : -1)
      setLoading(false)
      return
    }
    const token = ++fetchTokenRef.current
    setLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const result = await fetchAddressSuggestions(query)
        if (fetchTokenRef.current === token) {
          setSuggestions(result)
          setOpen(result.length > 0)
          setActiveIndex(result.length > 0 ? 0 : -1)
          cacheRef.current.set(normalized, { ts: Date.now(), data: result })
        }
      } finally {
        if (fetchTokenRef.current === token) setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timeout)
  }, [value])

  function handleSelect(suggestion: AddressSuggestion) {
    onChange(suggestion.label)
    onSelect?.(suggestion)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    skipFetchRef.current = true
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault()
        handleSelect(suggestions[activeIndex])
      } else if (onEnter) {
        event.preventDefault()
        onEnter()
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="autocomplete">
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
          {required ? <span aria-hidden style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span> : null}
        </label>
      ) : null}
      <div className="autocomplete__control">
        <input
          id={id}
          className="input"
          autoFocus={autoFocus}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="autocomplete__spinner" aria-hidden />}
      </div>
      {helpText && <small className="muted">{helpText}</small>}
      {open && suggestions.length > 0 && (
        <ul className="autocomplete__list" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'active' : ''}
              onMouseDown={(event) => {
                event.preventDefault()
                handleSelect(suggestion)
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <strong>{suggestion.addressLine}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{suggestion.label}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
