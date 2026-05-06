import { UserRole } from '@prisma/client';

export class UserResponseDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export class AuthResponseDto {
  user: UserResponseDto;
  accessToken: string;
  tokenType: string;
}
