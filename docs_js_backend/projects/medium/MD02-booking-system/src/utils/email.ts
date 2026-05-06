import { config } from '../config.js';

export async function sendBookingConfirmation(params: {
  to: string;
  bookingId: string;
  resourceName: string;
  startTime: Date;
  endTime: Date;
}): Promise<void> {
  // Simulated email sending
  console.log(`[Email Simulation] Sending confirmation to ${params.to}`);
  console.log(`  Booking ID: ${params.bookingId}`);
  console.log(`  Resource: ${params.resourceName}`);
  console.log(`  Time: ${params.startTime.toISOString()} - ${params.endTime.toISOString()}`);
  console.log(`  From: noreply@bookingsystem.com`);
  console.log(`  --- Email sent successfully (simulated) ---`);
}

export async function sendCancellationEmail(params: {
  to: string;
  bookingId: string;
  reason?: string;
}): Promise<void> {
  console.log(`[Email Simulation] Sending cancellation notice to ${params.to}`);
  console.log(`  Booking ID: ${params.bookingId}`);
  console.log(`  Reason: ${params.reason || 'No reason provided'}`);
  console.log(`  --- Email sent successfully (simulated) ---`);
}
