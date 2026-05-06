import { prisma } from '../utils/prisma.js';

export class AgentService {
  async getAllAgents() {
    return prisma.agent.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  }

  async getAgentById(id: string) {
    return prisma.agent.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  }

  async matchAgent(lat: number, lng: number) {
    const agents = await prisma.agent.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    // Sort by distance
    const sorted = agents
      .filter((a) => a.latitude && a.longitude)
      .map((agent) => ({
        ...agent,
        distance: this.calculateDistance(lat, lng, agent.latitude!, agent.longitude!),
      }))
      .sort((a, b) => a.distance - b.distance);

    return sorted[0] || null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
