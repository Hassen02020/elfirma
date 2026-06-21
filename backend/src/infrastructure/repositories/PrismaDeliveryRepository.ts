import { Delivery, Prisma } from '@prisma/client';
import prisma from '../database/prisma-client';
import { IDeliveryRepository } from '../../core/repositories/IDeliveryRepository';

export class PrismaDeliveryRepository implements IDeliveryRepository {
  async create(data: Prisma.DeliveryCreateInput): Promise<Delivery> {
    return prisma.delivery.create({ data });
  }

  async findById(id: number): Promise<Delivery | null> {
    return prisma.delivery.findUnique({
      where: { id },
      include: {
        camion: true,
        chauffeur: true,
        caisses: true,
        pesees: true,
      },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.DeliveryWhereInput;
    orderBy?: Prisma.DeliveryOrderByWithRelationInput;
  }): Promise<Delivery[]> {
    return prisma.delivery.findMany({
      skip: params?.skip,
      take: params?.take,
      where: params?.where,
      orderBy: params?.orderBy,
      include: {
        camion: true,
        chauffeur: true,
      },
    });
  }

  async update(id: number, data: Prisma.DeliveryUpdateInput): Promise<Delivery> {
    return prisma.delivery.update({
      where: { id },
      data,
      include: {
        camion: true,
        chauffeur: true,
      },
    });
  }

  async delete(id: number): Promise<Delivery> {
    return prisma.delivery.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.DeliveryWhereInput): Promise<number> {
    return prisma.delivery.count({ where });
  }

  async findByChauffeurId(chauffeurId: number): Promise<Delivery[]> {
    return prisma.delivery.findMany({
      where: { chauffeurId },
      include: {
        camion: true,
        chauffeur: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Delivery[]> {
    return prisma.delivery.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        camion: true,
        chauffeur: true,
      },
      orderBy: { date: 'desc' },
    });
  }
}
