import type { ApiRoom, Room, WorkScenario } from './types'

const roomDisplayMetadata = [
  { floor: '12층 · 북측', status: 'Available' as const, nextAvailable: '오후 내내 이용 가능' },
  { floor: '11층 · 동측', status: 'Available' as const, nextAvailable: '16:30까지 이용 가능' },
  { floor: '12층 · 서측', status: 'Limited' as const, nextAvailable: '다음 가능 시간 15:00' },
  { floor: '10층 · 집중 구역', status: 'Available' as const, nextAvailable: '지금 이용 가능' },
]

export function toRoomView(room: ApiRoom, index: number): Room {
  const metadata = roomDisplayMetadata[index % roomDisplayMetadata.length]
  return { ...room, ...metadata }
}

export const sampleRooms: Room[] = [
  {
    id: 'demo-aurora',
    name: '오로라(데모)',
    floor: '12층 · 북측',
    capacity: 12,
    equipment: ['Display', 'Whiteboard', 'Video conferencing'],
    status: 'Available',
    nextAvailable: '데모 이용 가능',
  },
  {
    id: 'demo-cedar',
    name: '시더(데모)',
    floor: '11층 · 동측',
    capacity: 6,
    equipment: ['Display', 'Whiteboard'],
    status: 'Available',
    nextAvailable: '데모 이용 가능',
  },
  {
    id: 'demo-orbit',
    name: '오르빗(데모)',
    floor: '12층 · 서측',
    capacity: 18,
    equipment: ['Display', 'Whiteboard', 'Video conferencing'],
    status: 'Limited',
    nextAvailable: '데모 이용 가능',
  },
  {
    id: 'demo-focus-3',
    name: '포커스 3(데모)',
    floor: '10층 · 집중 구역',
    capacity: 2,
    equipment: ['Phone booth'],
    status: 'Available',
    nextAvailable: '데모 이용 가능',
  },
]

export const workScenarios: WorkScenario[] = [
  {
    id: 'security-alert',
    externalKey: 'cloud-agent:security-alert',
    label: '보안 알림 대응',
    description: '의존성 또는 플랫폼 보안 알림을 분류하고 대응합니다.',
    defaultTitle: '클라우드 에이전트 보안 알림 대응',
    defaultLabels: ['security', 'cloud-agent'],
  },
  {
    id: 'quality-regression',
    externalKey: 'cloud-agent:quality-regression',
    label: 'E2E 품질 회귀',
    description: '종단간 품질 점수 하락 원인을 조사합니다.',
    defaultTitle: 'E2E 품질 회귀 조사',
    defaultLabels: ['quality', 'e2e'],
  },
  {
    id: 'room-incident',
    externalKey: 'meeting-platform:room-incident',
    label: '회의실 장애',
    description: '회의실 디스플레이, 화상 회의, 이용 가능 상태 문제를 해결합니다.',
    defaultTitle: '회의실 서비스 장애 해결',
    defaultLabels: ['operations', 'meeting-room'],
  },
  {
    id: 'automation-improvement',
    externalKey: 'cloud-agent:automation-improvement',
    label: '자동화 개선',
    description: '에이전트 기반 운영 워크플로 개선안을 제안합니다.',
    defaultTitle: '클라우드 에이전트 운영 자동화 개선',
    defaultLabels: ['enhancement', 'automation'],
  },
]
