import type { Project, Score } from '@prisma/client'

export type Status = 'IDEA' | 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'DONE'

export interface ScoreHistoryEntry {
  id: string
  score: number
  createdAt: string
}

export interface TaskItem {
  id: string
  text: string
  done: boolean
  order: number
}

export interface ProjectWithScores extends Omit<Project, 'status'> {
  status: Status
  scores: Score[]
  computedScore?: number
  history?: ScoreHistoryEntry[]
  tasks?: TaskItem[]
}

export interface ScoreMap {
  [criterionId: string]: number
}

export interface WeightsMap {
  [criterionId: string]: number
}
