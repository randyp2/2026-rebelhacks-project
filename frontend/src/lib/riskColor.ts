/**
 * riskColor.ts
 *
 * Returns a hex color for a given risk score using a smooth multi-stop gradient.
 * Used by both the Three.js 3D floor meshes and the 2D CSS heatmap tiles
 * so the color mapping is always consistent.
 *
 * Gradient stops (score 0 → 30+):
 *   0   → emerald-500  #10b981
 *   10  → yellow-400   #facc15
 *   20  → orange-500   #f97316
 *   30+ → red-500      #ef4444
 */

type GradientStop = { t: number; r: number; g: number; b: number }

const STOPS: GradientStop[] = [
  { t: 0,    r: 16,  g: 185, b: 129 }, // emerald-500
  { t: 0.33, r: 250, g: 204, b: 21  }, // yellow-400
  { t: 0.66, r: 249, g: 115, b: 22  }, // orange-500
  { t: 1,    r: 239, g: 68,  b: 68  }, // red-500
]

/**
 * Returns a CSS hex color string interpolated across a green→yellow→orange→red
 * gradient for scores in the range [0, 30].  Scores above 30 clamp to red.
 */
export function getRiskHexColor(score: number): string {
  const t = Math.min(1, Math.max(0, score / 30))

  // Find the two bounding stops
  let lo = STOPS[0]
  let hi = STOPS[STOPS.length - 1]
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (t >= STOPS[i].t && t <= STOPS[i + 1].t) {
      lo = STOPS[i]
      hi = STOPS[i + 1]
      break
    }
  }

  // Normalise t within this segment
  const range = hi.t - lo.t
  const s = range === 0 ? 0 : (t - lo.t) / range

  const r = Math.round(lo.r + s * (hi.r - lo.r))
  const g = Math.round(lo.g + s * (hi.g - lo.g))
  const b = Math.round(lo.b + s * (hi.b - lo.b))

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}
