import { differenceInDays } from 'date-fns';

export function calculateRefund(
  totalPrice: number,
  policy: string,
  checkIn: Date
): number {
  const daysUntilCheckIn = differenceInDays(checkIn, new Date());

  switch (policy) {
    case 'FLEXIBLE':
      return daysUntilCheckIn >= 1 ? totalPrice : 0;
    case 'STANDARD':
      return daysUntilCheckIn >= 3 ? totalPrice : daysUntilCheckIn >= 1 ? totalPrice * 0.5 : 0;
    case 'STRICT':
      return daysUntilCheckIn >= 7 ? totalPrice : 0;
    default:
      return daysUntilCheckIn >= 3 ? totalPrice : 0;
  }
}

export function calculatePriceWithTiers(
  basePrice: number,
  checkIn: Date,
  checkOut: Date,
  tiers: { startDate: Date; endDate: Date; multiplier: number }[]
): number {
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  let total = 0;

  for (let i = 0; i < nights; i++) {
    const date = new Date(checkIn);
    date.setDate(date.getDate() + i);

    const applicableTier = tiers.find(
      t => date >= t.startDate && date <= t.endDate
    );

    total += basePrice * (applicableTier?.multiplier || 1);
  }

  return total;
}
