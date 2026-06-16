import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateScore, DEFAULT_WEIGHTS, getProgressValue } from '@/lib/criteria'

function sanitizeUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  } catch {}
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [project, settings] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        include: {
          scores: true,
          history: { orderBy: { createdAt: 'asc' } },
          tasks: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.settings.findUnique({ where: { id: 'singleton' } }),
    ])

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const weights = settings ? JSON.parse(settings.weights) : DEFAULT_WEIGHTS
    const scoreMap: Record<string, number> = {}
    for (const s of project.scores) {
      scoreMap[s.criterionId] = s.value
    }
    scoreMap['progress'] = getProgressValue(project.tasks)

    return NextResponse.json({
      ...project,
      tags: JSON.parse(project.tags),
      computedScore: calculateScore(scoreMap, weights),
    })
  } catch (error) {
    console.error('GET /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status, tags, nextStep, projectLink, scores, completedAt, closingNote } = body

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          description: description !== undefined ? description || null : existing.description,
          status: status ?? existing.status,
          tags: tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags,
          nextStep: nextStep !== undefined ? nextStep || null : existing.nextStep,
          projectLink: projectLink !== undefined ? sanitizeUrl(projectLink) : existing.projectLink,
          completedAt: completedAt !== undefined ? (completedAt ? new Date(completedAt) : null) : existing.completedAt,
          closingNote: closingNote !== undefined ? closingNote || null : existing.closingNote,
        },
      })

      if (scores && typeof scores === 'object') {
        await tx.score.deleteMany({ where: { projectId: id } })
        const scoreEntries = Object.entries(scores as Record<string, number>)
          .filter(([criterionId]) => criterionId !== 'progress')
          .map(([criterionId, value]) => ({
            projectId: id,
            criterionId,
            value: Number(value),
          }))
        if (scoreEntries.length > 0) {
          await tx.score.createMany({ data: scoreEntries })
        }
      }

      return tx.project.findUnique({
        where: { id },
        include: {
          scores: true,
          tasks: { orderBy: { order: 'asc' } },
        },
      })
    })

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const weights = settings ? JSON.parse(settings.weights) : DEFAULT_WEIGHTS
    const scoreMap: Record<string, number> = {}
    for (const s of project!.scores) {
      scoreMap[s.criterionId] = s.value
    }
    scoreMap['progress'] = getProgressValue(project!.tasks ?? [])

    const computed = calculateScore(scoreMap, weights)

    await prisma.scoreHistory.create({
      data: { projectId: id, score: computed },
    })

    return NextResponse.json({
      ...project,
      tags: JSON.parse(project!.tags),
      computedScore: computed,
    })
  } catch (error) {
    console.error('PUT /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/projects/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
