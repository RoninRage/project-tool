import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CRITERIA } from '@/lib/criteria'

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
  const { name, scores } = body as {
    name?: string
    scores?: Record<string, number>
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const criteriaLines = CRITERIA.filter((c) => c.id !== 'progress')
    .map((c) => {
      const raw = scores?.[c.id]
      const maxIdx = c.options.length - 1
      const idx =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.max(0, Math.min(maxIdx, Math.round(raw)))
          : 0
      return `- ${c.name}: ${c.options[idx]}`
    })
    .join('\n')

  const systemPrompt = `Du bist Assistent in einem Projektpriorisierungs-Tool. Generiere eine kurze, prägnante Projektbeschreibung auf Deutsch (1–2 Sätze, max. 120 Zeichen). Antworte nur mit dem Beschreibungstext, ohne Anführungszeichen oder Erklärungen.`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Projektname: ${name.trim()}\n\nBewertungen:\n${criteriaLines}`,
        },
      ],
    })

    const description = ((message.content[0] as { type: string; text: string }).text ?? '')
      .trim()
      .replace(/^["„“”]+|["“”]+$/g, '')

    return NextResponse.json({ description })
  } catch (error) {
    console.error('POST /api/ai/describe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
