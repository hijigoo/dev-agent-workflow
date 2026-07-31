import type { ApiRoom, Room } from './types'

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
