import { prisma } from '../utils/prisma.js';

export class InventoryService {
  async getWarehouseInventory(warehouseId: string) {
    return prisma.inventory.findMany({
      where: { warehouseId },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async updateInventory(warehouseId: string, sku: string, quantity: number) {
    return prisma.inventory.upsert({
      where: {
        warehouseId_sku: {
          warehouseId,
          sku,
        },
      },
      update: { quantity },
      create: {
        warehouseId,
        sku,
        quantity,
      },
    });
  }
}
