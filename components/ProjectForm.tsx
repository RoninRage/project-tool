'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CRITERIA, calculateScore, getScoreColor } from '@/lib/criteria'
import type { Status, ScoreHistoryEntry } from '@/lib/types'
import ScoreHistoryChart from './ScoreHistoryChart'

const STATUS_LABELS: Record<Status, string> = {
  IDEA: 'Idee',
  PLANNING: 'Planung',
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  DONE: 'Fertig',
}

export interface ProjectFormData {
  name: string
  description: string
  status: Status
  category: string
  nextStep: string
  scores: Record<string, number>
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>
  onSubmit: (data: ProjectFormData) => Promise<void>
  submitLabel: string
  history?: ScoreHistoryEntry[]
}

export default function ProjectForm({ initialData, onSubmit, submitLabel, history }: ProjectFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [status, setStatus] = useState<Status>(initialData?.status ?? 'IDEA')
  const [category, setCategory] = useState(initialData?.category ?? '')
  const [nextStep, setNextStep] = useState(initialData?.nextStep ?? '')
  const [scores, setScores] = useState<Record<string, number>>(
    initialData?.scores ?? Object.fromEntries(CRITERIA.map((c) => [c.id, 0]))
  )
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [matrixLabelMaxLength, setMatrixLabelMaxLength] = useState(20)
  const [existingCategories, setExistingCategories] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
    ]).then(([settingsData, projectsData]) => {
      setWeights(settingsData.weights ?? {})
      setMatrixLabelMaxLength(settingsData.matrixLabelMaxLength ?? 20)
      const cats = Array.from(
        new Set(
          (projectsData as Array<{ category: string | null }>)
            .map((p) => p.category)
            .filter(Boolean)
        )
      ) as string[]
      setExistingCategories(cats)
    })
  }, [])

  const liveScore = useMemo(() => calculateScore(scores, weights), [scores, weights])
  const scoreColor = getScoreColor(liveScore)

  const scoreColorClass =
    scoreColor === 'green'
      ? 'text-green-400'
      : scoreColor === 'amber'
      ? 'text-amber-400'
      : 'text-blue-400'

  const scoreBarColor =
    scoreColor === 'green'
      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
      : scoreColor === 'amber'
      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
      : 'linear-gradient(90deg, #3b82f6, #2563eb)'

  const handleScoreChange = (criterionId: string, value: number) => {
    setScores((prev) => ({ ...prev, [criterionId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name ist erforderlich'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), description, status, category, nextStep, scores })
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic info */}
      <div className="rounded-xl border border-[var(--card-border)] p-6 space-y-5" style={{ background: 'var(--card)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Projektdetails
        </h2>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Projektname…"
            className={`w-full px-3 py-2 rounded-lg border bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors ${
              errors.name ? 'border-red-500' : 'border-[var(--card-border)]'
            }`}
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          <div className="flex items-center justify-between mt-1">
            <div>
              {name.length > matrixLabelMaxLength && (
                <p className="text-amber-400 text-xs">
                  Dieser Name wird in der Matrixansicht möglicherweise abgeschnitten.
                </p>
              )}
            </div>
            <span className={`text-xs tabular-nums ${name.length > matrixLabelMaxLength ? 'text-amber-400' : 'text-[var(--muted-foreground)]'}`}>
              {name.length}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Beschreibung
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Projektbeschreibung…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
        </div>

        {/* Status + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Kategorie
            </label>
            <input
              type="text"
              list="categories-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="z.B. Homelab, Software…"
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <datalist id="categories-list">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Next Step */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
            Nächster Schritt
          </label>
          <input
            type="text"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="Was ist der konkrete nächste Schritt?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* Criteria scoring */}
      <div className="rounded-xl border border-[var(--card-border)] p-6" style={{ background: 'var(--card)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Bewertungskriterien
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted-foreground)]">Score:</span>
            <span className={`font-mono text-2xl font-bold ${scoreColorClass}`}>{liveScore}</span>
            <div className="w-20">
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${liveScore}%`, background: scoreBarColor }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {CRITERIA.map((criterion) => {
            const currentValue = scores[criterion.id] ?? 0
            return (
              <div key={criterion.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {criterion.name}
                  </span>
                  {criterion.inverted && (
                    <span className="text-xs px-1.5 py-0.5 rounded text-amber-400 border border-amber-500/30 bg-amber-500/10">
                      Invertiert
                    </span>
                  )}
                  <span className="text-xs text-[var(--muted-foreground)] ml-1">
                    — {criterion.description}
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {criterion.options.map((option, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleScoreChange(criterion.id, idx)}
                      className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                        currentValue === idx
                          ? 'bg-amber-500 border-amber-500 text-black'
                          : 'border-[var(--card-border)] text-[var(--muted-foreground)] hover:border-amber-500/50 hover:text-[var(--foreground)] bg-[var(--background)]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score history */}
      {history && history.length >= 1 && (
        <div className="rounded-xl border border-[var(--card-border)] p-6" style={{ background: 'var(--card)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            Score-Verlauf
          </h2>
          <ScoreHistoryChart history={history} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg border border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#0f1117' }}
        >
          {submitting ? 'Speichern…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
