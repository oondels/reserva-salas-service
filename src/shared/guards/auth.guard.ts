import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly tokenCache = new Map<string, { user: unknown; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação não fornecido');
    }

    const token = authHeader.substring(7);

    const cached = this.tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      request.user = cached.user;
      return true;
    }

    const authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL');

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${authServiceUrl}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      const user = response.data;
      this.tokenCache.set(token, { user, expiresAt: Date.now() + 60_000 });
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
