import { prisma } from '../db.js';

export async function getProducts() {
  return prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
  return product;
}

export async function getProductBySku(sku: string) {
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'NOT_FOUND' });
  return product;
}

export async function updateStock(productId: string, quantity: number) {
  return prisma.product.update({
    where: { id: productId },
    data: { stock: { increment: quantity } },
  });
}
