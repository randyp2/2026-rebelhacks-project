type BreakdownPayload = {
  raw?: Record<string, number>
  weights?: Record<string, number>
  normalized?: Record<string, number>
  thresholds?: Record<string, number>
  window_days?: number
  window_minutes?: number
}

export type ParsedAlertExplanation = {
  summary: string
  details: string[]
  hasBreakdown: boolean
}

const BREAKDOWN_MARKER = "breakdown="
const MAX_SIGNAL_LINES = 4
const GENERIC_SYNTHETIC_EXPLANATION = "high room risk score from aggregated heatmap signals"

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  let depth = 0

  for (let i = start; i < text.length; i += 1) {
    const char = text[i]
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

function normalizeSentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (!trimmed) return ""
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed
}

function stripIdentifiers(text: string): string {
  return text
    .replace(/\bperson_id=[a-f0-9-]+/gi, "")
    .replace(/\broom_id=[^\s.]+/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim()
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatScore(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatCount(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a"
  if (Number.isInteger(value)) return value.toLocaleString()
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1)
}

function buildSignalLines(breakdown: BreakdownPayload): string[] {
  const normalized = breakdown.normalized ?? {}
  const weights = breakdown.weights ?? {}
  const raw = breakdown.raw ?? {}
  const keys = Object.keys(normalized)

  if (keys.length === 0) {
    const rawKeys = Object.keys(raw)
    return rawKeys.map((key) => `${humanizeKey(key)}: ${formatCount(raw[key])}`)
  }

  const sortedKeys = [...keys].sort((left, right) => {
    const leftValue = normalized[left] ?? 0
    const rightValue = normalized[right] ?? 0
    return rightValue - leftValue
  })

  const lines = sortedKeys.map((key) => {
    const parts = [`${humanizeKey(key)}: ${formatScore(normalized[key])}`]
    if (weights[key] !== undefined) parts.push(`w ${formatScore(weights[key])}`)
    if (raw[key] !== undefined) parts.push(`raw ${formatCount(raw[key])}`)
    return parts.join(" | ")
  })

  if (lines.length <= MAX_SIGNAL_LINES) return lines

  const truncated = lines.slice(0, MAX_SIGNAL_LINES)
  truncated.push(`More signals: ${lines.length - MAX_SIGNAL_LINES} additional`)
  return truncated
}

function buildThresholdLine(breakdown: BreakdownPayload): string | null {
  const thresholds = breakdown.thresholds
  if (!thresholds || Object.keys(thresholds).length === 0) return null

  const pairs = Object.entries(thresholds).map(([key, value]) => {
    return `${humanizeKey(key)} ${formatScore(value)}`
  })

  return `Thresholds: ${pairs.join(", ")}`
}

function buildWindowLine(breakdown: BreakdownPayload): string | null {
  if (breakdown.window_days !== undefined) {
    const days = breakdown.window_days
    if (Number.isNaN(days)) return null
    return `Window: ${days} day${days === 1 ? "" : "s"}`
  }

  if (breakdown.window_minutes !== undefined) {
    const minutes = breakdown.window_minutes
    if (Number.isNaN(minutes)) return null
    if (minutes % 1440 === 0) {
      const days = minutes / 1440
      return `Window: ${minutes} min (${days} day${days === 1 ? "" : "s"})`
    }
    if (minutes % 60 === 0) {
      const hours = minutes / 60
      return `Window: ${minutes} min (${hours}h)`
    }
    return `Window: ${minutes} min`
  }

  return null
}

export function parseAlertExplanation(explanation: string | null): ParsedAlertExplanation {
  if (!explanation || explanation.trim().length === 0) {
    return { summary: "No explanation provided", details: [], hasBreakdown: false }
  }

  const breakdownIndex = explanation.indexOf(BREAKDOWN_MARKER)
  if (breakdownIndex === -1) {
    const cleaned = normalizeSentence(stripIdentifiers(explanation))
    if (cleaned.toLowerCase() === GENERIC_SYNTHETIC_EXPLANATION) {
      return {
        summary: "No explicit alert details available",
        details: [],
        hasBreakdown: false,
      }
    }
    return {
      summary: cleaned.length > 0 ? cleaned : "Alert triggered",
      details: [],
      hasBreakdown: false,
    }
  }

  const preamble = explanation.slice(0, breakdownIndex).trim()
  const jsonText = explanation.slice(breakdownIndex + BREAKDOWN_MARKER.length).trim()
  const jsonPayload = extractJsonObject(jsonText)
  const summaryText = normalizeSentence(stripIdentifiers(preamble))

  if (!jsonPayload) {
    return {
      summary: summaryText.length > 0 ? summaryText : "Alert triggered",
      details: [],
      hasBreakdown: false,
    }
  }

  try {
    const breakdown = JSON.parse(jsonPayload) as BreakdownPayload
    const details = buildSignalLines(breakdown)
    const thresholdLine = buildThresholdLine(breakdown)
    if (thresholdLine) details.push(thresholdLine)
    const windowLine = buildWindowLine(breakdown)
    if (windowLine) details.push(windowLine)

    const summaryIsThreshold =
      summaryText.length === 0 ||
      /threshold crossed|risk threshold|room risk threshold/i.test(summaryText)

    if (summaryIsThreshold && details.length > 0) {
      const [first, ...rest] = details
      return {
        summary: first,
        details: rest,
        hasBreakdown: true,
      }
    }

    return {
      summary: summaryText.length > 0 ? summaryText : "Alert triggered",
      details,
      hasBreakdown: true,
    }
  } catch {
    return {
      summary: summaryText.length > 0 ? summaryText : "Alert triggered",
      details: [],
      hasBreakdown: false,
    }
  }
}
