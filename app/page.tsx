'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CRITERIA, calculateScore, getScoreColor } from '@/lib/criteria'
import type { ProjectWithScores, WeightsMap } from '@/lib/types'
import type { Status } from '@/lib/types'

const STATUS_COLORS: Record<Status, string> = {
  IDEA: '#6b7280',
  PLANNING: '#3b82f6',
  ACTIVE: '#f59e0b',
  PAUSED: '#ef4444',
  DONE: '#10b981',
}

const STATUS_LABELS: Record<Status, string> = {
  IDEA: 'Idee',
  PLANNING: 'Planung',
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  DONE: 'Fertig',
}

type SortOption = 'score_desc' | 'score_asc' | 'updated' | 'name'
type ViewMode = 'cards' | 'matrix'

function formatRelativeTime(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  if (diffHrs < 24) return `vor ${diffHrs} Std.`
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays} Tagen`
}

function getTop2Criteria(scores: Record<string, number>, weights: Record<string, number>) {
  const contributions = CRITERIA.map((c) => {
    const value = scores[c.id] ?? 0
    const rawScore = c.inverted ? 5 - value : value + 1
    const w = weights[c.id] ?? 1
    return { id: c.id, name: c.name, contribution: rawScore * w }
  })
  contributions.sort((a, b) => b.contribution - a.contribution)
  return contributions.slice(0, 2)
}

function ScoreBar({ score }: { score: number }) {
  const color = getScoreColor(score)
  const gradientFrom =
    color === 'green'
      ? '#22c55e'
      : color === 'amber'
      ? '#f59e0b'
      : '#3b82f6'
  const gradientTo =
    color === 'green'
      ? '#16a34a'
      : color === 'amber'
      ? '#d97706'
      : '#2563eb'

  return (
    <div className="w-full">
      <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  weights,
  onDelete,
}: {
  project: ProjectWithScores
  weights: WeightsMap
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const score = project.computedScore ?? 0
  const color = getScoreColor(score)
  const scoreMap: Record<string, number> = {}
  for (const s of project.scores) {
    scoreMap[s.criterionId] = s.value
  }
  const top2 = getTop2Criteria(scoreMap, weights)

  const scoreTextColor =
    color === 'green'
      ? 'text-green-400'
      : color === 'amber'
      ? 'text-amber-400'
      : 'text-blue-400'

  const borderColor =
    project.status === 'IDEA'
      ? 'border-l-gray-500'
      : project.status === 'PLANNING'
      ? 'border-l-blue-500'
      : project.status === 'ACTIVE'
      ? 'border-l-amber-500'
      : project.status === 'PAUSED'
      ? 'border-l-red-500'
      : 'border-l-emerald-500'

  const handleDelete = async () => {
    if (!confirm(`Projekt "${project.name}" wirklich löschen?`)) return
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDelete(project.id)
  }

  return (
    <div
      className={`rounded-lg border-l-4 ${borderColor} bg-[var(--card)] border border-[var(--card-border)] p-4 flex flex-col gap-3 hover:border-[var(--accent)] transition-colors`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--foreground)] leading-tight truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-[var(--muted-foreground)] truncate mt-0.5">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => router.push(`/projects/${project.id}/edit`)}
            className="p-1.5 rounded hover:bg-slate-700 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Bearbeiten"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-900/40 text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
            title="Löschen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: STATUS_COLORS[project.status] + '33',
            color: STATUS_COLORS[project.status],
          }}
        >
          {STATUS_LABELS[project.status]}
        </span>
        {project.category && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {project.category}
          </span>
        )}
      </div>

      {/* Score */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--muted-foreground)]">Score</span>
          <span className={`font-mono text-sm font-bold ${scoreTextColor}`}>{score}</span>
        </div>
        <ScoreBar score={score} />
        <div className="flex gap-1 mt-2 flex-wrap">
          {top2.map((c) => (
            <span
              key={c.id}
              className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
            >
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* Next step */}
      {project.nextStep && (
        <div className="text-xs text-[var(--muted-foreground)]">
          <span className="text-[var(--foreground)] font-medium">Nächster Schritt: </span>
          {project.nextStep}
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-[var(--muted-foreground)] pt-1 border-t border-[var(--card-border)]">
        {formatRelativeTime(project.updatedAt.toString())}
      </div>
    </div>
  )
}

function MatrixView({
  projects,
  weights,
}: {
  projects: ProjectWithScores[]
  weights: WeightsMap
}) {
  const width = 960
  const height = 600
  const padding = { top: 36, right: 40, bottom: 56, left: 56 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const effortCriteria = ['time', 'cost', 'material']
  const valueCriteria = ['impact', 'motivation', 'dependency']

  const points = projects.map((p) => {
    const scoreMap: Record<string, number> = {}
    for (const s of p.scores) {
      scoreMap[s.criterionId] = s.value
    }

    // Effort: inverted sum (higher raw value = more effort)
    const effortSum = effortCriteria.reduce((sum, id) => sum + (scoreMap[id] ?? 0), 0)
    const effortNorm = effortSum / (effortCriteria.length * 4)

    // Value: positive sum
    const valueSum = valueCriteria.reduce((sum, id) => sum + (scoreMap[id] ?? 0), 0)
    const valueNorm = valueSum / (valueCriteria.length * 4)

    return { project: p, effortNorm, valueNorm }
  })

  // Normalize to 0–1 across actual range
  const efforts = points.map((pt) => pt.effortNorm)
  const values = points.map((pt) => pt.valueNorm)
  const minE = Math.min(...efforts, 0)
  const maxE = Math.max(...efforts, 1)
  const minV = Math.min(...values, 0)
  const maxV = Math.max(...values, 1)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        className="block w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'var(--card)', borderRadius: 8 }}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Quadrant backgrounds */}
          <rect x={0} y={0} width={plotW / 2} height={plotH / 2} fill="rgba(59,130,246,0.04)" />
          <rect x={plotW / 2} y={0} width={plotW / 2} height={plotH / 2} fill="rgba(245,158,11,0.04)" />
          <rect x={0} y={plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(34,197,94,0.04)" />
          <rect x={plotW / 2} y={plotH / 2} width={plotW / 2} height={plotH / 2} fill="rgba(239,68,68,0.04)" />

          {/* Center dashed lines */}
          <line
            x1={plotW / 2} y1={0} x2={plotW / 2} y2={plotH}
            stroke="#4a5568" strokeWidth={1} strokeDasharray="4,4"
          />
          <line
            x1={0} y1={plotH / 2} x2={plotW} y2={plotH / 2}
            stroke="#4a5568" strokeWidth={1} strokeDasharray="4,4"
          />

          {/* Quadrant labels */}
          <text x={8} y={16} fill="#3b82f6" fontSize={11} opacity={0.8}>Quick Wins ⚡</text>
          <text x={plotW / 2 + 8} y={16} fill="#f59e0b" fontSize={11} opacity={0.8}>Große Projekte 🏗️</text>
          <text x={8} y={plotH - 8} fill="#22c55e" fontSize={11} opacity={0.8}>Füllen 🌱</text>
          <text x={plotW / 2 + 8} y={plotH - 8} fill="#ef4444" fontSize={11} opacity={0.8}>Überdenken ⚠️</text>

          {/* Axes */}
          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#4a5568" strokeWidth={1} />
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="#4a5568" strokeWidth={1} />
          <text x={plotW / 2} y={plotH + 36} textAnchor="middle" fill="#718096" fontSize={11}>
            Aufwand →
          </text>
          <text
            x={-plotH / 2}
            y={-36}
            textAnchor="middle"
            fill="#718096"
            fontSize={11}
            transform="rotate(-90)"
          >
            Wert ↑
          </text>

          {/* Data points */}
          {points.map(({ project, effortNorm, valueNorm }) => {
            const rangeE = maxE - minE || 1
            const rangeV = maxV - minV || 1
            const cx = ((effortNorm - minE) / rangeE) * plotW
            const cy = plotH - ((valueNorm - minV) / rangeV) * plotH
            const color = STATUS_COLORS[project.status]

            return (
              <g key={project.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill={color}
                  fillOpacity={0.8}
                  stroke={color}
                  strokeWidth={2}
                />
                <text
                  x={cx + 11}
                  y={cy + 4}
                  fill="#e2e8f0"
                  fontSize={10}
                  style={{ userSelect: 'none' }}
                >
                  {project.name.length > 18 ? project.name.slice(0, 17) + '…' : project.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectWithScores[]>([])
  const [weights, setWeights] = useState<WeightsMap>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<SortOption>('score_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ]).then(([projectsData, settingsData]) => {
      setProjects(projectsData)
      setWeights(settingsData.weights || {})
      setLoading(false)
    })
  }, [])

  const categories = useMemo(() => {
    const cats = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[]
    return cats.sort()
  }, [projects])

  const filtered = useMemo(() => {
    let result = [...projects]
    if (statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter)
    }
    if (categoryFilter !== 'ALL') {
      result = result.filter((p) => p.category === categoryFilter)
    }
    switch (sort) {
      case 'score_desc':
        result.sort((a, b) => (b.computedScore ?? 0) - (a.computedScore ?? 0))
        break
      case 'score_asc':
        result.sort((a, b) => (a.computedScore ?? 0) - (b.computedScore ?? 0))
        break
      case 'updated':
        result.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        break
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
    }
    return result
  }, [projects, statusFilter, categoryFilter, sort])

  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  const handleExportCSV = () => {
    const rows = projects
      .filter((p) => p.status !== 'DONE')
      .map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        STATUS_LABELS[p.status],
        p.category ?? '',
        p.computedScore ?? 0,
        `"${(p.nextStep ?? '').replace(/"/g, '""')}"`,
        new Date(p.createdAt).toLocaleDateString('de-AT'),
        new Date(p.updatedAt).toLocaleDateString('de-AT'),
      ])

    const header = ['Name', 'Status', 'Kategorie', 'Score', 'Nächster Schritt', 'Erstellt', 'Aktualisiert']
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projekt-prio-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-[var(--muted-foreground)] animate-pulse">Lade Projekte…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
              Projekt Prio
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              {projects.length} Projekt{projects.length !== 1 ? 'e' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="p-2 rounded-lg hover:bg-slate-700 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="Einstellungen"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
            <Link
              href="/projects/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              style={{ background: 'var(--accent)', color: '#0f1117' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Neues Projekt
            </Link>
          </div>
        </div>

        {/* Filter & Controls Bar */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'IDEA', 'PLANNING', 'ACTIVE', 'PAUSED', 'DONE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors border ${
                  statusFilter === s
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                    : 'border-[var(--card-border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                }`}
              >
                {s === 'ALL' ? 'Alle' : STATUS_LABELS[s as Status]}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto items-center">
            {/* Category dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Sort dropdown */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="score_desc">Score ↓</option>
              <option value="score_asc">Score ↑</option>
              <option value="updated">Zuletzt geändert</option>
              <option value="name">Name</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[var(--card-border)]">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Karten
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  viewMode === 'matrix'
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Matrix
              </button>
            </div>

            {/* CSV export */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
              title="Als CSV exportieren"
            >
              CSV Export
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'cards' ? (
          filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--muted-foreground)]">
              <div className="text-4xl mb-4">📋</div>
              <p>Keine Projekte gefunden.</p>
              <Link href="/projects/new" className="text-[var(--accent)] hover:underline mt-2 inline-block">
                Erstes Projekt anlegen →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  weights={weights}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        ) : (
          <div className="rounded-lg border border-[var(--card-border)] p-4" style={{ background: 'var(--card)' }}>
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] mb-4 uppercase tracking-wider">
              Aufwand vs. Wert Matrix
            </h2>
            <MatrixView projects={filtered} weights={weights} />
            <div className="flex flex-wrap gap-3 mt-4">
              {(Object.keys(STATUS_COLORS) as Status[]).map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <div className="w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                  {STATUS_LABELS[s]}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
