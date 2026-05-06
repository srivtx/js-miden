import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create users
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      password: 'password123',
      name: 'John Customer',
      phone: '555-0100',
      role: 'CUSTOMER',
    },
  });

  const owner = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      password: 'password123',
      name: 'Jane Owner',
      phone: '555-0101',
      role: 'RESTAURANT_OWNER',
    },
  });

  const driverUser = await prisma.user.create({
    data: {
      email: 'driver@example.com',
      password: 'password123',
      name: 'Bob Driver',
      phone: '555-0102',
      role: 'DRIVER',
    },
  });

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Pizza Palace',
      description: 'Best pizza in town',
      address: '123 Main St, New York, NY',
      latitude: 40.7128,
      longitude: -74.006,
      cuisine: 'Italian',
      ownerId: owner.id,
      menus: {
        create: [
          {
            name: 'Margherita Pizza',
            description: 'Classic tomato and mozzarella',
            price: 12.99,
            category: 'Pizza',
            inventory: 50,
            isAvailable: true,
          },
          {
            name: 'Pepperoni Pizza',
            description: 'Spicy pepperoni and cheese',
            price: 14.99,
            category: 'Pizza',
            inventory: 30,
            isAvailable: true,
          },
          {
            name: 'Caesar Salad',
            description: 'Fresh romaine with Caesar dressing',
            price: 8.99,
            category: 'Salad',
            inventory: 20,
            isAvailable: true,
          },
        ],
      },
    },
  });

  // Create driver
  await prisma.driver.create({
    data: {
      userId: driverUser.id,
      isAvailable: true,
      latitude: 40.75,
      longitude: -73.98,
    },
  });

  console.log('Seed data created:');
  console.log(`- Customer: ${customer.email}`);
  console.log(`- Restaurant: ${restaurant.name}`);
  console.log(`- Driver: ${driverUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
