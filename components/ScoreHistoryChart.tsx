import type { ScoreHistoryEntry } from '@/lib/types'

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cpX = (prev.x + curr.x) / 2
    d.push(`C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`)
  }
  return d.join(' ')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ScoreHistoryChart({ history }: { history: ScoreHistoryEntry[] }) {
  if (history.length < 2) {
    return (
      <p className="text-xs text-[var(--muted-foreground)] italic">
        Noch nicht genug Daten für einen Verlauf — speichere das Projekt erneut um den Trend zu starten.
      </p>
    )
  }

  const vbW = 600
  const vbH = 120
  const pad = { top: 22, right: 16, bottom: 10, left: 16 }
  const plotW = vbW - pad.left - pad.right
  const plotH = vbH - pad.top - pad.bottom

  const n = history.length
  const pts = history.map((h, i) => ({
    x: pad.left + (i / (n - 1)) * plotW,
    y: pad.top + (1 - h.score / 100) * plotH,
    score: h.score,
    date: h.createdAt,
  }))

  const linePath = smoothPath(pts)

  const first = pts[0]
  const last = pts[pts.length - 1]

  const firstLabelAnchor = 'start'
  const lastLabelAnchor = 'end'
  const firstLabelX = first.x
  const lastLabelX = last.x

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      height={vbH}
      preserveAspectRatio="none"
      aria-label="Score-Verlauf"
    >
      {/* Y-axis guides */}
      {[0, 50, 100].map((v) => {
        const gy = pad.top + (1 - v / 100) * plotH
        return (
          <line
            key={v}
            x1={pad.left}
            y1={gy}
            x2={pad.left + plotW}
            y2={gy}
            stroke="#2d3748"
            strokeWidth={1}
            strokeDasharray={v === 50 ? '3,3' : '1,0'}
          />
        )
      })}

      {/* Smooth line */}
      <path
        d={linePath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Area fill under the line */}
      <path
        d={`${linePath} L ${last.x} ${pad.top + plotH} L ${first.x} ${pad.top + plotH} Z`}
        fill="#f59e0b"
        fillOpacity={0.08}
      />

      {/* Dots with tooltips */}
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r={4} fill="#f59e0b" stroke="#1a1f2e" strokeWidth={1.5} />
          <title>{`${formatDate(pt.date)}: ${pt.score}`}</title>
          {/* Larger invisible hit target */}
          <circle cx={pt.x} cy={pt.y} r={8} fill="transparent">
            <title>{`${formatDate(pt.date)}: ${pt.score}`}</title>
          </circle>
        </g>
      ))}

      {/* First score label */}
      <text
        x={firstLabelX}
        y={first.y - 7}
        textAnchor={firstLabelAnchor}
        fill="#f59e0b"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {first.score}
      </text>

      {/* Last score label (only if different position from first) */}
      {n > 1 && (
        <text
          x={lastLabelX}
          y={last.y - 7}
          textAnchor={lastLabelAnchor}
          fill="#f59e0b"
          fontSize={10}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {last.score}
        </text>
      )}
    </svg>
  )
}
