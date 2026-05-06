export interface FraudResult {
  score: number;
  flags: string[];
}

export function detectFraud(data: {
  policyId: string;
  incidentDate: Date;
  description: string;
  amountRequested: number;
}): FraudResult {
  const flags: string[] = [];
  let score = 0;

  // Rule 1: High amount relative to typical claims
  if (data.amountRequested > 50000) {
    score += 30;
    flags.push('HIGH_AMOUNT');
  }

  // Rule 2: Claim submitted very quickly after incident
  const daysSinceIncident = Math.floor(
    (new Date().getTime() - data.incidentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceIncident < 1) {
    score += 20;
    flags.push('RAPID_FILING');
  }

  // Rule 3: Suspicious keywords in description
  const suspiciousWords = ['intentional', 'staged', 'deliberate', 'planned accident'];
  const lowerDesc = data.description.toLowerCase();
  if (suspiciousWords.some(word => lowerDesc.includes(word))) {
    score += 40;
    flags.push('SUSPICIOUS_LANGUAGE');
  }

  // Rule 4: Claim filed on weekend (statistically higher fraud)
  const incidentDay = data.incidentDate.getDay();
  if (incidentDay === 0 || incidentDay === 6) {
    score += 10;
    flags.push('WEEKEND_INCIDENT');
  }

  return { score: Math.min(score, 100), flags };
}
