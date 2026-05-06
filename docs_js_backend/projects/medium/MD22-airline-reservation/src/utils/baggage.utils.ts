import { SeatClass } from '@prisma/client';

const BAGGAGE_ALLOWANCE = {
  ECONOMY: 1,
  BUSINESS: 2,
  FIRST: 3,
};

const EXTRA_BAGGAGE_FEE = 50;

export function calculateBaggageFee(classType: SeatClass, baggageCount: number): number {
  const allowance = BAGGAGE_ALLOWANCE[classType] || 1;
  const extraBags = Math.max(0, baggageCount - allowance);
  return extraBags * EXTRA_BAGGAGE_FEE;
}

export function getMaxBaggageWeight(classType: SeatClass): number {
  switch (classType) {
    case 'FIRST':
      return 32;
    case 'BUSINESS':
      return 28;
    case 'ECONOMY':
    default:
      return 23;
  }
}
