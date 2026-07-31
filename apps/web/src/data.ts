import type { ApiRoom, Room, WorkScenario } from './types'

const roomDisplayMetadata = [
  { floor: '12F · North', status: 'Available' as const, nextAvailable: 'Available all afternoon' },
  { floor: '11F · East', status: 'Available' as const, nextAvailable: 'Available until 16:30' },
  { floor: '12F · West', status: 'Limited' as const, nextAvailable: 'Next opening 15:00' },
  { floor: '10F · Quiet zone', status: 'Available' as const, nextAvailable: 'Available now' },
]

export function toRoomView(room: ApiRoom, index: number): Room {
  const metadata = roomDisplayMetadata[index % roomDisplayMetadata.length]
  return { ...room, ...metadata }
}

export const sampleRooms: Room[] = [
  {
    id: 'demo-aurora',
    name: 'Aurora (Demo)',
    floor: '12F · North',
    capacity: 12,
    equipment: ['Display', 'Whiteboard', 'Video conferencing'],
    status: 'Available',
    nextAvailable: 'Demo availability',
  },
  {
    id: 'demo-cedar',
    name: 'Cedar (Demo)',
    floor: '11F · East',
    capacity: 6,
    equipment: ['Display', 'Whiteboard'],
    status: 'Available',
    nextAvailable: 'Demo availability',
  },
  {
    id: 'demo-orbit',
    name: 'Orbit (Demo)',
    floor: '12F · West',
    capacity: 18,
    equipment: ['Display', 'Whiteboard', 'Video conferencing'],
    status: 'Limited',
    nextAvailable: 'Demo availability',
  },
  {
    id: 'demo-focus-3',
    name: 'Focus 3 (Demo)',
    floor: '10F · Quiet zone',
    capacity: 2,
    equipment: ['Phone booth'],
    status: 'Available',
    nextAvailable: 'Demo availability',
  },
]

export const workScenarios: WorkScenario[] = [
  {
    id: 'upstream-release',
    externalKey: 'cloud-agent:upstream-release',
    label: 'Upstream release adoption',
    description: 'Evaluate a simulated Mini Agent Runtime or Pipeline release.',
    defaultTitle: 'Upgrade the Mini Agent Runtime',
    defaultLabels: ['dependencies', 'cloud-agent'],
  },
  {
    id: 'security-alert',
    externalKey: 'cloud-agent:security-alert',
    label: 'Security alert remediation',
    description: 'Triage and remediate a dependency or platform security alert.',
    defaultTitle: 'Remediate Cloud Agent security alert',
    defaultLabels: ['security', 'cloud-agent'],
  },
  {
    id: 'quality-regression',
    externalKey: 'cloud-agent:quality-regression',
    label: 'E2E quality regression',
    description: 'Investigate a decline in the end-to-end quality score.',
    defaultTitle: 'Investigate E2E quality regression',
    defaultLabels: ['quality', 'e2e'],
  },
  {
    id: 'room-incident',
    externalKey: 'meeting-platform:room-incident',
    label: 'Meeting room incident',
    description: 'Resolve a room display, conferencing, or availability issue.',
    defaultTitle: 'Resolve meeting room service incident',
    defaultLabels: ['operations', 'meeting-room'],
  },
  {
    id: 'automation-improvement',
    externalKey: 'cloud-agent:automation-improvement',
    label: 'Automation improvement',
    description: 'Propose an improvement to agent-driven operational workflows.',
    defaultTitle: 'Improve Cloud Agent operations automation',
    defaultLabels: ['enhancement', 'automation'],
  },
]
