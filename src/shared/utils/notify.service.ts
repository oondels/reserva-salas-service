import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface NotifyPayload {
  to: string[];
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async send(payload: NotifyPayload): Promise<void> {
    const url = this.configService.get<string>('NOTIFICATION_SERVICE_URL');
    try {
      await firstValueFrom(this.httpService.post(url!, payload));
    } catch (error) {
      this.logger.error(`Falha ao enviar notificação [${payload.event}]: ${String(error)}`);
    }
  }
}
