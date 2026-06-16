import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateScore, DEFAULT_WEIGHTS, getProgressValue } from '@/lib/criteria'
import { sanitizeUrl } from '@/lib/url-utils'

export async function GET() {
  try {
    const [projects, settings] = await Promise.all([
      prisma.project.findMany({
        include: {
          scores: true,
          tasks: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.settings.findUnique({ where: { id: 'singleton' } }),
    ])

    const weights = settings ? JSON.parse(settings.weights) : DEFAULT_WEIGHTS

    const projectsWithScores = projects.map((project) => {
      const scoreMap: Record<string, number> = {}
      for (const s of project.scores) {
        scoreMap[s.criterionId] = s.value
      }
      scoreMap['progress'] = getProgressValue(project.tasks)
      return {
        ...project,
        tags: JSON.parse(project.tags),
        computedScore: calculateScore(scoreMap, weights),
      }
    })

    projectsWithScores.sort((a, b) => (b.computedScore ?? 0) - (a.computedScore ?? 0))

    return NextResponse.json(projectsWithScores)
  } catch (error) {
    console.error('GET /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, status, tags, nextStep, projectLink, scores, completedAt, closingNote } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          description: description || null,
          status: status || 'IDEA',
          tags: JSON.stringify(Array.isArray(tags) ? tags : []),
          nextStep: nextStep || null,
          projectLink: sanitizeUrl(projectLink),
          completedAt: completedAt ? new Date(completedAt) : null,
          closingNote: closingNote || null,
        },
      })

      if (scores && typeof scores === 'object') {
        const scoreEntries = Object.entries(scores as Record<string, number>)
          .filter(([criterionId]) => criterionId !== 'progress')
          .map(([criterionId, value]) => ({
            projectId: created.id,
            criterionId,
            value: Number(value),
          }))
        await tx.score.createMany({ data: scoreEntries })
      }

      return tx.project.findUnique({
        where: { id: created.id },
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
      data: { projectId: project!.id, score: computed },
    })

    return NextResponse.json({ ...project, tags: JSON.parse(project!.tags), computedScore: computed }, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
