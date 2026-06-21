import { Router } from 'express';
import { DeliveryController } from '../controllers/delivery.controller';

const router = Router();
const deliveryController = new DeliveryController();

// CRUD Routes
router.post('/', deliveryController.create);
router.get('/', deliveryController.getAll);
router.get('/:id', deliveryController.getById);
router.put('/:id', deliveryController.update);
router.delete('/:id', deliveryController.delete);

// Additional routes
router.get('/chauffeur/:chauffeurId', deliveryController.getByChauffeur);
router.get('/date-range', deliveryController.getByDateRange);

export default router;
