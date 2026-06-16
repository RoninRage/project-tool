'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getScoreColor, getProgressValue } from '@/lib/criteria'
import type { ProjectWithScores } from '@/lib/types'
import type { Status } from '@/lib/types'

const STATUS_LABELS: Record<Status, string> = {
  IDEA: 'Idee',
  PLANNING: 'Planung',
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  DONE: 'Fertig',
}

const STATUS_COLORS: Record<Status, string> = {
  IDEA: '#6b7280',
  PLANNING: '#3b82f6',
  ACTIVE: '#f59e0b',
  PAUSED: '#ef4444',
  DONE: '#10b981',
}

function formatRelativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays} Tagen`
}

type Decision = 'kept' | 'paused' | 'archived' | 'skipped'

interface ReviewResult {
  projectId: string
  decision: Decision
}

export default function ReviewPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectWithScores[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<ReviewResult[]>([])
  const [acting, setActing] = useState(false)
  const [done, setDone] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [assessment, setAssessment] = useState<string | null>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const assessmentRequestIdRef = useRef(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/roulette/available').then((r) => r.json()),
    ]).then(([data, aiData]: [ProjectWithScores[], { available: boolean }]) => {
      const queue = data
        .filter((p) => p.status !== 'DONE')
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      setProjects(queue)
      setLoading(false)
      if (queue.length === 0) setDone(true)
      setAiAvailable(aiData.available === true)
    })
  }, [])

  const advance = (result: ReviewResult) => {
    assessmentRequestIdRef.current += 1
    const next = [...results, result]
    setResults(next)
    setAssessment(null)
    setAssessmentLoading(false)
    if (index + 1 >= projects.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  const handleAssess = async () => {
    const requestId = assessmentRequestIdRef.current + 1
    assessmentRequestIdRef.current = requestId
    const p = projects[index]
    setAssessmentLoading(true)
    const daysSinceUpdate = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400000)
    try {
      const res = await fetch('/api/ai/review-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          description: p.description,
          status: p.status,
          score: p.computedScore ?? 0,
          tasksDone: p.tasks?.filter((t) => t.done).length ?? 0,
          tasksTotal: p.tasks?.length ?? 0,
          nextStep: p.nextStep,
          daysSinceUpdate,
        }),
      })
      const data = await res.json()
      if (res.ok && assessmentRequestIdRef.current === requestId) setAssessment(data.assessment)
    } catch {
      // silently ignore
    } finally {
      if (assessmentRequestIdRef.current === requestId) setAssessmentLoading(false)
    }
  }

  const handleKeep = () => {
    advance({ projectId: projects[index].id, decision: 'kept' })
  }

  const handleSkip = () => {
    advance({ projectId: projects[index].id, decision: 'skipped' })
  }

  const handleStatusChange = async (status: 'PAUSED' | 'DONE') => {
    setActing(true)
    const project = projects[index]
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...project, scores: Object.fromEntries(project.scores.map((s) => [s.criterionId, s.value])), status }),
    })
    setActing(false)
    advance({ projectId: project.id, decision: status === 'PAUSED' ? 'paused' : 'archived' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-[var(--muted-foreground)] animate-pulse">Lade Projekte…</div>
      </div>
    )
  }

  const total = projects.length
  const processed = done ? total : index + results.length - results.length + index
  const progress = total === 0 ? 100 : Math.round((index / total) * 100)

  if (done) {
    const kept = results.filter((r) => r.decision === 'kept').length
    const paused = results.filter((r) => r.decision === 'paused').length
    const archived = results.filter((r) => r.decision === 'archived').length
    const skipped = results.filter((r) => r.decision === 'skipped').length

    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        {/* Full progress bar */}
        <div className="h-1 w-full" style={{ background: '#22c55e' }} />

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-[560px]">
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">✓</div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Review abgeschlossen</h1>
              <p className="text-[var(--muted-foreground)] mt-1 text-sm">
                {total === 0 ? 'Keine aktiven Projekte zu reviewen.' : `${total} Projekt${total !== 1 ? 'e' : ''} durchgesehen`}
              </p>
            </div>

            <div
              className="rounded-xl border border-[var(--card-border)] p-6 space-y-3 mb-8"
              style={{ background: 'var(--card)' }}
            >
              <SummaryRow label="Noch relevant" count={kept} color="#22c55e" />
              <SummaryRow label="Pausiert" count={paused} color="#f59e0b" />
              <SummaryRow label="Archiviert" count={archived} color="#ef4444" />
              <SummaryRow label="Übersprungen" count={skipped} color="#6b7280" />
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
              style={{ background: 'var(--accent)', color: '#0f1117' }}
            >
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const project = projects[index]
  const score = project.computedScore ?? 0
  const scoreColor = getScoreColor(score)
  const gradientFrom = scoreColor === 'green' ? '#22c55e' : scoreColor === 'amber' ? '#f59e0b' : '#3b82f6'
  const gradientTo = scoreColor === 'green' ? '#16a34a' : scoreColor === 'amber' ? '#d97706' : '#2563eb'
  const scoreTextColor = scoreColor === 'green' ? '#22c55e' : scoreColor === 'amber' ? '#f59e0b' : '#3b82f6'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Progress bar */}
      <div className="h-1 w-full bg-slate-800 shrink-0">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: 'var(--accent)' }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <span className="text-xs text-[var(--muted-foreground)] font-medium uppercase tracking-wider">
          Review
        </span>
        <span className="text-xs text-[var(--muted-foreground)] tabular-nums">
          {index + 1} von {total}
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[560px] flex flex-col gap-5">

          {/* Project card */}
          <div
            className="rounded-2xl border border-[var(--card-border)] p-8"
            style={{ background: 'var(--card)' }}
          >
            {/* Name + description */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-[var(--foreground)] leading-snug">
                {project.name}
              </h2>
              {project.description && (
                <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: STATUS_COLORS[project.status] + '33',
                  color: STATUS_COLORS[project.status],
                }}
              >
                {STATUS_LABELS[project.status]}
              </span>
              {(project.tags ?? []).map((tag) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-slate-700 text-slate-300">
                  {tag}
                </span>
              ))}
            </div>

            {/* Score */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--muted-foreground)]">Score</span>
                <span className="text-sm font-bold font-mono" style={{ color: scoreTextColor }}>{score}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }}
                />
              </div>
              {project.tasks && project.tasks.length > 0 && (() => {
                const total = project.tasks!.length
                const done = project.tasks!.filter((t) => t.done).length
                const open = total - done
                return (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">
                    ✓ {done} von {total} Tasks erledigt &nbsp;|&nbsp; {open} offen
                  </p>
                )
              })()}
            </div>

            {/* Next step */}
            {project.nextStep && (
              <div className="text-sm text-[var(--muted-foreground)] mb-5 p-3 rounded-lg bg-slate-800/60 border border-[var(--card-border)]">
                <span className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider block mb-1">
                  Nächster Schritt
                </span>
                {project.nextStep}
              </div>
            )}

            {/* AI assessment */}
            {aiAvailable && (
              <div className="mb-5">
                {!assessment ? (
                  <button
                    type="button"
                    onClick={handleAssess}
                    disabled={assessmentLoading}
                    className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 transition-colors"
                  >
                    {assessmentLoading ? 'Analysiere…' : '✦ KI-Einschätzung'}
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-[var(--foreground)] leading-relaxed">
                    {assessment}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="text-xs text-[var(--muted-foreground)]">
              Zuletzt geändert: {formatRelativeTime(project.updatedAt.toString())}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <ActionButton
              onClick={handleKeep}
              disabled={acting}
              color="#22c55e"
              bg="rgba(34,197,94,0.1)"
              border="rgba(34,197,94,0.25)"
              label="Noch relevant"
              icon="✓"
            />
            <ActionButton
              onClick={() => handleStatusChange('PAUSED')}
              disabled={acting}
              color="#f59e0b"
              bg="rgba(245,158,11,0.1)"
              border="rgba(245,158,11,0.25)"
              label="Pausieren"
              icon="⏸"
            />
            <ActionButton
              onClick={() => handleStatusChange('DONE')}
              disabled={acting}
              color="#ef4444"
              bg="rgba(239,68,68,0.1)"
              border="rgba(239,68,68,0.25)"
              label="Archivieren"
              icon="✕"
            />
          </div>

          {/* Skip link */}
          <div className="text-center">
            <button
              onClick={handleSkip}
              disabled={acting}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
            >
              Überspringen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  disabled,
  color,
  bg,
  border,
  label,
  icon,
}: {
  onClick: () => void
  disabled: boolean
  color: string
  bg: string
  border: string
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl border font-medium text-sm transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98]"
      style={{ color, background: bg, borderColor: border }}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="leading-tight text-center">{label}</span>
    </button>
  )
}

function SummaryRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-sm text-[var(--foreground)]">{label}</span>
      </div>
      <span className="text-sm font-bold font-mono" style={{ color }}>{count}</span>
    </div>
  )
}
