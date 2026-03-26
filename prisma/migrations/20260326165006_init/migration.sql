-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "rh";

-- CreateEnum
CREATE TYPE "rh"."RoomType" AS ENUM ('SALA', 'AUDITORIO', 'LABORATORIO');

-- CreateEnum
CREATE TYPE "rh"."Resource" AS ENUM ('PROJETOR', 'TV', 'VIDEO_CONFERENCIA', 'MICROFONE', 'FLIPCHART');

-- CreateEnum
CREATE TYPE "rh"."Role" AS ENUM ('COLLABORATOR', 'MANAGER', 'FACILITIES', 'ADMIN');

-- CreateEnum
CREATE TYPE "rh"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "rh"."AdditionalRequestType" AS ENUM ('CAFE_SIMPLES', 'LANCHE', 'COMPLETO', 'PERSONALIZADO', 'EQUIPAMENTO_EXTRA');

-- CreateEnum
CREATE TYPE "rh"."AdditionalStatus" AS ENUM ('PENDING', 'PREPARED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "rh"."InviteStatus" AS ENUM ('ENTREGUE', 'NAO_ENTREGUE', 'PENDENTE');

-- CreateEnum
CREATE TYPE "rh"."ParticipantType" AS ENUM ('AUXILIAR', 'LIDER', 'COORDENADOR', 'GERENTE', 'NOVO_COLABORADOR', 'AREA_APOIO', 'COLABORADOR', 'APREDIZ', 'LIDERES_E_COORDENADORES', 'MECANICOS', 'COLABORADORES_ESPECIFICOS', 'PROCESSO_SELETIVO', 'VISISTAS', 'GESTANTES', 'J9VEM_APRENDIZES', 'CIPISTAS');

-- CreateTable
CREATE TABLE "rh"."rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "rh"."RoomType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "floor" TEXT NOT NULL,
    "resources" "rh"."Resource"[],
    "restrictedToRoles" "rh"."Role"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."bookings" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "is_full_day" BOOLEAN NOT NULL DEFAULT false,
    "status" "rh"."BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "recurrence_rule" TEXT,
    "recurrence_group_id" TEXT,
    "additional_notes" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "number_participants" INTEGER NOT NULL DEFAULT 1,
    "participant_type" "rh"."ParticipantType" NOT NULL DEFAULT 'COLABORADOR',
    "invites" BOOLEAN NOT NULL DEFAULT false,
    "invite_status" "rh"."InviteStatus",
    "additional_items_status" "rh"."AdditionalStatus" DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rh"."additional_request_items" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "type" "rh"."AdditionalRequestType" NOT NULL,
    "status" "rh"."AdditionalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "prepared_by" TEXT,
    "prepared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "additional_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bookings_room_status" ON "rh"."bookings"("room_id", "status");

-- CreateIndex
CREATE INDEX "idx_bookings_start_end" ON "rh"."bookings"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "idx_bookings_user" ON "rh"."bookings"("user_id");

-- CreateIndex
CREATE INDEX "idx_bookings_recurrence_group" ON "rh"."bookings"("recurrence_group_id");

-- CreateIndex
CREATE INDEX "idx_additional_requests_booking" ON "rh"."additional_request_items"("booking_id");

-- AddForeignKey
ALTER TABLE "rh"."bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rh"."rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rh"."additional_request_items" ADD CONSTRAINT "additional_request_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "rh"."bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
