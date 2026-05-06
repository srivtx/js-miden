import { prisma } from '../utils/prisma.js';

export class RouteService {
  async createRoute(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { origin: true, destination: true },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    // Get all warehouses
    const warehouses = await prisma.warehouse.findMany();

    // BUG: Simple greedy algorithm that can create circular routes
    // It might route through the same warehouse multiple times
    const routeNodes = this.calculateRoute(
      shipment.origin,
      shipment.destination,
      warehouses
    );

    const totalDistance = routeNodes.reduce((sum, node) => sum + node.distanceKm, 0);

    const route = await prisma.route.create({
      data: {
        shipmentId,
        totalDistance,
        estimatedDays: Math.ceil(totalDistance / 800), // ~800 km per day
        nodes: {
          create: routeNodes.map((node, index) => ({
            warehouseId: node.warehouseId,
            sequence: index,
            distanceKm: node.distanceKm,
          })),
        },
      },
      include: {
        nodes: {
          include: { warehouse: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    return route;
  }

  async getRouteByShipmentId(shipmentId: string) {
    return prisma.route.findUnique({
      where: { shipmentId },
      include: {
        nodes: {
          include: { warehouse: true },
          orderBy: { sequence: 'asc' },
        },
        shipment: true,
      },
    });
  }

  async optimizeRoute(id: string) {
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        nodes: {
          include: { warehouse: true },
          orderBy: { sequence: 'asc' },
        },
        shipment: {
          include: { origin: true, destination: true },
        },
      },
    });

    if (!route) {
      throw new Error('Route not found');
    }

    // BUG: "Optimization" that doesn't actually prevent circular routes
    // It just removes consecutive duplicates but can still create loops
    const optimizedNodes = this.removeConsecutiveDuplicates(route.nodes);

    await prisma.routeNode.deleteMany({
      where: { routeId: id },
    });

    const totalDistance = optimizedNodes.reduce((sum, node) => sum + node.distanceKm, 0);

    await prisma.route.update({
      where: { id },
      data: {
        totalDistance,
        optimized: true,
        nodes: {
          create: optimizedNodes.map((node, index) => ({
            warehouseId: node.warehouseId,
            sequence: index,
            distanceKm: node.distanceKm,
          })),
        },
      },
    });

    return prisma.route.findUnique({
      where: { id },
      include: {
        nodes: {
          include: { warehouse: true },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  // BUG: This algorithm can create circular routes
  private calculateRoute(
    origin: any,
    destination: any,
    warehouses: any[]
  ): Array<{ warehouseId: string; distanceKm: number }> {
    const nodes: Array<{ warehouseId: string; distanceKm: number }> = [];
    
    // Start at origin
    let current = origin;
    nodes.push({ warehouseId: origin.id, distanceKm: 0 });

    // Greedy nearest neighbor - can loop back
    const visited = new Set([origin.id]);
    const maxHops = 5;

    for (let i = 0; i < maxHops; i++) {
      // Find nearest warehouse
      let nearest = null;
      let minDist = Infinity;

      for (const wh of warehouses) {
        if (visited.has(wh.id)) continue;
        
        const dist = this.calculateDistance(
          current.latitude,
          current.longitude,
          wh.latitude,
          wh.longitude
        );

        if (dist < minDist) {
          minDist = dist;
          nearest = wh;
        }
      }

      if (!nearest) break;

      // BUG: No check if we're moving away from destination
      // Could route through a warehouse that sends us back
      nodes.push({ warehouseId: nearest.id, distanceKm: minDist });
      visited.add(nearest.id);
      current = nearest;

      // If we're close to destination, break
      const distToDest = this.calculateDistance(
        current.latitude,
        current.longitude,
        destination.latitude,
        destination.longitude
      );

      if (distToDest < 100) break; // Within 100km
    }

    // Add destination
    const finalDist = this.calculateDistance(
      current.latitude,
      current.longitude,
      destination.latitude,
      destination.longitude
    );
    nodes.push({ warehouseId: destination.id, distanceKm: finalDist });

    return nodes;
  }

  private removeConsecutiveDuplicates(nodes: any[]): any[] {
    const result = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].warehouseId !== nodes[i - 1].warehouseId) {
        result.push(nodes[i]);
      }
    }
    return result;
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
