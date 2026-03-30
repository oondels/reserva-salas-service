import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { AdditionalRequestType } from '../../../common/enums/additional-request-type.enum';
import { AdditionalStatus } from '../../../common/enums/additional-status.enum';

@Entity({ name: 'additional_request_items', schema: 'rh' })
@Index('idx_additional_requests_booking', ['bookingId'])
export class AdditionalRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ type: 'enum', enum: AdditionalRequestType, enumName: 'rh.AdditionalRequestType' })
  type: AdditionalRequestType;

  @Column({ type: 'enum', enum: AdditionalStatus, enumName: 'rh.AdditionalStatus', default: AdditionalStatus.PENDING })
  status: AdditionalStatus;

  @Column({ nullable: true })
  notes?: string;

  @Column({ name: 'prepared_by', nullable: true })
  preparedBy?: string;

  @Column({ name: 'prepared_at', type: 'timestamptz', nullable: true })
  preparedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Booking, (booking) => booking.additionalItems)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
