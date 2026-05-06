export class CalculatorService {
  calculateMortgage(
    price: number,
    downPayment: number,
    interestRate: number,
    years: number
  ) {
    const principal = price - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = years * 12;

    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = principal / numPayments;
    } else {
      monthlyPayment =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    const totalPayment = monthlyPayment * numPayments;
    const totalInterest = totalPayment - principal;

    return {
      price,
      downPayment,
      principal,
      interestRate,
      years,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
    };
  }
}
