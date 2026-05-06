export function calculatePayment(
  amountRequested: number,
  deductible: number,
  coverageLimit: number
): number {
  // Apply deductible
  const afterDeductible = Math.max(0, amountRequested - deductible);

  // Apply coverage limit
  const finalAmount = Math.min(afterDeductible, coverageLimit);

  return Math.round(finalAmount * 100) / 100;
}

export function calculateDepreciation(
  originalValue: number,
  ageYears: number,
  depreciationRate: number = 0.1
): number {
  return Math.max(0, originalValue * Math.pow(1 - depreciationRate, ageYears));
}
