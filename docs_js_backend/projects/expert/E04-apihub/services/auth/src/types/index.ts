import { Developer, ApiKey } from '@shared/types/index.js';

export interface AuthState {
  developers: Map<string, Developer>;
  apiKeys: Map<string, ApiKey>;
  keyHashes: Map<string, string>;
}

export interface TokenPayload {
  developerId: string;
  email: string;
  iat: number;
  exp: number;
}
