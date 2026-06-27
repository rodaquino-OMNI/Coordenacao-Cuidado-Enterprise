import { Router } from 'express';
import { healthRoutes } from './health';
import { authRoutes } from './auth.routes';
import { clinicalRoutes } from './clinical.routes';
import gamificationRoutes from './gamification.routes';
import whatsappRoutes from './whatsapp.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/clinical', clinicalRoutes);
router.use('/gamification', gamificationRoutes);
router.use('/webhooks/whatsapp', whatsappRoutes);

export const routes = router;
