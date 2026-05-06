import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.createMany({
    data: [
      { name: 'Wireless Headphones', sku: 'WH-001', price: 79.99, stock: 50, description: 'Noise cancelling over-ear headphones' },
      { name: 'Mechanical Keyboard', sku: 'KB-001', price: 129.99, stock: 30, description: 'RGB mechanical keyboard with brown switches' },
      { name: 'USB-C Hub', sku: 'HUB-001', price: 39.99, stock: 100, description: '7-in-1 USB-C hub' },
      { name: 'Limited Edition Pin', sku: 'PIN-001', price: 9.99, stock: 1, description: 'Only one left!' },
    ],
    skipDuplicates: true,
  });
  console.log('Seeded products');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
