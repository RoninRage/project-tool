'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProjectForm, { type ProjectFormData } from '@/components/ProjectForm'

export default function NewProjectPage() {
  const router = useRouter()

  const handleSubmit = async (data: ProjectFormData) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Fehler beim Erstellen des Projekts')
    }
    router.push('/')
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
          <span className="text-[var(--foreground)]">Neues Projekt</span>
        </div>

        <h1 className="text-xl font-bold text-[var(--foreground)] mb-6">
          Neues Projekt anlegen
        </h1>

        <ProjectForm onSubmit={handleSubmit} submitLabel="Projekt erstellen" />
      </div>
    </div>
  )
}
