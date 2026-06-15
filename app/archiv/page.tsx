'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { calculateScore, DEFAULT_WEIGHTS, getScoreColor, getProgressValue } from '@/lib/criteria'
import type { ProjectWithScores, WeightsMap } from '@/lib/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })
}

const SCORE_COLOR_MAP: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  blue: '#3b82f6',
}

export default function ArchivPage() {
  const [projects, setProjects] = useState<ProjectWithScores[]>([])
  const [weights, setWeights] = useState<WeightsMap>({})
  const [loading, setLoading] = useState(true)

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

  const done = projects
    .filter((p) => p.status === 'DONE')
    .map((p) => {
      const scoreMap: Record<string, number> = {}
      for (const s of p.scores) scoreMap[s.criterionId] = s.value
      scoreMap['progress'] = getProgressValue(p.tasks ?? [])
      return { ...p, computedScore: calculateScore(scoreMap, weights.length ? weights : DEFAULT_WEIGHTS) }
    })
    .sort((a, b) => {
      if (!a.completedAt && !b.completedAt) return 0
      if (!a.completedAt) return 1
      if (!b.completedAt) return -1
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    })

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              ← Projekt Prio
            </Link>
            <h1 className="text-xl font-bold text-[var(--foreground)] mt-2">Archiv</h1>
            {!loading && (
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                {done.length} abgeschlossene{done.length !== 1 ? '' : 's'} Projekt{done.length !== 1 ? 'e' : ''}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--muted-foreground)] animate-pulse">Lade Archiv…</div>
          </div>
        ) : done.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-[var(--muted-foreground)]">Noch keine abgeschlossenen Projekte.</p>
            <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
              Zurück zur Übersicht
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {done.map((project) => {
              const score = project.computedScore ?? 0
              const color = getScoreColor(score)
              const scoreHex = SCORE_COLOR_MAP[color]
              return (
                <div
                  key={project.id}
                  className="rounded-xl border border-[var(--card-border)] p-5"
                  style={{ background: 'var(--card)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${project.id}/edit`}
                        className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors truncate block"
                      >
                        {project.name}
                      </Link>
                      {(project.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(project.tags ?? []).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div
                      className="shrink-0 font-mono font-bold text-lg tabular-nums"
                      style={{ color: scoreHex }}
                    >
                      {score}
                    </div>
                  </div>

                  {project.closingNote && (
                    <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {project.closingNote}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>
                      {project.completedAt ? `Abgeschlossen ${formatDate(project.completedAt)}` : 'Kein Abschlussdatum'}
                    </span>
                    <span>Erstellt {formatDate(project.createdAt as unknown as string)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
