import type { Project, Score } from '@prisma/client'

export type Status = 'IDEA' | 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'DONE'

export interface ScoreHistoryEntry {
  id: string
  score: number
  createdAt: string
}

export interface ProjectWithScores extends Omit<Project, 'status'> {
  status: Status
  scores: Score[]
  computedScore?: number
  history?: ScoreHistoryEntry[]
}

export interface ScoreMap {
  [criterionId: string]: number
}

export interface WeightsMap {
  [criterionId: string]: number
}
