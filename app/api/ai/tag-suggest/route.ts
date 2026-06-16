import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
  const { name, description, existingTags } = body as {
    name?: string
    description?: string
    existingTags?: string[]
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const safeExistingTags = (Array.isArray(existingTags) ? existingTags : [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/[\r\n]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 50)

  const tagHint = safeExistingTags.length
    ? `Prefer reusing existing tags where they fit: ${safeExistingTags.join(', ')}. Coin new ones only when none fit.`
    : 'There are no existing tags yet — create appropriate ones.'

  const systemPrompt = `Du bist ein Assistent für ein Projekt-Priorisierungstool. Schlage 1–3 passende Tags für das Projekt vor.
${tagHint}
Tags sind kurz (1–2 Wörter), prägnant und orthogonal klassifizierend (z.B. "Homelab", "Hardware", "Software", "Outdoor", "Maker").
Antworte NUR mit einem JSON-Array von Strings, kein erklärender Text.
Beispiel: ["Homelab","Hardware"]`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: description?.trim()
            ? `Projektname: ${name.trim()}\n\n${description.trim()}`
            : `Projektname: ${name.trim()}`,
        },
      ],
    })

    const responseText = (message.content[0] as { type: string; text: string }).text
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')
    const parsed = JSON.parse(jsonMatch[0])

    const suggestions = (Array.isArray(parsed) ? parsed : [])
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim())
      .slice(0, 3)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('POST /api/ai/tag-suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
