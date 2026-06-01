'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { CRITERIA, DEFAULT_WEIGHTS, calculateScore } from '@/lib/criteria'

export default function SettingsPage() {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setWeights(data.weights ?? DEFAULT_WEIGHTS)
        setLoading(false)
      })
  }, [])

  const saveWeights = useCallback(async (w: Record<string, number>) => {
    setSaveState('saving')
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: w }),
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
    }
  }, [])

  const handleWeightChange = (id: string, value: number) => {
    const newWeights = { ...weights, [id]: value }
    setWeights(newWeights)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveState('saving')
    debounceRef.current = setTimeout(() => {
      saveWeights(newWeights)
    }, 500)
  }

  const handleReset = async () => {
    setWeights(DEFAULT_WEIGHTS)
    await saveWeights(DEFAULT_WEIGHTS)
  }

  // Preview: example scores
  const exampleScores: Record<string, number> = {
    time: 1, material: 1, cost: 1, impact: 3, motivation: 4, learning: 3, dependency: 1, complexity: 2,
  }
  const previewScore = calculateScore(exampleScores, weights)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-[var(--muted-foreground)] animate-pulse">Lade Einstellungen…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] mb-6">
          <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
            Projekt Prio
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)]">Einstellungen</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Gewichtung der Kriterien
          </h1>
          <div className="flex items-center gap-3">
            {saveState === 'saving' && (
              <span className="text-xs text-[var(--muted-foreground)] animate-pulse">Speichern…</span>
            )}
            {saveState === 'saved' && (
              <span className="text-xs text-green-400">Gespeichert ✓</span>
            )}
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--card-border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
            >
              Zurücksetzen
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] p-6 space-y-6" style={{ background: 'var(--card)' }}>
          <p className="text-sm text-[var(--muted-foreground)]">
            Passe die Gewichtung jedes Kriteriums an (0.5 – 3.0). Höhere Werte haben mehr Einfluss auf den Score.
            Änderungen werden automatisch gespeichert.
          </p>

          {CRITERIA.map((criterion) => {
            const value = weights[criterion.id] ?? 1
            return (
              <div key={criterion.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {criterion.name}
                    </span>
                    {criterion.inverted && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded text-amber-400 border border-amber-500/30 bg-amber-500/10">
                        Invertiert
                      </span>
                    )}
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {criterion.description}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-[var(--accent)] ml-4 w-8 text-right shrink-0">
                    {value.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.5}
                  value={value}
                  onChange={(e) => handleWeightChange(criterion.id, Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-[var(--muted-foreground)] mt-0.5">
                  <span>0.5</span>
                  <span>1.0</span>
                  <span>1.5</span>
                  <span>2.0</span>
                  <span>2.5</span>
                  <span>3.0</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Preview */}
        <div className="mt-6 rounded-xl border border-[var(--card-border)] p-6" style={{ background: 'var(--card)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            Vorschau mit Beispielprojekt
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Beispielwerte: Zeitaufwand S, Kosten &lt;10€, Impact hoch, Begeisterung brennt, Lernpotenzial viel, Dependency kaum, Komplexität mittel
          </p>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-mono font-bold text-amber-400">{previewScore}</div>
            <div className="flex-1">
              <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${previewScore}%`,
                    background:
                      previewScore <= 40
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : previewScore <= 65
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  }}
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {previewScore <= 40 ? 'Niedriger Score' : previewScore <= 65 ? 'Mittlerer Score' : 'Hoher Score'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm transition-colors"
          >
            ← Zurück zur Übersicht
          </Link>
        </div>
      </div>
    </div>
  )
}
