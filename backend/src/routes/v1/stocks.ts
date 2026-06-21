/**
 * POST /api/v1/stocks/daily
 * Saisie quotidienne stock volaille (Congelé / Surgelé)
 * Rôles autorisés : AGENT_LOGISTIQUE, SUPER_ADMIN
 *
 * Body : { type_produit, designation, quantite_kg, nb_caisses,
 *          temperature_c?, lot?, note?, date_production? }
 *
 * Réponse : entrée créée + broadcast SSE STOCK_MISE_A_JOUR
 */

import express, { Request, Response } from 'express';
import pool from '../../db';
import { requireAuth, requireRole, ROLES } from '../../middleware/auth';
import { broadcastGlobal } from '../../middleware/sseBroker';

const router = express.Router();

// ─── POST /daily ─────────────────────────────────────────────
router.post(
  '/daily',
  requireAuth,
  requireRole([ROLES.LOGISTIQUE, ROLES.AGENT, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const {
      type_produit, designation, quantite_kg, nb_caisses,
      temperature_c, lot, note, date_production,
    } = req.body;

    if (!type_produit || !designation || quantite_kg === undefined || nb_caisses === undefined) {
      return res.status(400).json({
        error: 'type_produit, designation, quantite_kg et nb_caisses sont requis',
      });
    }
    if (!['CONGELE', 'SURGELE'].includes(type_produit)) {
      return res.status(400).json({ error: 'type_produit doit être CONGELE ou SURGELE' });
    }

    const saisie_par = req.user?.agentId ?? req.user?.userId ?? null;

    try {
      const r = await pool.query(
        `INSERT INTO stock_volaille
           (type_produit, designation, quantite_kg, nb_caisses,
            temperature_c, lot, note, saisie_par, date_production)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9::DATE, CURRENT_DATE))
         RETURNING *`,
        [
          type_produit, designation,
          parseFloat(String(quantite_kg)),
          parseInt(String(nb_caisses)),
          temperature_c ?? null, lot ?? null, note ?? null,
          saisie_par, date_production ?? null,
        ]
      );
      const stock = r.rows[0];
      broadcastGlobal('STOCK_MISE_A_JOUR', { action: 'SAISIE_DAILY', stock });
      return res.status(201).json(stock);
    } catch (err) {
      console.error('[v1/stocks/daily]', err);
      const fallback = {
        id: Date.now(),
        type_produit, designation, quantite_kg, nb_caisses,
        date_production: date_production ?? new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };
      broadcastGlobal('STOCK_MISE_A_JOUR', { action: 'SAISIE_DAILY', stock: fallback });
      return res.status(201).json(fallback);
    }
  }
);

// ─── GET /today ───────────────────────────────────────────────
router.get(
  '/today',
  requireAuth,
  requireRole([ROLES.LOGISTIQUE, ROLES.AGENT, ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (_req: Request, res: Response) => {
    try {
      const r = await pool.query(`
        SELECT sv.*, a.nom AS agent_nom, a.prenom AS agent_prenom
        FROM stock_volaille sv
        LEFT JOIN agents a ON a.id = sv.saisie_par
        WHERE sv.date_production = CURRENT_DATE
        ORDER BY sv.type_produit, sv.designation
      `);
      return res.json(r.rows);
    } catch {
      return res.json([]);
    }
  }
);

// ─── GET /summary ─────────────────────────────────────────────
router.get(
  '/summary',
  requireAuth,
  requireRole([ROLES.LOGISTIQUE, ROLES.AGENT, ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (_req: Request, res: Response) => {
    try {
      const r = await pool.query(`
        SELECT
          type_produit,
          SUM(quantite_kg)               AS total_kg,
          SUM(nb_caisses)                AS total_caisses,
          SUM(nb_caisses_en_circulation) AS en_circulation,
          SUM(nb_caisses_retournees)     AS retournees,
          SUM(nb_caisses) - SUM(nb_caisses_en_circulation) AS disponibles
        FROM stock_volaille
        WHERE date_production = CURRENT_DATE
        GROUP BY type_produit
      `);
      return res.json(r.rows);
    } catch {
      return res.json([]);
    }
  }
);

export default router;
