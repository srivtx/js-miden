import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const agent = await prisma.user.create({
    data: {
      email: 'agent@example.com',
      password: 'password123',
      name: 'Jane Agent',
      phone: '555-0300',
      role: 'AGENT',
    },
  });

  const listings = [
    {
      title: 'Beautiful Family Home',
      address: '123 Oak Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      price: 450000,
      beds: 4,
      baths: 3,
      sqft: 2400,
      latitude: 30.2672,
      longitude: -97.7431,
      propertyType: 'HOUSE',
      status: 'ACTIVE',
      agentId: agent.id,
    },
    {
      title: 'Modern Downtown Condo',
      address: '456 Main Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78704',
      price: 350000,
      beds: 2,
      baths: 2,
      sqft: 1200,
      latitude: 30.261,
      longitude: -97.74,
      propertyType: 'APARTMENT',
      status: 'ACTIVE',
      agentId: agent.id,
    },
  ];

  for (const listing of listings) {
    await prisma.listing.create({ data: listing });
  }

  console.log('Seed data created:');
  console.log(`- Agent: ${agent.email}`);
  console.log(`- Listings: ${listings.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
