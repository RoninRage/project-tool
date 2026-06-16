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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, description, status, currentNextStep, tasks } = body as {
    name?: string
    description?: string
    status?: string
    currentNextStep?: string
    tasks?: { text: string; done: boolean }[]
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const lines: string[] = [`Projektname: ${name.trim()}`]
  if (description?.trim()) lines.push(`Beschreibung: ${description.trim()}`)
  if (status) lines.push(`Status: ${STATUS_LABELS[status] ?? status}`)
  const safeTasks = (Array.isArray(tasks) ? tasks : [])
    .filter(
      (task): task is { text: string; done: boolean } =>
        typeof task?.text === 'string' && typeof task?.done === 'boolean'
    )
    .map((task) => ({
      ...task,
      text: task.text.replace(/[\r\n]+/g, ' ').trim(),
    }))
    .filter((task) => task.text.length > 0)
    .slice(0, 50)

  if (safeTasks.length > 0) {
    lines.push('Tasks:')
    for (const t of safeTasks) {
      lines.push(`- [${t.done ? 'x' : ' '}] ${t.text}`)
    }
  }
  if (currentNextStep?.trim()) lines.push(`Aktueller nächster Schritt: ${currentNextStep.trim()}`)

  const systemPrompt = `Du bist Assistent in einem Projektpriorisierungstool. Schlage einen konkreten, umsetzbaren nächsten Schritt für das Projekt vor (1 Satz, max. 100 Zeichen). Antworte nur mit dem Schritt, ohne Einleitung, Anführungszeichen oder Erklärungen.`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: systemPrompt,
      messages: [{ role: 'user', content: lines.join('\n') }],
    })

    const nextStep = ((message.content[0] as { type: string; text: string }).text ?? '')
      .trim()
      .replace(/^["„“”]+|["“”]+$/g, '')

    return NextResponse.json({ nextStep })
  } catch (error) {
    console.error('POST /api/ai/next-step-suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
