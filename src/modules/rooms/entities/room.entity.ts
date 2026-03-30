import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RoomType } from '../../../common/enums/room-type.enum';
import { Resource } from '../../../common/enums/resource.enum';
import { Role } from '../../../common/enums/role.enum';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity({ name: 'rooms', schema: 'rh' })
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: RoomType, enumName: 'rh.RoomType' })
  type: RoomType;

  @Column({ type: 'int' })
  capacity: number;

  @Column()
  floor: string;

  @Column({ type: 'enum', enum: Resource, enumName: 'rh.Resource', array: true })
  resources: Resource[];

  @Column({ type: 'enum', enum: Role, enumName: 'rh.Role', array: true, name: 'restrictedToRoles' })
  restrictedToRoles: Role[];

  @Column({ name: 'isActive', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings: Booking[];
}
