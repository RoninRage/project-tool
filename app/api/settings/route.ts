import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_WEIGHTS } from '@/lib/criteria'

const DEFAULT_MATRIX_LABEL_MAX_LENGTH = 20

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    if (!settings) {
      return NextResponse.json({
        id: 'singleton',
        weights: DEFAULT_WEIGHTS,
        matrixLabelMaxLength: DEFAULT_MATRIX_LABEL_MAX_LENGTH,
      })
    }
    return NextResponse.json({
      id: settings.id,
      weights: JSON.parse(settings.weights),
      matrixLabelMaxLength: settings.matrixLabelMaxLength,
    })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { weights, matrixLabelMaxLength } = body

    if (!weights || typeof weights !== 'object') {
      return NextResponse.json({ error: 'weights object required' }, { status: 400 })
    }

    const maxLength =
      typeof matrixLabelMaxLength === 'number' &&
      matrixLabelMaxLength >= 10 &&
      matrixLabelMaxLength <= 40
        ? Math.round(matrixLabelMaxLength)
        : undefined

    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        weights: JSON.stringify(weights),
        ...(maxLength !== undefined && { matrixLabelMaxLength: maxLength }),
      },
      create: {
        id: 'singleton',
        weights: JSON.stringify(weights),
        matrixLabelMaxLength: maxLength ?? DEFAULT_MATRIX_LABEL_MAX_LENGTH,
      },
    })

    return NextResponse.json({
      id: settings.id,
      weights: JSON.parse(settings.weights),
      matrixLabelMaxLength: settings.matrixLabelMaxLength,
    })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
