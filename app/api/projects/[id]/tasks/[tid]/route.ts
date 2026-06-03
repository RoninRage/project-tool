import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_TEXT_LEN = 200

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  try {
    const { id, tid } = await params
    const body = await request.json()
    const { text, done, order } = body

    const existing = await prisma.task.findUnique({ where: { id: tid } })
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (text !== undefined) {
      if (typeof text !== 'string' || !text.trim()) {
        return NextResponse.json({ error: 'text must be a non-empty string' }, { status: 400 })
      }
      if (text.trim().length > MAX_TEXT_LEN) {
        return NextResponse.json(
          { error: `text must be at most ${MAX_TEXT_LEN} characters` },
          { status: 400 }
        )
      }
      data.text = text.trim()
    }

    if (done !== undefined) {
      if (typeof done !== 'boolean') {
        return NextResponse.json({ error: 'done must be a boolean' }, { status: 400 })
      }
      data.done = done
    }

    if (order !== undefined) {
      if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) {
        return NextResponse.json({ error: 'order must be a non-negative integer' }, { status: 400 })
      }
      data.order = order
    }

    const task = await prisma.task.update({ where: { id: tid }, data })

    // Touch project.updatedAt when done state changes so score history reflects the activity
    if (done !== undefined && done !== existing.done) {
      await prisma.project.update({
        where: { id },
        data: { updatedAt: new Date() },
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('PATCH /api/projects/[id]/tasks/[tid] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  try {
    const { id, tid } = await params
    const existing = await prisma.task.findUnique({ where: { id: tid } })
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await prisma.task.delete({ where: { id: tid } })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('DELETE /api/projects/[id]/tasks/[tid] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
