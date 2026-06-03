import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const projects = [
  {
    name: 'Pwnagotchi-Workflow',
    status: 'ACTIVE' as const,
    category: 'Security',
    description: 'Automatisierter WiFi-Handshake-Sammler mit Webinterface und Cracking-Pipeline',
    nextStep: 'PCAP-Export nach Hashcat testen',
    scores: { time: 2, material: 1, cost: 1, impact: 3, motivation: 4, learning: 4, dependency: 1, complexity: 3, progress: 2 },
  },
  {
    name: 'Badezimmer Smart Relay',
    status: 'PLANNING' as const,
    category: 'Smart Home',
    description: '433MHz Relais für Badlüfter und Licht, gesteuert via Home Assistant',
    nextStep: 'Schaltplan finalisieren',
    scores: { time: 1, material: 2, cost: 1, impact: 3, motivation: 3, learning: 2, dependency: 2, complexity: 2, progress: 1 },
  },
  {
    name: 'Bibliothekar App',
    status: 'IDEA' as const,
    category: 'Software',
    description: 'Lokale Buchdatenbank mit ISBN-Scanner und Ausleihe-Tracking',
    nextStep: null,
    scores: { time: 3, material: 0, cost: 0, impact: 2, motivation: 3, learning: 3, dependency: 0, complexity: 2, progress: 0 },
  },
  {
    name: 'Solar-First Compute Cluster',
    status: 'IDEA' as const,
    category: 'Homelab',
    description: 'Raspberry Pi Cluster der primär von Solarenergie betrieben wird mit Lastverteilung',
    nextStep: 'Energieverbrauch messen',
    scores: { time: 4, material: 4, cost: 3, impact: 4, motivation: 4, learning: 4, dependency: 2, complexity: 4, progress: 0 },
  },
  {
    name: 'Meshtastic MQTT Gateway',
    status: 'ACTIVE' as const,
    category: 'Networking',
    description: 'LoRa-Mesh-Netz mit MQTT-Bridge zu Home Assistant für offline Kommunikation',
    nextStep: 'Firmware-Update testen',
    scores: { time: 2, material: 2, cost: 2, impact: 4, motivation: 4, learning: 3, dependency: 1, complexity: 3, progress: 2 },
  },
  {
    name: '3D-Drucker Enclosure',
    status: 'PAUSED' as const,
    category: 'Hardware',
    description: 'Schallgedämmte und temperaturgeregelte Einhausung für Bambu X1',
    nextStep: 'Dämmplatten bestellen',
    scores: { time: 3, material: 3, cost: 2, impact: 3, motivation: 2, learning: 1, dependency: 3, complexity: 2, progress: 2 },
  },
]

const defaultWeights = {
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

async function main() {
  console.log('Seeding database...')

  // Reset scores and projects
  await prisma.score.deleteMany()
  await prisma.project.deleteMany()

  for (const p of projects) {
    const { scores, ...projectData } = p
    const project = await prisma.project.create({
      data: projectData,
    })

    const scoreEntries = Object.entries(scores).map(([criterionId, value]) => ({
      projectId: project.id,
      criterionId,
      value,
    }))

    await prisma.score.createMany({ data: scoreEntries })
  }

  // Upsert settings singleton
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: { weights: JSON.stringify(defaultWeights) },
    create: { id: 'singleton', weights: JSON.stringify(defaultWeights) },
  })

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
