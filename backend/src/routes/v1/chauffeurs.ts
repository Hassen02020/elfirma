/**
 * GET /api/v1/chauffeurs/bilan-mensuel?year=&month=
 * Bilan mensuel par chauffeur : historique écarts caisses + primes/sanctions
 * basés sur le barème configurable (bareme_sanctions).
 *
 * GET /api/v1/chauffeurs/:id/performances?mois=12
 * Historique 12 mois d'un chauffeur (pour ControllerDashboard)
 *
 * Rôles : COMPTABLE, SUPER_ADMIN (bilan financier complet)
 *         CONTROLEUR (lecture performance, sans montants)
 */

import express, { Request, Response } from 'express';
import pool from '../../db';
import { requireAuth, requireRole, ROLES } from '../../middleware/auth';

const router = express.Router();

const BAREME_DEFAUT = {
  cout_par_caisse_perdue:     15,
  seuil_tolerance_caisses:     2,
  prime_taux_retour_100:      50,
  prime_taux_retour_95:       30,
  prime_taux_retour_90:       15,
  seuil_prime_min_livraisons: 10,
  seuil_alerte_caisses:        5,
};

async function loadBareme() {
  try {
    const r = await pool.query(
      `SELECT config FROM bareme_sanctions ORDER BY id DESC LIMIT 1`
    );
    return r.rows.length > 0 ? { ...BAREME_DEFAUT, ...r.rows[0].config } : BAREME_DEFAUT;
  } catch {
    return BAREME_DEFAUT;
  }
}

// ─── GET /bilan-mensuel ───────────────────────────────────────
router.get(
  '/bilan-mensuel',
  requireAuth,
  requireRole([ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const year  = parseInt(String(req.query.year  ?? new Date().getFullYear()));
    const month = parseInt(String(req.query.month ?? new Date().getMonth() + 1));

    const bareme = await loadBareme();

    try {
      const r = await pool.query(`
        SELECT
          ch.id                                       AS chauffeur_id,
          ch.nom                                      AS chauffeur_nom,
          cam.matricule,
          COUNT(d.id)                                 AS nb_departs,
          COALESCE(SUM(d.nb_caisses_chargees),   0)  AS total_chargees,
          COALESCE(SUM(d.nb_caisses_retournees), 0)  AS total_retournees,
          COALESCE(SUM(d.nb_caisses_chargees), 0)
            - COALESCE(SUM(d.nb_caisses_retournees), 0) AS caisses_ecart
        FROM chauffeurs ch
        LEFT JOIN deliveries d
          ON d.chauffeur_id = ch.id
          AND EXTRACT(YEAR  FROM d.date) = $1
          AND EXTRACT(MONTH FROM d.date) = $2
          AND d.type = 'depart'
        LEFT JOIN camions cam ON cam.chauffeur_id = ch.id
        GROUP BY ch.id, ch.nom, cam.matricule
        ORDER BY ch.nom
      `, [year, month]);

      const resultats = r.rows.map((row: any) => {
        const nb         = parseInt(row.nb_departs);
        const chargees   = parseInt(row.total_chargees);
        const retournees = parseInt(row.total_retournees);
        const ecart      = parseInt(row.caisses_ecart);
        const taux       = chargees > 0 ? (retournees / chargees) * 100 : 0;

        // Sanctions
        const sanctionnables  = Math.max(0, ecart - bareme.seuil_tolerance_caisses);
        const montant_penalty = sanctionnables * bareme.cout_par_caisse_perdue;
        const alerte          = ecart > bareme.seuil_alerte_caisses;

        // Primes
        let montant_prime = 0;
        let motif_prime: string | null = null;
        if (nb >= bareme.seuil_prime_min_livraisons) {
          if (taux >= 100)      { montant_prime = bareme.prime_taux_retour_100; motif_prime = 'Taux 100%'; }
          else if (taux >= 95)  { montant_prime = bareme.prime_taux_retour_95;  motif_prime = 'Taux ≥ 95%'; }
          else if (taux >= 90)  { montant_prime = bareme.prime_taux_retour_90;  motif_prime = 'Taux ≥ 90%'; }
        }

        const net    = montant_prime - montant_penalty;
        const statut = alerte ? 'ALERTE' : (montant_prime > 0 ? 'PRIME' : (montant_penalty > 0 ? 'SANCTION' : 'OK'));

        return {
          chauffeur_id:   row.chauffeur_id,
          chauffeur_nom:  row.chauffeur_nom,
          matricule:      row.matricule,
          nb_departs:     nb,
          total_chargees: chargees,
          total_retournees: retournees,
          caisses_ecart:  ecart,
          taux_retour:    parseFloat(taux.toFixed(2)),
          caisses_sanctionnables: sanctionnables,
          alerte,
          montant_penalty,
          montant_prime,
          motif_prime,
          net,
          statut,
        };
      });

      const totaux = {
        total_penalty:         resultats.reduce((s, r) => s + r.montant_penalty, 0),
        total_prime:           resultats.reduce((s, r) => s + r.montant_prime, 0),
        net_global:            resultats.reduce((s, r) => s + r.net, 0),
        chauffeurs_en_alerte:  resultats.filter(r => r.alerte).length,
      };

      return res.json({
        periode:        { year, month },
        bareme_utilise: bareme,
        resultats,
        totaux,
      });
    } catch (err) {
      console.error('[v1/chauffeurs/bilan-mensuel]', err);
      return res.json({ periode: { year, month }, resultats: [], totaux: {} });
    }
  }
);

// ─── GET /:id/performances ────────────────────────────────────
router.get(
  '/:id/performances',
  requireAuth,
  requireRole([ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const mois   = parseInt(String(req.query.mois ?? '12'));

    try {
      const r = await pool.query(`
        SELECT
          EXTRACT(YEAR  FROM d.date)::INT AS annee,
          EXTRACT(MONTH FROM d.date)::INT AS mois,
          COUNT(d.id)                     AS nb_departs,
          SUM(d.nb_caisses_chargees)      AS total_chargees,
          SUM(d.nb_caisses_retournees)    AS total_retournees,
          SUM(d.nb_caisses_chargees) - SUM(d.nb_caisses_retournees) AS caisses_ecart,
          CASE WHEN SUM(d.nb_caisses_chargees) > 0
            THEN ROUND(SUM(d.nb_caisses_retournees)::NUMERIC / SUM(d.nb_caisses_chargees) * 100, 2)
            ELSE 0
          END AS taux_retour
        FROM deliveries d
        WHERE d.chauffeur_id = $1
          AND d.type = 'depart'
          AND d.date >= NOW() - ($2::INT || ' months')::INTERVAL
        GROUP BY annee, mois
        ORDER BY annee DESC, mois DESC
      `, [id, mois]);

      return res.json(r.rows);
    } catch {
      return res.json([]);
    }
  }
);

// ─── GET / (liste) ────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  requireRole([ROLES.CONTROLEUR, ROLES.COMPTABLE, ROLES.SUPER_ADMIN, ROLES.LOGISTIQUE, ROLES.AGENT]),
  async (_req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `SELECT id, nom, telephone, stock_caisses_actuel FROM chauffeurs ORDER BY nom`
      );
      return res.json(r.rows);
    } catch {
      return res.json([]);
    }
  }
);

export default router;
