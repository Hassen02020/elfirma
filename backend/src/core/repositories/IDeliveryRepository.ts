import { Delivery, Prisma } from '@prisma/client';

export interface IDeliveryRepository {
  create(data: Prisma.DeliveryCreateInput): Promise<Delivery>;
  findById(id: number): Promise<Delivery | null>;
  findAll(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.DeliveryWhereInput;
    orderBy?: Prisma.DeliveryOrderByWithRelationInput;
  }): Promise<Delivery[]>;
  update(id: number, data: Prisma.DeliveryUpdateInput): Promise<Delivery>;
  delete(id: number): Promise<Delivery>;
  count(where?: Prisma.DeliveryWhereInput): Promise<number>;
  findByChauffeurId(chauffeurId: number): Promise<Delivery[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Delivery[]>;
}
