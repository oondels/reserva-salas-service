import { PrismaClient, RoomType, Resource, Role } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.room.createMany({
    data: [
      {
        name: 'Sala Alfa',
        type: RoomType.SALA,
        capacity: 10,
        floor: '1º andar',
        resources: [Resource.PROJETOR, Resource.TV],
        restrictedToRoles: [],
        isActive: true,
      },
      {
        name: 'Auditório Principal',
        type: RoomType.AUDITORIO,
        capacity: 200,
        floor: 'Térreo',
        resources: [Resource.PROJETOR, Resource.MICROFONE, Resource.VIDEO_CONFERENCIA],
        restrictedToRoles: [],
        isActive: true,
      },
      {
        name: 'Laboratório de TI',
        type: RoomType.LABORATORIO,
        capacity: 30,
        floor: '3º andar',
        resources: [Resource.TV, Resource.VIDEO_CONFERENCIA],
        restrictedToRoles: [Role.ADMIN, Role.MANAGER],
        isActive: true,
      },
      {
        name: 'Sala Beta',
        type: RoomType.SALA,
        capacity: 6,
        floor: '2º andar',
        resources: [Resource.TV, Resource.FLIPCHART],
        restrictedToRoles: [],
        isActive: true,
      },
      {
        name: 'Sala de Treinamento',
        type: RoomType.SALA,
        capacity: 50,
        floor: '2º andar',
        resources: [Resource.PROJETOR, Resource.MICROFONE, Resource.FLIPCHART],
        restrictedToRoles: [],
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
