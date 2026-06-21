/**
 * POST /api/v1/retours/controle
 * Saisie au retour du frigo — contrôle des caisses.
 *
 * Logique :
 *   - Si |chargées - retournées| <= seuil_abs ET pct <= seuil_pct → RAS
 *   - Sinon → LITIGE_RETOUR, alerte SSE vers Super Admin, Contrôleur, Comptable
 *   - Validation manuelle requise via POST /api/v1/retours/clore-litige/:id
 *
 * Rôles autorisés : AGENT, LOGISTIQUE, SUPER_ADMIN (saisie)
 *                   CONTROLEUR, COMPTABLE, SUPER_ADMIN (clôture litige)
 */

import express, { Request, Response } from 'express';
import pool from '../../db';
import { requireAuth, requireRole, ROLES } from '../../middleware/auth';
import { broadcastToRoles, broadcastGlobal } from '../../middleware/sseBroker';

const router = express.Router();

const SEUIL_CAISSES_ABS_DEFAULT = 3;
const SEUIL_CAISSES_PCT_DEFAULT = 5;

// ─── POST /controle ───────────────────────────────────────────
router.post(
  '/controle',
  requireAuth,
  requireRole([ROLES.AGENT, ROLES.LOGISTIQUE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const {
      livraison_id,
      nb_caisses_chargees,
      nb_caisses_retournees,
      seuil_abs = SEUIL_CAISSES_ABS_DEFAULT,
      seuil_pct = SEUIL_CAISSES_PCT_DEFAULT,
    } = req.body;

    if (nb_caisses_chargees === undefined || nb_caisses_retournees === undefined) {
      return res.status(400).json({ error: 'nb_caisses_chargees et nb_caisses_retournees requis' });
    }

    const ecart_abs = nb_caisses_chargees - nb_caisses_retournees;
    const ecart_pct = nb_caisses_chargees > 0
      ? (Math.abs(ecart_abs) / nb_caisses_chargees) * 100 : 0;

    const litige  = Math.abs(ecart_abs) > seuil_abs || ecart_pct > seuil_pct;
    const statut  = litige ? 'LITIGE_RETOUR' : 'RETOUR_OK';
    const niveau  = Math.abs(ecart_abs) > 10 || ecart_pct > 10 ? 'CRITIQUE' : 'ALERTE';

    const alerte = litige ? {
      type:               'ECART_CAISSES_RETOUR',
      niveau,
      livraison_id:       livraison_id ?? null,
      nb_caisses_chargees,
      nb_caisses_retournees,
      ecart_abs,
      ecart_pct:          parseFloat(ecart_pct.toFixed(2)),
      message:            `Retour : écart ${Math.abs(ecart_abs)} caisses (${ecart_pct.toFixed(1)}%) — livraison #${livraison_id}`,
      resolue:            false,
      created_at:         new Date().toISOString(),
    } : null;

    try {
      if (livraison_id) {
        await pool.query(
          `UPDATE deliveries
           SET nb_caisses_retournees=$1, ecart_caisses_retour=$2, statut_litige=$3, updated_at=NOW()
           WHERE id=$4`,
          [nb_caisses_retournees, ecart_abs, statut, livraison_id]
        );
      }
      if (alerte) {
        await pool.query(
          `INSERT INTO alertes_actives (type, niveau, livraison_id, message, resolue)
           VALUES ($1,$2,$3,$4,false)`,
          [alerte.type, alerte.niveau, livraison_id ?? null, alerte.message]
        );
      }
    } catch (err) {
      console.error('[v1/retours/controle] DB:', err);
    }

    if (alerte) {
      broadcastToRoles('ALERTE_RETOUR_CAISSES', alerte,
        [ROLES.SUPER_ADMIN, ROLES.CONTROLEUR, ROLES.COMPTABLE]);
    } else {
      broadcastGlobal('RETOUR_VALIDE', { livraison_id, statut });
    }

    return res.json({
      ecart_abs,
      ecart_pct:  parseFloat(ecart_pct.toFixed(2)),
      statut,
      litige,
      alerte,
    });
  }
);

// ─── POST /clore-litige/:id ───────────────────────────────────
router.post(
  '/clore-litige/:livraison_id',
  requireAuth,
  requireRole([ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const { livraison_id } = req.params;
    const { motif, ajustement_caisses = 0, resolution = 'PERTES_ACCEPTEES' } = req.body;

    if (!motif?.trim()) return res.status(400).json({ error: 'Motif de clôture obligatoire' });

    const resolutions = ['PERTES_ACCEPTEES', 'LITIGE_RESOLU', 'ERREUR_SAISIE'];
    if (!resolutions.includes(resolution)) {
      return res.status(400).json({ error: `resolution doit être : ${resolutions.join(', ')}` });
    }

    try {
      await pool.query(
        `UPDATE deliveries
         SET statut_litige=$1,
             nb_caisses_retournees = nb_caisses_retournees + $2,
             updated_at = NOW()
         WHERE id=$3`,
        [resolution, parseInt(String(ajustement_caisses)), livraison_id]
      );
      await pool.query(
        `UPDATE alertes_actives
         SET resolue=true, resolu_par=$1, resolu_motif=$2, resolu_at=NOW()
         WHERE livraison_id=$3 AND type='ECART_CAISSES_RETOUR' AND resolue=false`,
        [req.user?.agentId ?? null, motif, livraison_id]
      );
    } catch (err) {
      console.error('[v1/retours/clore-litige] DB:', err);
    }

    broadcastGlobal('LITIGE_RESOLU', { livraison_id, resolution, motif });
    return res.json({ success: true, livraison_id, resolution });
  }
);

// ─── GET /historique ──────────────────────────────────────────
router.get(
  '/historique',
  requireAuth,
  requireRole([ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const { depuis = '30' } = req.query;
    try {
      const r = await pool.query(`
        SELECT d.*,
               ch.nom AS chauffeur_nom,
               cam.matricule
        FROM deliveries d
        LEFT JOIN chauffeurs ch  ON ch.id  = d.chauffeur_id
        LEFT JOIN camions    cam ON cam.id = d.camion_id
        WHERE d.statut_litige IS NOT NULL
          AND d.date >= NOW() - ($1::INT || ' days')::INTERVAL
        ORDER BY d.date DESC
      `, [depuis]);
      return res.json(r.rows);
    } catch {
      return res.json([]);
    }
  }
);

export default router;
