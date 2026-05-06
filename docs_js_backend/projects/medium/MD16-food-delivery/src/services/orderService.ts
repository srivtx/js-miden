import { prisma } from '../utils/prisma.js';
import { OrderStatus } from '@prisma/client';

interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  items: { menuId: string; quantity: number }[];
  address: string;
  latitude: number;
  longitude: number;
}

export class OrderService {
  async createOrder(data: CreateOrderInput) {
    // BUG: No inventory check - restaurant can accept orders for sold-out items
    const menuItems = await prisma.menu.findMany({
      where: {
        id: { in: data.items.map((item) => item.menuId) },
        restaurantId: data.restaurantId,
      },
    });

    if (menuItems.length !== data.items.length) {
      throw new Error('Some menu items not found');
    }

    let total = 0;
    const orderItems = data.items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuId);
      if (!menuItem) throw new Error(`Menu item ${item.menuId} not found`);
      // BUG: No inventory validation - allows ordering sold-out items
      total += Number(menuItem.price) * item.quantity;
      return {
        menuId: item.menuId,
        quantity: item.quantity,
        price: menuItem.price,
      };
    });

    return prisma.order.create({
      data: {
        customerId: data.customerId,
        restaurantId: data.restaurantId,
        status: OrderStatus.PLACED,
        total,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: { include: { menu: true } },
        restaurant: true,
      },
    });
  }

  async getOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { menu: true } },
        restaurant: true,
        driver: { include: { user: true } },
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
  }

  async getOrdersByCustomer(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      include: {
        restaurant: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    return prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  // BUG: Race condition - two drivers can accept the same order simultaneously
  async assignDriver(orderId: string, driverId: string) {
    // Check if order already has a driver
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.driverId) {
      throw new Error('Order already assigned to a driver');
    }

    // BUG: Race condition here! Between the check above and the update below,
    // another driver could have already been assigned
    // No atomic operation or locking is used

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: OrderStatus.PICKED_UP,
      },
      include: {
        driver: { include: { user: true } },
        restaurant: true,
      },
    });

    // Mark driver as unavailable
    await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable: false },
    });

    return updatedOrder;
  }
}
