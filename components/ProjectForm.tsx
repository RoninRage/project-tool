'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CRITERIA, calculateScore, getScoreColor, getProgressValue } from '@/lib/criteria'
import type { Status, ScoreHistoryEntry } from '@/lib/types'
import ScoreHistoryChart from './ScoreHistoryChart'

const STATUS_LABELS: Record<Status, string> = {
  IDEA: 'Idee',
  PLANNING: 'Planung',
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  DONE: 'Fertig',
}

const PROGRESS_LABELS = ['Idee', 'Gestartet', 'Halbzeit', 'Fast fertig', 'Letzter Schliff']
const MAX_TASKS = 25

interface Task {
  id: string
  text: string
  done: boolean
  order: number
}

export interface ProjectFormData {
  name: string
  description: string
  status: Status
  tags: string[]
  nextStep: string
  projectLink?: string
  scores: Record<string, number>
  completedAt?: string
  closingNote?: string
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>
  onSubmit: (data: ProjectFormData) => Promise<void>
  submitLabel: string
  history?: ScoreHistoryEntry[]
  projectId?: string
}

export default function ProjectForm({
  initialData,
  onSubmit,
  submitLabel,
  history,
  projectId,
}: ProjectFormProps) {
  const router = useRouter()

  // Project fields
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [status, setStatus] = useState<Status>(initialData?.status ?? 'IDEA')
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [nextStep, setNextStep] = useState(initialData?.nextStep ?? '')
  const [projectLink, setProjectLink] = useState(initialData?.projectLink ?? '')
  const [completedAt, setCompletedAt] = useState(initialData?.completedAt ?? '')
  const [closingNote, setClosingNote] = useState(initialData?.closingNote ?? '')
  const [scores, setScores] = useState<Record<string, number>>(
    initialData?.scores ?? Object.fromEntries(CRITERIA.map((c) => [c.id, 0]))
  )
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [matrixLabelMaxLength, setMatrixLabelMaxLength] = useState(20)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // AI description suggestion
  const [descSuggestion, setDescSuggestion] = useState<string | null>(null)
  const [descLoading, setDescLoading] = useState(false)
  // AI next step suggestion
  const [nextStepSuggestion, setNextStepSuggestion] = useState<string | null>(null)
  const [nextStepLoading, setNextStepLoading] = useState(false)
  // AI tag suggestion
  const [tagSuggestLoading, setTagSuggestLoading] = useState(false)
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])

  // AI score suggestion
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, number> | null>(null)

  // Task state
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskText, setEditingTaskText] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  // Prevent blur from double-firing after Enter
  const addingRef = useRef(false)

  // Drag & drop state
  const dragFromHandleRef = useRef(false)
  const dragTaskIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/roulette/available').then((r) => r.json()),
    ]).then(([settingsData, projectsData, aiData]) => {
      setWeights(settingsData.weights ?? {})
      setMatrixLabelMaxLength(settingsData.matrixLabelMaxLength ?? 20)
      const allProjectTags = Array.from(
        new Set((projectsData as Array<{ tags: string[] }>).flatMap((p) => p.tags ?? []))
      ).sort()
      setAllTags(allProjectTags)
      setAiAvailable(aiData.available === true)
    })
  }, [])

  useEffect(() => {
    if (!projectId) return
    setTasksLoading(true)
    fetch(`/api/projects/${projectId}/tasks`)
      .then((r) => r.json())
      .then((data: Task[]) => {
        setTasks(data)
        setTasksLoading(false)
      })
  }, [projectId])

  // Live score — inject task-derived progress so the header reflects reality
  const liveScore = useMemo(() => {
    const adjustedScores = { ...scores, progress: getProgressValue(tasks) }
    return calculateScore(adjustedScores, weights)
  }, [scores, weights, tasks])

  const scoreColor = getScoreColor(liveScore)
  const scoreColorClass =
    scoreColor === 'green' ? 'text-green-400' : scoreColor === 'amber' ? 'text-amber-400' : 'text-blue-400'
  const scoreBarColor =
    scoreColor === 'green'
      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
      : scoreColor === 'amber'
      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
      : 'linear-gradient(90deg, #3b82f6, #2563eb)'

  const progressLabel = PROGRESS_LABELS[getProgressValue(tasks)]

  // ── Task handlers ──────────────────────────────────────────────────────────

  const handleAddTask = async () => {
    if (addingRef.current || !newTaskText.trim() || !projectId) return
    addingRef.current = true
    const text = newTaskText.trim()
    setNewTaskText('')
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const task: Task = await res.json()
        setTasks((prev) => [...prev, task])
      } else {
        setNewTaskText(text) // restore on failure
      }
    } finally {
      addingRef.current = false
    }
  }

  const handleToggleDone = async (taskId: string, done: boolean) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)))
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    })
    if (!res.ok) {
      // Revert on failure
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done: !done } : t)))
    }
  }

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTaskText(task.text)
  }

  const handleEditSave = async (taskId: string) => {
    const text = editingTaskText.trim()
    setEditingTaskId(null)
    if (!text) return
    const original = tasks.find((t) => t.id === taskId)
    if (original && text === original.text) return
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, text } : t)))
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  }

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (!dragFromHandleRef.current) {
      e.preventDefault()
      return
    }
    dragFromHandleRef.current = false
    dragTaskIdRef.current = taskId
    setDraggingId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    dragTaskIdRef.current = null
    dragFromHandleRef.current = false
    setDraggingId(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const draggedId = dragTaskIdRef.current
    if (!draggedId) return

    const fromIndex = tasks.findIndex((t) => t.id === draggedId)
    setDragOverIndex(null)
    if (fromIndex === toIndex) return

    // Reorder locally
    const newTasks = [...tasks]
    const [removed] = newTasks.splice(fromIndex, 1)
    newTasks.splice(toIndex, 0, removed)
    setTasks(newTasks.map((t, i) => ({ ...t, order: i })))

    // PATCH only tasks whose position in the array changed
    const patches: { id: string; newOrder: number }[] = []
    for (let i = 0; i < newTasks.length; i++) {
      const originalPos = tasks.findIndex((t) => t.id === newTasks[i].id)
      if (originalPos !== i) patches.push({ id: newTasks[i].id, newOrder: i })
    }

    Promise.all(
      patches.map(({ id, newOrder }) =>
        fetch(`/api/projects/${projectId}/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newOrder }),
        })
      )
    )
  }

  // ── AI description suggestion ─────────────────────────────────────────────

  const handleDescSuggest = async () => {
    if (!name.trim() || descLoading) return
    setDescLoading(true)
    setDescSuggestion(null)
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scores }),
      })
      const data = await res.json()
      if (res.ok) setDescSuggestion(data.description)
    } catch {
      // silently ignore
    } finally {
      setDescLoading(false)
    }
  }
  // ── AI next step suggestion ──────────────────────────────────────────────

  const handleNextStepSuggest = async () => {
    if (!name.trim() || nextStepLoading) return
    setNextStepLoading(true)
    setNextStepSuggestion(null)
    try {
      const res = await fetch('/api/ai/next-step-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          status,
          currentNextStep: nextStep || undefined,
          tasks: tasks.map(({ text, done }) => ({ text, done })),
        }),
      })
      const data = await res.json()
      if (res.ok) setNextStepSuggestion(data.nextStep)
    } catch {
      // silently ignore
    } finally {
      setNextStepLoading(false)
    }
  }

  // ── AI tag suggestion ─────────────────────────────────────────────────────

  const handleTagSuggest = async () => {
    if (!name.trim() || tagSuggestLoading) return
    setTagSuggestLoading(true)
    setTagSuggestions([])
    try {
      const res = await fetch('/api/ai/tag-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, existingTags: allTags }),
      })
      const data = await res.json()
      if (res.ok) {
        setTagSuggestions((data.suggestions as string[]).filter((t) => !tags.includes(t)))
      }
    } catch {
      // silently ignore
    } finally {
      setTagSuggestLoading(false)
    }
  }

  // ── AI score suggestion ───────────────────────────────────────────────────

  const handleAiSuggest = async () => {
    if (!aiText.trim() || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setAiSuggestions(null)
    try {
      const res = await fetch('/api/ai/score-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? 'Fehler beim Generieren des Vorschlags')
      } else {
        setAiSuggestions(data.suggestions)
      }
    } catch {
      setAiError('Netzwerkfehler')
    } finally {
      setAiLoading(false)
    }
  }

  const acceptAiSuggestion = (criterionId: string) => {
    if (aiSuggestions?.[criterionId] === undefined) return
    setScores((prev) => ({ ...prev, [criterionId]: aiSuggestions[criterionId] }))
    setAiSuggestions((prev) => {
      if (!prev) return null
      const next = { ...prev }
      delete next[criterionId]
      return Object.keys(next).length > 0 ? next : null
    })
  }

  const acceptAllAiSuggestions = () => {
    if (!aiSuggestions) return
    setScores((prev) => ({ ...prev, ...aiSuggestions }))
    setAiSuggestions(null)
  }

  // ── Form submit ────────────────────────────────────────────────────────────

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
      await onSubmit({ name: name.trim(), description, status, tags, nextStep, projectLink: projectLink || undefined, scores, completedAt: completedAt || undefined, closingNote: closingNote || undefined })
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
            <span
              className={`text-xs tabular-nums ${
                name.length > matrixLabelMaxLength ? 'text-amber-400' : 'text-[var(--muted-foreground)]'
              }`}
            >
              {name.length}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Beschreibung</label>
            {aiAvailable && (
              <button
                type="button"
                onClick={handleDescSuggest}
                disabled={!name.trim() || descLoading}
                className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {descLoading ? 'Analysiere…' : '✦ Vorschlag'}
              </button>
            )}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Projektbeschreibung…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
          {descSuggestion && (
            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <p className="flex-1 text-sm text-[var(--foreground)]">{descSuggestion}</p>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => { if (!descSuggestion) return; setDescription(descSuggestion); setDescSuggestion(null) }}
                  className="text-xs px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  onClick={() => setDescSuggestion(null)}
                  aria-label="Vorschlag verwerfen"
                  className="text-xs px-1.5 py-0.5 rounded border border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[var(--foreground)]">Tags</label>
              {aiAvailable && (
                <button
                  type="button"
                  onClick={handleTagSuggest}
                  disabled={!name.trim() || tagSuggestLoading}
                  className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {tagSuggestLoading ? 'Analysiere…' : '✦ Vorschlag'}
                </button>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                      className="leading-none hover:text-white transition-colors"
                      aria-label={`Tag ${tag} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              list="tags-list"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  const val = tagInput.trim().replace(/,$/, '')
                  if (val && !tags.includes(val)) setTags((prev) => [...prev, val])
                  setTagInput('')
                } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                  setTags((prev) => prev.slice(0, -1))
                }
              }}
              onBlur={() => {
                const val = tagInput.trim()
                if (val && !tags.includes(val)) setTags((prev) => [...prev, val])
                setTagInput('')
              }}
              placeholder={tags.length === 0 ? 'z.B. Homelab, Software… (Enter zum Hinzufügen)' : 'Weiteren Tag hinzufügen…'}
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <datalist id="tags-list">
              {allTags.filter((t) => !tags.includes(t)).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            {tagSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-xs text-[var(--muted-foreground)] self-center">KI:</span>
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
                      setTagSuggestions((prev) => prev.filter((t) => t !== tag))
                    }}
                    className="text-xs px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Archive fields — only shown when status is DONE */}
        {status === 'DONE' && (
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Abschlussdatum
              </label>
              <input
                type="date"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Abschlussnotiz
              </label>
              <textarea
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Was wurde erreicht? Was bleibt offen?"
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* Next Step */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Nächster Schritt</label>
            {aiAvailable && (
              <button
                type="button"
                onClick={handleNextStepSuggest}
                disabled={!name.trim() || nextStepLoading}
                className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {nextStepLoading ? 'Analysiere…' : '✦ Vorschlag'}
              </button>
            )}
          </div>
          <input
            type="text"
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="Was ist der konkrete nächste Schritt?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          {nextStepSuggestion && (
            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <p className="flex-1 text-sm text-[var(--foreground)]">{nextStepSuggestion}</p>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => { setNextStep(nextStepSuggestion); setNextStepSuggestion(null) }}
                  className="text-xs px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  onClick={() => setNextStepSuggestion(null)}
                  aria-label="Vorschlag verwerfen"
                  className="text-xs px-1.5 py-0.5 rounded border border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Projekt-Link */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Projekt-Link</label>
          <input
            type="url"
            value={projectLink}
            onChange={(e) => setProjectLink(e.target.value)}
            placeholder="z.B. https://claude.ai/project/…"
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* AI Score-Vorschlag — only when ANTHROPIC_API_KEY is set */}
      {aiAvailable && (
        <div className="rounded-xl border border-[var(--card-border)] p-6 space-y-4" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              KI Score-Vorschlag
            </h2>
            {aiSuggestions && Object.keys(aiSuggestions).length > 0 && (
              <button
                type="button"
                onClick={acceptAllAiSuggestions}
                className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
                style={{ background: 'var(--accent)', color: '#0f1117' }}
              >
                Alle übernehmen
              </button>
            )}
          </div>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Beschreibe das Projekt in eigenen Worten – Claude schlägt dann Scores vor…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={!aiText.trim() || aiLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {aiLoading ? 'Analysiere…' : 'Vorschlag generieren'}
            </button>
            {aiError && (
              <span className="text-xs text-red-400">{aiError}</span>
            )}
          </div>
        </div>
      )}

      {/* Criteria scoring — progress is excluded (auto-derived from tasks) */}
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
          {CRITERIA.filter((c) => c.id !== 'progress').map((criterion) => {
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
                {aiSuggestions?.[criterion.id] !== undefined && aiSuggestions[criterion.id] !== currentValue && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-amber-400/80">
                      KI: <span className="font-medium text-amber-400">{criterion.options[aiSuggestions[criterion.id]]}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => acceptAiSuggestion(criterion.id)}
                      className="text-xs px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      Übernehmen
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tasks — only shown when editing an existing project */}
      {projectId && (
        <div className="rounded-xl border border-[var(--card-border)] p-6" style={{ background: 'var(--card)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            Tasks
          </h2>

          {tasksLoading ? (
            <p className="text-xs text-[var(--muted-foreground)] animate-pulse">Lade Tasks…</p>
          ) : (
            <>
              {/* Task list */}
              {tasks.length > 0 && (
                <ul className="mb-3">
                  {tasks.map((task, index) => (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex items-center gap-2 group py-1 border-t-2 transition-opacity ${
                        draggingId === task.id ? 'opacity-30' : 'opacity-100'
                      } ${
                        dragOverIndex === index && draggingId !== task.id
                          ? 'border-amber-500'
                          : 'border-transparent'
                      }`}
                    >
                      {/* Drag handle */}
                      <span
                        onMouseDown={() => { dragFromHandleRef.current = true }}
                        className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity select-none"
                        title="Ziehen zum Sortieren"
                      >
                        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                          <circle cx="2" cy="2" r="1.5" />
                          <circle cx="6" cy="2" r="1.5" />
                          <circle cx="2" cy="6" r="1.5" />
                          <circle cx="6" cy="6" r="1.5" />
                          <circle cx="2" cy="10" r="1.5" />
                          <circle cx="6" cy="10" r="1.5" />
                        </svg>
                      </span>

                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggleDone(task.id, !task.done)}
                        className="w-4 h-4 shrink-0 accent-amber-500 cursor-pointer"
                      />

                      {/* Inline-editable text */}
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          onBlur={() => handleEditSave(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleEditSave(task.id) }
                            if (e.key === 'Escape') setEditingTaskId(null)
                          }}
                          className="flex-1 px-2 py-0.5 text-sm rounded border border-[var(--accent)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => startEditing(task)}
                          className={`flex-1 text-sm cursor-text select-none transition-opacity ${
                            task.done
                              ? 'line-through opacity-40'
                              : 'text-[var(--foreground)] hover:text-[var(--accent)]'
                          }`}
                        >
                          {task.text}
                        </span>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                        title="Task löschen"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add task input or limit note */}
              {tasks.length < MAX_TASKS ? (
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTask()
                    }
                  }}
                  onBlur={handleAddTask}
                  placeholder="+ Task hinzufügen"
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-dashed border-[var(--card-border)] bg-transparent text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              ) : (
                <p className="text-xs text-[var(--muted-foreground)] italic">
                  Maximum erreicht (25 Tasks)
                </p>
              )}

              {/* Finishing Energy indicator */}
              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                Finishing Energy wird automatisch berechnet · aktuell:{' '}
                <span className="text-[var(--foreground)] font-medium">{progressLabel}</span>
              </p>
            </>
          )}
        </div>
      )}

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
