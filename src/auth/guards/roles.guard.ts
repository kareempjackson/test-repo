import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      return false;
    }

    // Admin has access to everything
    if (user.role === 'admin') {
      return true;
    }

    // 'both' role has access to 'renter' and 'owner' routes
    if (user.role === 'both') {
      return requiredRoles.some(role => ['renter', 'owner', 'both'].includes(role));
    }

    return requiredRoles.includes(user.role);
  }
}
