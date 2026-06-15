import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { calculateScore, DEFAULT_WEIGHTS, getProgressValue } from '@/lib/criteria'

const PROGRESS_LABELS = ['Idee', 'Gestartet', 'Halbzeit', 'Fast fertig', 'Letzter Schliff']

export async function GET() {
  try {
    const [projects, settings] = await Promise.all([
      prisma.project.findMany({
        where: { status: { not: 'DONE' } },
        include: {
          scores: true,
          tasks: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.settings.findUnique({ where: { id: 'singleton' } }),
    ])

    if (projects.length < 3) {
      return NextResponse.json({ error: 'Not enough projects' }, { status: 422 })
    }

    const weights = settings ? JSON.parse(settings.weights) : DEFAULT_WEIGHTS

    // Pick a random non-DONE project
    const project = projects[Math.floor(Math.random() * projects.length)]

    const scoreMap: Record<string, number> = {}
    for (const s of project.scores) scoreMap[s.criterionId] = s.value
    scoreMap['progress'] = getProgressValue(project.tasks)
    const computedScore = calculateScore(scoreMap, weights)

    // Build task progress context
    const taskCount = project.tasks.length
    const doneCount = project.tasks.filter((t) => t.done).length
    const progressLabel = PROGRESS_LABELS[getProgressValue(project.tasks)]

    const taskContext =
      taskCount > 0
        ? `Task progress: ${doneCount} of ${taskCount} tasks completed (${Math.round((doneCount / taskCount) * 100)}%). Finishing Energy: ${progressLabel}.`
        : 'No tasks defined yet.'

    const promptLines = [
      `Project: ${project.name}`,
      project.description ? `Description: ${project.description}` : null,
      `Status: ${project.status}`,
      project.tags ? `Tags: ${JSON.parse(project.tags).join(', ')}` : null,
      project.nextStep ? `Next step: ${project.nextStep}` : null,
      `Score: ${computedScore}/100`,
      taskContext,
    ]
      .filter(Boolean)
      .join('\n')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: `You are helping someone decide which project to focus on. Write exactly ONE short motivating sentence (max 20 words) about why to work on this project right now. Be specific and direct — mention concrete details like task progress or next steps if relevant. Do not start with "I" or "You".\n\n${promptLines}`,
        },
      ],
    })

    const context = (message.content[0] as { type: string; text: string }).text.trim()

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        tags: JSON.parse(project.tags),
        nextStep: project.nextStep,
        computedScore,
        tasks: project.tasks,
      },
      context,
    })
  } catch (error) {
    console.error('GET /api/projects/roulette error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
