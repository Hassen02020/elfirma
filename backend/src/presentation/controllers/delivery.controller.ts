import { Request, Response, NextFunction } from 'express';
import { PrismaDeliveryRepository } from '../../infrastructure/repositories/PrismaDeliveryRepository';
import { IDeliveryRepository } from '../../core/repositories/IDeliveryRepository';

export class DeliveryController {
  private deliveryRepository: IDeliveryRepository;

  constructor(deliveryRepository?: IDeliveryRepository) {
    this.deliveryRepository = deliveryRepository || new PrismaDeliveryRepository();
  }

  // Create a new delivery
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delivery = await this.deliveryRepository.create(req.body);
      res.status(201).json({
        success: true,
        data: delivery,
        message: 'Delivery created successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get delivery by ID
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const delivery = await this.deliveryRepository.findById(Number(id));

      if (!delivery) {
        return res.status(404).json({
          success: false,
          error: 'Delivery not found',
        });
      }

      res.status(200).json({
        success: true,
        data: delivery,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get all deliveries with pagination
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [deliveries, total] = await Promise.all([
        this.deliveryRepository.findAll({
          skip,
          take: limit,
          where: req.query.where as any,
          orderBy: req.query.orderBy as any,
        }),
        this.deliveryRepository.count(req.query.where as any),
      ]);

      res.status(200).json({
        success: true,
        data: deliveries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Update delivery
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const delivery = await this.deliveryRepository.update(Number(id), req.body);

      res.status(200).json({
        success: true,
        data: delivery,
        message: 'Delivery updated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Delete delivery
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const delivery = await this.deliveryRepository.delete(Number(id));

      res.status(200).json({
        success: true,
        data: delivery,
        message: 'Delivery deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  // Get deliveries by chauffeur
  getByChauffeur = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { chauffeurId } = req.params;
      const deliveries = await this.deliveryRepository.findByChauffeurId(Number(chauffeurId));

      res.status(200).json({
        success: true,
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  };

  // Get deliveries by date range
  getByDateRange = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const deliveries = await this.deliveryRepository.findByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.status(200).json({
        success: true,
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  };
}
