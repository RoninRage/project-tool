export interface Criterion {
  id: string
  name: string
  description: string
  inverted: boolean
  options: string[]
}

export const CRITERIA: Criterion[] = [
  {
    id: 'time',
    name: 'Zeitaufwand',
    description: 'Wie viel Zeit wird das Projekt benötigen?',
    inverted: true,
    options: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    id: 'material',
    name: 'Materialaufwand',
    description: 'Wie viel Material wird benötigt?',
    inverted: true,
    options: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    id: 'cost',
    name: 'Kosten',
    description: 'Wie hoch sind die Kosten?',
    inverted: true,
    options: ['<10€', '<50€', '<200€', '<500€', '500€+'],
  },
  {
    id: 'impact',
    name: 'Impact / Nutzen',
    description: 'Welchen Nutzen bringt das Projekt?',
    inverted: false,
    options: ['gering', 'niedrig', 'mittel', 'hoch', 'sehr hoch'],
  },
  {
    id: 'motivation',
    name: 'Begeisterung',
    description: 'Wie motiviert bist du für dieses Projekt?',
    inverted: false,
    options: ['kaum', 'wenig', 'ok', 'viel', 'brennt'],
  },
  {
    id: 'learning',
    name: 'Lernpotenzial',
    description: 'Wie viel lernst du dabei?',
    inverted: false,
    options: ['nein', 'kaum', 'etwas', 'viel', 'extrem'],
  },
  {
    id: 'dependency',
    name: 'Externe Abhängigkeit',
    description: 'Wie sehr hängt es von anderen ab?',
    inverted: false,
    options: ['niemand', 'kaum', 'etwas', 'jemand', 'dringend'],
  },
  {
    id: 'complexity',
    name: 'Technische Komplexität',
    description: 'Wie komplex ist die Umsetzung?',
    inverted: true,
    options: ['trivial', 'einfach', 'mittel', 'komplex', 'unklar'],
  },
  {
    id: 'progress',
    name: 'Projektfortschritt',
    description: 'Wie weit ist das Projekt bereits?',
    inverted: false,
    options: ['Idee', 'Gestartet', 'Halbzeit', 'Fast fertig', 'Letzter Schliff'],
  },
]

export const DEFAULT_WEIGHTS: Record<string, number> = {
  time: 1,
  material: 1,
  cost: 1,
  impact: 2,
  motivation: 2,
  learning: 1.5,
  dependency: 1.5,
  complexity: 1,
  progress: 2,
}

export function calculateScore(
  scores: Record<string, number>,
  weights: Record<string, number>
): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const c of CRITERIA) {
    const value = scores[c.id] ?? 0
    const rawScore = c.inverted ? 5 - value : value + 1
    const w = weights[c.id] ?? 1
    weightedSum += rawScore * w
    totalWeight += w
  }
  if (totalWeight === 0) return 0
  return Math.round((weightedSum / (totalWeight * 5)) * 100)
}

export function getScoreColor(score: number): string {
  if (score <= 40) return 'green'
  if (score <= 65) return 'amber'
  return 'blue'
}
