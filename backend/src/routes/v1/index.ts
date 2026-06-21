/**
 * Routeur racine /api/v1
 * Regroupe tous les endpoints métiers v1 de l'abattoir.
 *
 * Cartographie :
 *   POST   /api/v1/stocks/daily                 → saisie stock quotidien
 *   GET    /api/v1/stocks/today                 → stock du jour
 *   GET    /api/v1/stocks/summary               → synthèse congelé/surgelé
 *
 *   POST   /api/v1/expeditions/pesee            → calcul poids net + alerte
 *   POST   /api/v1/expeditions/debloquer/:id    → déblocage contrôleur
 *
 *   POST   /api/v1/retours/controle             → contrôle caisses retour
 *   POST   /api/v1/retours/clore-litige/:id     → clôture litige
 *   GET    /api/v1/retours/historique           → historique litiges
 *
 *   GET    /api/v1/chauffeurs/bilan-mensuel     → bilan fin de mois
 *   GET    /api/v1/chauffeurs/:id/performances  → historique chauffeur
 *   GET    /api/v1/chauffeurs                   → liste chauffeurs
 *
 *   GET    /api/v1/events/stream                → SSE temps réel global
 */

import express from 'express';
import stocksRouter      from './stocks';
import expeditionsRouter from './expeditions';
import retoursRouter     from './retours';
import chauffeursRouter  from './chauffeurs';
import { registerSseClient } from '../../middleware/sseBroker';
import { requireAuth } from '../../middleware/auth';

const router = express.Router();

// ─── SSE global stream ────────────────────────────────────────
router.get('/events/stream', requireAuth, (req, res) => {
  registerSseClient(req, res);
});

// ─── Sous-routeurs métier ─────────────────────────────────────
router.use('/stocks',      stocksRouter);
router.use('/expeditions', expeditionsRouter);
router.use('/retours',     retoursRouter);
router.use('/chauffeurs',  chauffeursRouter);

export default router;
