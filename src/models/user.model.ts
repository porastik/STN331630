export type UserRole = 'Administrator' | 'Revizor' | 'Užívateľ';

export interface User {
  id: string;
  username: string;
  password?: string; // Should not be stored long-term, just for mock login
  role: UserRole;
  fullName: string;
  email: string;
}