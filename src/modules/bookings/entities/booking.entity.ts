import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Room } from '../../rooms/entities/room.entity';
import { AdditionalRequestItem } from '../../additional-requests/entities/additional-request-item.entity';
import { BookingStatus } from '../../../common/enums/booking-status.enum';
import { ParticipantType } from '../../../common/enums/participant-type.enum';
import { InviteStatus } from '../../../common/enums/invite-status.enum';
import { AdditionalStatus } from '../../../common/enums/additional-status.enum';

@Entity({ name: 'bookings', schema: 'rh' })
@Index('idx_bookings_room_status', ['roomId', 'status'])
@Index('idx_bookings_start_end', ['startAt', 'endAt'])
@Index('idx_bookings_user', ['userId'])
@Index('idx_bookings_recurrence_group', ['recurrenceGroupId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'user_name' })
  userName: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ name: 'is_full_day', default: false })
  isFullDay: boolean;

  @Column({ type: 'enum', enum: BookingStatus, enumName: 'rh.BookingStatus', default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @Column({ name: 'recurrence_rule', nullable: true })
  recurrenceRule?: string;

  @Column({ name: 'recurrence_group_id', nullable: true })
  recurrenceGroupId?: string;

  @Column({ name: 'additional_notes', nullable: true })
  additionalNotes?: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy?: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'number_participants', default: 1 })
  numberParticipants: number;

  @Column({
    name: 'participant_type',
    type: 'enum',
    enum: ParticipantType,
    enumName: 'rh.ParticipantType',
    default: ParticipantType.COLABORADOR,
  })
  participantType: ParticipantType;

  @Column({ default: false })
  invites: boolean;

  @Column({ name: 'invite_status', type: 'enum', enum: InviteStatus, enumName: 'rh.InviteStatus', nullable: true })
  inviteStatus?: InviteStatus;

  @Column({
    name: 'additional_items_status',
    type: 'enum',
    enum: AdditionalStatus,
    enumName: 'rh.AdditionalStatus',
    default: AdditionalStatus.PENDING,
    nullable: true,
  })
  additionalItemsStatus?: AdditionalStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Room, (room) => room.bookings)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => AdditionalRequestItem, (item) => item.booking)
  additionalItems: AdditionalRequestItem[];
}
