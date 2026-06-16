import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const STATUS_LABELS: Record<string, string> = {
  IDEA: 'Idee',
  PLANNING: 'Planung',
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  DONE: 'Fertig',
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { name, description, status, score, tasksDone, tasksTotal, nextStep, daysSinceUpdate } = body as {
    name?: string
    description?: string
    status?: string
    score?: number
    tasksDone?: number
    tasksTotal?: number
    nextStep?: string
    daysSinceUpdate?: number
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const lines: string[] = [`Projektname: ${name.trim()}`]
  if (description?.trim()) lines.push(description.trim())
  lines.push(`Status: ${STATUS_LABELS[status ?? ''] ?? status ?? 'Unbekannt'}`)
  lines.push(`Score: ${score ?? 0}/100`)
  if (tasksTotal && tasksTotal > 0) lines.push(`Tasks: ${tasksDone ?? 0} von ${tasksTotal} erledigt`)
  if (nextStep?.trim()) lines.push(`Nächster Schritt: ${nextStep.trim()}`)
  lines.push(`Zuletzt geändert: vor ${daysSinceUpdate ?? 0} Tagen`)

  const systemPrompt = `Du bist Assistent in einem Projektpriorisierungstool. Gib eine kurze Einschätzung (2–3 Sätze) als Entscheidungshilfe für das aktuelle Review. Bewerte: Score-Einordnung, ob das Projekt seit längerem inaktiv wirkt, und Task-Fortschritt. Antworte direkt und prägnant auf Deutsch, ohne Einleitung.`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: lines.join('\n') }],
    })

    const assessment = ((message.content[0] as { type: string; text: string }).text ?? '').trim()

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('POST /api/ai/review-suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
