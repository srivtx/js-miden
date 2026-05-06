export function generateQRCodeMock(url: string): string {
  // Simulated QR code generation - returns a data URI placeholder
  const base64 = Buffer.from(url).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
