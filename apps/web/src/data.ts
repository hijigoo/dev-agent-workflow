import type { ApiRoom, Room } from './types'

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
