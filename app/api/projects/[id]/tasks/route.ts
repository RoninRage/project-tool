import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_TASKS = 25
const MAX_TEXT_LEN = 200

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('GET /api/projects/[id]/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (text.trim().length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { error: `text must be at most ${MAX_TEXT_LEN} characters` },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const count = await prisma.task.count({ where: { projectId: id } })
    if (count >= MAX_TASKS) {
      return NextResponse.json(
        { error: `A project may have at most ${MAX_TASKS} tasks` },
        { status: 422 }
      )
    }

    const aggregate = await prisma.task.aggregate({
      where: { projectId: id },
      _max: { order: true },
    })
    const nextOrder = (aggregate._max.order ?? -1) + 1

    const task = await prisma.task.create({
      data: { projectId: id, text: text.trim(), order: nextOrder },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('POST /api/projects/[id]/tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
