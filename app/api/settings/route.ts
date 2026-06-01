import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_WEIGHTS } from '@/lib/criteria'

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      return NextResponse.json({ id: 'singleton', weights: DEFAULT_WEIGHTS })
    }
    return NextResponse.json({ id: settings.id, weights: JSON.parse(settings.weights) })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { weights } = body

    if (!weights || typeof weights !== 'object') {
      return NextResponse.json({ error: 'weights object required' }, { status: 400 })
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { weights: JSON.stringify(weights) },
      create: { id: 'singleton', weights: JSON.stringify(weights) },
    })

    return NextResponse.json({ id: settings.id, weights: JSON.parse(settings.weights) })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
