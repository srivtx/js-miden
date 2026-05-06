import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      email: 'operator@example.com',
      password: 'password123',
      name: 'Logistics Operator',
      role: 'OPERATOR',
    },
  });

  const warehouses = [
    {
      name: 'East Coast Hub',
      address: '500 Port Way',
      city: 'Newark',
      country: 'USA',
      latitude: 40.7357,
      longitude: -74.1724,
      capacity: 10000,
    },
    {
      name: 'Central Hub',
      address: '1000 Logistics Pkwy',
      city: 'Chicago',
      country: 'USA',
      latitude: 41.8781,
      longitude: -87.6298,
      capacity: 15000,
    },
    {
      name: 'West Coast Hub',
      address: '2000 Harbor Blvd',
      city: 'Los Angeles',
      country: 'USA',
      latitude: 34.0522,
      longitude: -118.2437,
      capacity: 12000,
    },
  ];

  for (const warehouse of warehouses) {
    await prisma.warehouse.create({ data: warehouse });
  }

  console.log('Seed data created:');
  console.log(`- Operator: ${user.email}`);
  console.log(`- Warehouses: ${warehouses.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
