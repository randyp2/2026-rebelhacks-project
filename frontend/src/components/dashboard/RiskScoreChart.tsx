// TODO: Implement RiskScoreChart
// Time-series line chart of risk score history for a selected room using Recharts.
//
// Props:
//   - roomId: string — room to display
//   - data: Array<{ timestamp: string; risk_score: number }> — historical scores
//
// Behavior:
//   - X-axis: time (hour:minute)
//   - Y-axis: risk score (0–max)
//   - Draw a red dashed reference line at the alert threshold (e.g. 15)
//   - Use Recharts <LineChart>, <Line>, <XAxis>, <YAxis>, <Tooltip>, <ReferenceLine>
//   - Show a loading skeleton when data is empty
//
// Note: recharts must be installed — run: pnpm add recharts

type RiskDataPoint = {
  timestamp: string
  risk_score: number
}

type RiskScoreChartProps = {
  roomId: string
  data: RiskDataPoint[]
}

export default function RiskScoreChart(_props: RiskScoreChartProps) {
  // TODO: implement
  return null
}
