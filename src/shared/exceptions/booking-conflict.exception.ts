import { ConflictException } from '@nestjs/common';

export class BookingConflictException extends ConflictException {
  constructor(message = 'Conflito de horário: a sala já está reservada neste período') {
    super(message);
  }
}
