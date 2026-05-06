import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const riderUser = await prisma.user.create({
    data: {
      email: 'rider@example.com',
      password: 'password123',
      name: 'John Rider',
      phone: '555-0200',
      role: 'RIDER',
    },
  });

  const rider = await prisma.rider.create({
    data: { userId: riderUser.id },
  });

  const driverUser = await prisma.user.create({
    data: {
      email: 'driver@example.com',
      password: 'password123',
      name: 'Jane Driver',
      phone: '555-0201',
      role: 'DRIVER',
    },
  });

  const driver = await prisma.driver.create({
    data: {
      userId: driverUser.id,
      isAvailable: true,
      latitude: 40.758,
      longitude: -73.9855,
      vehicleType: 'Toyota Camry',
      licensePlate: 'NYC-1234',
    },
  });

  console.log('Seed data created:');
  console.log(`- Rider: ${riderUser.email}`);
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
