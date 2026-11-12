export type D1DatabaseType = any;

export interface Env {
  DB: D1DatabaseType;
  FIREBASE_PROJECT_ID?: string;
}

export interface AuthenticatedUser {
  userId: string;
  displayName: string;
}

