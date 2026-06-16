'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import ProjectForm, { type ProjectFormData } from '@/components/ProjectForm'
import type { ProjectWithScores } from '@/lib/types'
import type { Status } from '@/lib/types'

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [project, setProject] = useState<ProjectWithScores | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (data) setProject(data)
        setLoading(false)
      })
  }, [id])

  const handleSubmit = async (data: ProjectFormData) => {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Fehler beim Aktualisieren des Projekts')
    }
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-[var(--muted-foreground)] animate-pulse">Lade Projekt…</div>
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }}>
        <p className="text-[var(--muted-foreground)]">Projekt nicht gefunden.</p>
        <Link href="/" className="text-[var(--accent)] hover:underline">
          Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  const scoreMap: Record<string, number> = {}
  for (const s of project.scores) {
    scoreMap[s.criterionId] = s.value
  }

  const initialData: ProjectFormData = {
    name: project.name,
    description: project.description ?? '',
    status: project.status as Status,
    tags: project.tags ?? [],
    nextStep: project.nextStep ?? '',
    projectLink: project.projectLink ?? '',
    scores: scoreMap,
    completedAt: project.completedAt ? new Date(project.completedAt).toISOString().slice(0, 10) : '',
    closingNote: project.closingNote ?? '',
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
          <span className="text-[var(--foreground)]">{project.name}</span>
        </div>

        <h1 className="text-xl font-bold text-[var(--foreground)] mb-6">
          Projekt bearbeiten
        </h1>

        <ProjectForm
          initialData={initialData}
          onSubmit={handleSubmit}
          submitLabel="Änderungen speichern"
          history={project.history}
          projectId={id}
        />
      </div>
    </div>
  )
}
