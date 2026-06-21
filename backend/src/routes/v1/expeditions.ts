/**
 * POST /api/v1/expeditions/pesee
 * Calcul instantané du poids net au départ camion.
 *
 * Formule : poids_net = poids_charge - (poids_vide + poids_caisses)
 *
 * Logique :
 *   - Si |poids_net - poids_commande| / poids_commande <= seuil_pct  → VALIDE_AUTO
 *   - Sinon → ECART_BLOQUE, alerte SSE broadcastée (niveau CRITIQUE si écart > 5 %)
 *
 * Rôles autorisés : AGENT, AGENT_LOGISTIQUE, SUPER_ADMIN
 */

import express, { Request, Response } from 'express';
import pool from '../../db';
import { requireAuth, requireRole, ROLES } from '../../middleware/auth';
import { broadcastGlobal, broadcastToRoles } from '../../middleware/sseBroker';

const router = express.Router();

const SEUIL_ECART_PCT_DEFAULT = 2; // % toléré

// ─── POST /pesee ──────────────────────────────────────────────
router.post(
  '/pesee',
  requireAuth,
  requireRole([ROLES.AGENT, ROLES.LOGISTIQUE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const {
      livraison_id,
      camion_id,
      chauffeur_id,
      poids_vide,
      poids_charge,
      poids_caisses,
      poids_commande,
      seuil_ecart_pct = SEUIL_ECART_PCT_DEFAULT,
    } = req.body;

    if (poids_vide === undefined || poids_charge === undefined || poids_caisses === undefined) {
      return res.status(400).json({ error: 'poids_vide, poids_charge et poids_caisses sont requis' });
    }

    const poids_net = Math.max(0, poids_charge - (poids_vide + poids_caisses));
    const ref       = poids_commande ?? poids_net;
    const ecart_abs = Math.abs(poids_net - ref);
    const ecart_pct = ref > 0 ? (ecart_abs / ref) * 100 : 0;

    const bloque  = ecart_pct > seuil_ecart_pct;
    const statut  = bloque ? 'ECART_BLOQUE' : 'VALIDE_AUTO';
    const niveau  = ecart_pct > 5 ? 'CRITIQUE' : 'ALERTE';

    const alerte = bloque ? {
      type:         'ECART_POIDS_CHARGEMENT',
      niveau,
      livraison_id: livraison_id ?? null,
      camion_id,
      chauffeur_id,
      poids_net,
      poids_commande: ref,
      ecart_abs:    parseFloat(ecart_abs.toFixed(2)),
      ecart_pct:    parseFloat(ecart_pct.toFixed(2)),
      message:      `Écart poids ${ecart_pct.toFixed(1)}% (${ecart_abs.toFixed(1)} kg) — camion #${camion_id}`,
      resolue:      false,
      created_at:   new Date().toISOString(),
    } : null;

    try {
      if (livraison_id) {
        await pool.query(
          `UPDATE deliveries
           SET poids_net=$1, ecart_poids=$2, statut_chargement=$3, updated_at=NOW()
           WHERE id=$4`,
          [poids_net, ecart_abs, statut, livraison_id]
        );
      }
      if (alerte) {
        await pool.query(
          `INSERT INTO alertes_actives
             (type, niveau, livraison_id, message, resolue)
           VALUES ($1,$2,$3,$4,false)`,
          [alerte.type, alerte.niveau, livraison_id ?? null, alerte.message]
        );
      }
    } catch (err) {
      console.error('[v1/expeditions/pesee] DB:', err);
    }

    if (alerte) {
      broadcastToRoles('ALERTE_PESEE', alerte,
        [ROLES.SUPER_ADMIN, ROLES.CONTROLEUR, ROLES.AGENT, ROLES.LOGISTIQUE]);
    } else {
      broadcastGlobal('PESEE_VALIDEE', { livraison_id, poids_net, statut });
    }

    return res.json({
      poids_net,
      ecart_abs:  parseFloat(ecart_abs.toFixed(2)),
      ecart_pct:  parseFloat(ecart_pct.toFixed(2)),
      statut,
      bloque,
      alerte,
    });
  }
);

// ─── POST /debloquer ──────────────────────────────────────────
router.post(
  '/debloquer/:livraison_id',
  requireAuth,
  requireRole([ROLES.CONTROLEUR, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const { livraison_id } = req.params;
    const { motif, agent_id } = req.body;
    if (!motif?.trim()) return res.status(400).json({ error: 'Motif obligatoire' });

    try {
      await pool.query(
        `UPDATE deliveries SET statut_chargement='DEBLOQUE_CTRL', updated_at=NOW() WHERE id=$1`,
        [livraison_id]
      );
      await pool.query(
        `UPDATE alertes_actives SET resolue=true, resolu_par=$1, resolu_motif=$2, resolu_at=NOW()
         WHERE livraison_id=$3 AND type='ECART_POIDS_CHARGEMENT' AND resolue=false`,
        [agent_id ?? req.user?.agentId, motif, livraison_id]
      );
    } catch (err) {
      console.error('[v1/expeditions/debloquer] DB:', err);
    }

    broadcastGlobal('CHARGEMENT_DEBLOQUE', { livraison_id, motif });
    return res.json({ success: true, livraison_id, statut: 'DEBLOQUE_CTRL' });
  }
);

export default router;
