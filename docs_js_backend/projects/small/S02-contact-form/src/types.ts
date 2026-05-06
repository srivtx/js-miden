export interface ContactRequest {
  name: string;
  email: string;
  message: string;
  website?: string; // honeypot field
}
