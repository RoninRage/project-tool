import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CRITERIA } from '@/lib/criteria'

const SYSTEM_PROMPT = `Du bist ein Assistent für ein Projekt-Priorisierungstool. Analysiere die Projektbeschreibung und wähle für jedes Kriterium den passendsten Index (0–4).
Antworte NUR mit einem JSON-Objekt, kein erklärender Text davor oder danach.

Kriterien (invertiert = höherer Index ist schlechter):
- time (Zeitaufwand, invertiert): 0=XS 1=S 2=M 3=L 4=XL
- material (Materialaufwand, invertiert): 0=XS 1=S 2=M 3=L 4=XL
- cost (Kosten, invertiert): 0=<10€ 1=<50€ 2=<200€ 3=<500€ 4=500€+
- impact (Impact/Nutzen): 0=gering 1=niedrig 2=mittel 3=hoch 4=sehr hoch
- motivation (Begeisterung): 0=kaum 1=wenig 2=ok 3=viel 4=brennt
- learning (Lernpotenzial): 0=nein 1=kaum 2=etwas 3=viel 4=extrem
- dependency (Externe Abhängigkeit): 0=niemand 1=kaum 2=etwas 3=jemand 4=dringend
- complexity (Technische Komplexität, invertiert): 0=trivial 1=einfach 2=mittel 3=komplex 4=unklar

Beispielantwort: {"time":2,"material":0,"cost":1,"impact":3,"motivation":4,"learning":2,"dependency":0,"complexity":1}`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { text, name } = body as { text?: string; name?: string }
  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: name?.trim()
            ? `Projektname: ${name.trim()}\n\n${text.trim()}`
            : text.trim(),
        },
      ],
    })

    let raw = (message.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown code fences if Haiku wraps the response
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(raw)

    const validIds = new Set(CRITERIA.filter((c) => c.id !== 'progress').map((c) => c.id))
    const suggestions: Record<string, number> = {}
    for (const [id, val] of Object.entries(parsed)) {
      if (validIds.has(id) && typeof val === 'number' && val >= 0 && val <= 4) {
        suggestions[id] = Math.round(val)
      }
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('POST /api/ai/score-suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
