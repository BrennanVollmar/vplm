const LEADING_PUNCTUATION = /^[.,!?;:]/
const SENTENCE_TERMINATOR = /[.!?]$/
const SENTENCE_BOUNDARY = /(^|[.!?]\s+)([a-z])/g

export function previewDictation(base: string, interim: string) {
  const addition = interim.trim()
  if (!addition) return base
  const needsSpace = base && !base.endsWith(' ') && !LEADING_PUNCTUATION.test(addition)
  return `${base}${needsSpace ? ' ' : ''}${addition}`
}

export function appendDictationSegment(base: string, segment: string) {
  const addition = segment.trim()
  if (!addition) return base
  const needsSpace = base && !base.endsWith(' ') && !LEADING_PUNCTUATION.test(addition)
  let next = `${base}${needsSpace ? ' ' : ''}${addition}`
  if (!SENTENCE_TERMINATOR.test(addition)) {
    next = `${next}.`
  }
  return capitalizeSentences(next)
}

function capitalizeSentences(text: string) {
  return text.replace(SENTENCE_BOUNDARY, (_match, prefix, char) => `${prefix}${char.toUpperCase()}`)
}
