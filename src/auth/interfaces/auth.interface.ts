export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
}
