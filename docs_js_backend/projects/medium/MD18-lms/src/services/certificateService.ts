import { prisma } from '../utils/prisma.js';

export class CertificateService {
  async getCertificate(id: string) {
    return prisma.certificate.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });
  }

  async getUserCertificates(userId: string) {
    return prisma.certificate.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async issueCertificate(userId: string, courseId: string) {
    // Check if user completed the course
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId,
        courseId,
      },
    });

    if (!enrollment || enrollment.status !== 'COMPLETED') {
      throw new Error('Course not completed');
    }

    return prisma.certificate.create({
      data: {
        userId,
        courseId,
      },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }
}
