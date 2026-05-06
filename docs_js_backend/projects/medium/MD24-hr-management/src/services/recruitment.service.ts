import { PrismaClient, ApplicantStatus, InterviewStatus } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

const prisma = new PrismaClient();

export class RecruitmentService {
  async listApplicants() {
    return prisma.applicant.findMany({
      include: {
        interviews: {
          orderBy: { round: 'asc' },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async createApplicant(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    position: string;
    source: string;
  }) {
    return prisma.applicant.create({
      data: {
        ...data,
        status: ApplicantStatus.APPLIED,
      },
    });
  }

  async scheduleInterview(
    applicantId: string,
    data: { scheduledAt: Date; round: number }
  ) {
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
    });

    if (!applicant) {
      throw new AppError(404, 'Applicant not found', 'APPLICANT_NOT_FOUND');
    }

    return prisma.interview.create({
      data: {
        applicantId,
        scheduledAt: data.scheduledAt,
        round: data.round,
        status: InterviewStatus.SCHEDULED,
      },
    });
  }

  async updateStatus(id: string, status: ApplicantStatus) {
    return prisma.applicant.update({
      where: { id },
      data: { status },
    });
  }
}
