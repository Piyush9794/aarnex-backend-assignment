import { UserRole } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        branchId: string | null;
      };
    }
  }
}

export {};
