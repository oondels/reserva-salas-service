import { ConflictException } from '@nestjs/common';

export class RoomNotAvailableException extends ConflictException {
  constructor(message = 'A sala não está disponível para o período solicitado') {
    super(message);
  }
}
