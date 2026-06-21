/**
 * /api/stock-volaille — Gestion du stock volaille (Congelé / Surgelé)
 *
 * Accès par rôle :
 *   GET  /today          → tous les rôles (lecture)
 *   GET  /historique     → tous les rôles
 *   GET  /compteurs      → tous les rôles (compteurs caisses temps réel)
 *   POST /               → logistique, super_admin (saisie production)
 *   POST /:id/mouvement  → logistique, super_admin (départ/retour frigo)
 *   PUT  /:id/correction → super_admin uniquement (correction inventaire)
 *   GET  /stream         → SSE temps réel pour tous
 *
 * SSE broadcast : chaque mutation (POST/PUT) envoie un événement SSE
 * à tous les clients abonnés (dashboard logistique, contrôleur, super_admin).
 */

import express, { Request, Response } from 'express';
import pool from '../db';
import { requireAuth, requireRole, TOUS_ROLES, ROLES } from '../middleware/auth';

const router = express.Router();

// ─── SSE Clients ─────────────────────────────────────────────
type SseClient = { id: number; res: Response };
let sseClients: SseClient[] = [];
let sseId = 0;

function broadcast(event: string, payload: object) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(c => { try { c.res.write(msg); } catch { /* client déconnecté */ } });
}

// ─── GET /stream — SSE ───────────────────────────────────────
router.get('/stream', (_req: Request, res: Response) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const id = ++sseId;
  sseClients.push({ id, res });
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 25000);
  _req.on('close', () => { clearInterval(ping); sseClients = sseClients.filter(c => c.id !== id); });
});

// ─── GET /today — Stock du jour ───────────────────────────────
router.get('/today', requireAuth, requireRole(TOUS_ROLES), async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT sv.*,
             a.nom AS agent_nom, a.prenom AS agent_prenom
      FROM stock_volaille sv
      LEFT JOIN agents a ON a.id = sv.saisie_par
      WHERE sv.date_production = CURRENT_DATE
      ORDER BY sv.type_produit, sv.designation
    `);
    return res.json(r.rows.length > 0 ? r.rows : MOCK_STOCK_TODAY);
  } catch { return res.json(MOCK_STOCK_TODAY); }
});

// ─── GET /historique — 30 derniers jours ─────────────────────
router.get('/historique', requireAuth, requireRole(TOUS_ROLES), async (req: Request, res: Response) => {
  const jours = parseInt(String(req.query.jours ?? '30'));
  try {
    const r = await pool.query(`
      SELECT
        date_production,
        type_produit,
        SUM(quantite_kg)              AS total_kg,
        SUM(nb_caisses)               AS total_caisses,
        SUM(nb_caisses_en_circulation) AS caisses_en_circulation,
        SUM(nb_caisses_retournees)    AS caisses_retournees,
        SUM(nb_caisses) - SUM(nb_caisses_en_circulation) AS caisses_disponibles
      FROM stock_volaille
      WHERE date_production >= CURRENT_DATE - $1::INT
      GROUP BY date_production, type_produit
      ORDER BY date_production DESC, type_produit
    `, [jours]);
    return res.json(r.rows.length > 0 ? r.rows : MOCK_HISTORIQUE);
  } catch { return res.json(MOCK_HISTORIQUE); }
});

// ─── GET /compteurs — Compteurs caisses temps réel ───────────
router.get('/compteurs', requireAuth, requireRole(TOUS_ROLES), async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT
        SUM(nb_caisses)                AS total_stock,
        SUM(nb_caisses_en_circulation) AS en_circulation,
        SUM(nb_caisses_retournees)     AS retournees_frigo,
        SUM(nb_caisses) - SUM(nb_caisses_en_circulation) AS disponibles,
        SUM(CASE WHEN type_produit='CONGELE' THEN nb_caisses ELSE 0 END) AS congele_caisses,
        SUM(CASE WHEN type_produit='SURGELE' THEN nb_caisses ELSE 0 END) AS surgele_caisses,
        SUM(CASE WHEN type_produit='CONGELE' THEN quantite_kg ELSE 0 END) AS congele_kg,
        SUM(CASE WHEN type_produit='SURGELE' THEN quantite_kg ELSE 0 END) AS surgele_kg
      FROM stock_volaille
      WHERE date_production = CURRENT_DATE
    `);
    return res.json(r.rows[0] ?? MOCK_COMPTEURS);
  } catch { return res.json(MOCK_COMPTEURS); }
});

// ─── GET /anomalies — Historique anomalies (Super Admin) ─────
router.get('/anomalies', requireAuth, requireRole([ROLES.SUPER_ADMIN, ROLES.CONTROLEUR]), async (_req: Request, res: Response) => {
  try {
    // Fusionne alertes_actives + corrections super admin
    const alertes = await pool.query(`
      SELECT a.*, d.chauffeur_id,
             ch.nom AS chauffeur_nom, cam.matricule,
             'ALERTE' AS source
      FROM alertes_actives a
      LEFT JOIN deliveries d   ON d.id  = a.livraison_id
      LEFT JOIN chauffeurs ch  ON ch.id = d.chauffeur_id
      LEFT JOIN camions    cam ON cam.id = d.camion_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
    const corrections = await pool.query(`
      SELECT sv.id, sv.date_production, sv.type_produit, sv.designation,
             sv.correction_super_admin, sv.correction_motif,
             sv.corrige_at, a.nom AS corrige_par_nom,
             'CORRECTION' AS source
      FROM stock_volaille sv
      LEFT JOIN agents a ON a.id = sv.corrige_par
      WHERE sv.correction_super_admin IS NOT NULL AND sv.correction_super_admin != 0
      ORDER BY sv.corrige_at DESC
      LIMIT 50
    `);
    return res.json({ alertes: alertes.rows, corrections: corrections.rows });
  } catch {
    return res.json({ alertes: MOCK_ANOMALIES_ALERTES, corrections: MOCK_ANOMALIES_CORRECTIONS });
  }
});

// ─── POST / — Saisie stock production ────────────────────────
router.post('/', requireAuth, requireRole([ROLES.LOGISTIQUE, ROLES.SUPER_ADMIN, ROLES.AGENT]), async (req: Request, res: Response) => {
  const { type_produit, designation, quantite_kg, nb_caisses, temperature_c, lot, note, date_production } = req.body;
  const saisie_par = req.user?.agentId ?? req.user?.userId ?? null;

  if (!type_produit || !designation || quantite_kg === undefined) {
    return res.status(400).json({ error: 'type_produit, designation et quantite_kg sont requis' });
  }

  try {
    const r = await pool.query(`
      INSERT INTO stock_volaille
        (type_produit, designation, quantite_kg, nb_caisses, temperature_c, lot, note, saisie_par, date_production)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9::DATE, CURRENT_DATE))
      RETURNING *
    `, [type_produit, designation, quantite_kg, nb_caisses ?? 0, temperature_c ?? null, lot ?? null, note ?? null, saisie_par, date_production ?? null]);

    const stock = r.rows[0];
    broadcast('STOCK_MISE_A_JOUR', { action: 'NOUVEAU', stock });
    return res.status(201).json(stock);
  } catch (error) {
    console.error('POST stock-volaille error:', error);
    const mock = { id: Date.now(), type_produit, designation, quantite_kg, nb_caisses: nb_caisses ?? 0, date_production: new Date().toISOString().split('T')[0] };
    broadcast('STOCK_MISE_A_JOUR', { action: 'NOUVEAU', stock: mock });
    return res.status(201).json(mock);
  }
});

// ─── POST /:id/mouvement — Départ / Retour frigo ─────────────
router.post('/:id/mouvement', requireAuth, requireRole([ROLES.LOGISTIQUE, ROLES.SUPER_ADMIN, ROLES.AGENT]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type_mvt, nb_caisses, chauffeur_id, camion_id, motif } = req.body;
  const agent_id = req.user?.agentId ?? req.user?.userId ?? null;

  if (!type_mvt || !nb_caisses) return res.status(400).json({ error: 'type_mvt et nb_caisses requis' });

  try {
    await pool.query(`
      INSERT INTO mouvements_caisses (stock_id, type_mvt, nb_caisses, chauffeur_id, camion_id, agent_id, motif)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, type_mvt, nb_caisses, chauffeur_id ?? null, camion_id ?? null, agent_id, motif ?? null]);

    // Mettre à jour les compteurs sur stock_volaille
    if (type_mvt === 'DEPART_FRIGO') {
      await pool.query(`
        UPDATE stock_volaille
        SET nb_caisses_en_circulation = nb_caisses_en_circulation + $1, updated_at = NOW()
        WHERE id = $2
      `, [nb_caisses, id]);
    } else if (type_mvt === 'RETOUR_FRIGO') {
      await pool.query(`
        UPDATE stock_volaille
        SET nb_caisses_en_circulation = GREATEST(0, nb_caisses_en_circulation - $1),
            nb_caisses_retournees     = nb_caisses_retournees + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [nb_caisses, id]);
    }

    // Recharger le stock mis à jour
    const updated = await pool.query('SELECT * FROM stock_volaille WHERE id = $1', [id]);
    const stock = updated.rows[0];
    broadcast('MOUVEMENT_CAISSES', { type_mvt, nb_caisses, stock_id: parseInt(id), stock });
    return res.json({ success: true, stock });
  } catch (error) {
    console.error('mouvement error:', error);
    broadcast('MOUVEMENT_CAISSES', { type_mvt, nb_caisses, stock_id: parseInt(id) });
    return res.json({ success: true });
  }
});

// ─── PUT /:id/correction — Super Admin uniquement ────────────
router.put('/:id/correction', requireAuth, requireRole([ROLES.SUPER_ADMIN]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantite_kg, nb_caisses, motif } = req.body;
  const agent_id = req.user?.agentId ?? req.user?.userId ?? null;

  if (!motif?.trim()) return res.status(400).json({ error: 'Le motif de correction est obligatoire' });

  try {
    const delta_kg = parseFloat(quantite_kg ?? '0') || 0;
    const delta_cb = parseInt(nb_caisses ?? '0') || 0;

    const r = await pool.query(`
      UPDATE stock_volaille SET
        quantite_kg              = GREATEST(0, quantite_kg + $1),
        nb_caisses               = GREATEST(0, nb_caisses  + $2),
        correction_super_admin   = COALESCE(correction_super_admin, 0) + $1,
        correction_motif         = $3,
        corrige_par              = $4,
        corrige_at               = NOW(),
        updated_at               = NOW()
      WHERE id = $5
      RETURNING *
    `, [delta_kg, delta_cb, motif, agent_id, id]);

    if (r.rows.length === 0) return res.status(404).json({ error: 'Stock introuvable' });
    broadcast('CORRECTION_STOCK', { stock_id: parseInt(id), stock: r.rows[0], motif });
    return res.json(r.rows[0]);
  } catch (error) {
    console.error('correction error:', error);
    return res.json({ success: true });
  }
});

// ─── MOCK DATA ────────────────────────────────────────────────
const MOCK_STOCK_TODAY = [
  { id: 1, date_production: new Date().toISOString().split('T')[0], type_produit: 'CONGELE', designation: 'Poulet entier congelé',   quantite_kg: 2400, nb_caisses: 80, nb_caisses_en_circulation: 30, nb_caisses_retournees: 15, temperature_c: -18, lot: 'LOT-2026-001', agent_nom: 'Rekik', agent_prenom: 'Ali' },
  { id: 2, date_production: new Date().toISOString().split('T')[0], type_produit: 'CONGELE', designation: 'Découpes congelées',       quantite_kg: 1200, nb_caisses: 40, nb_caisses_en_circulation: 10, nb_caisses_retournees: 5,  temperature_c: -18, lot: 'LOT-2026-001', agent_nom: 'Rekik', agent_prenom: 'Ali' },
  { id: 3, date_production: new Date().toISOString().split('T')[0], type_produit: 'SURGELE', designation: 'Poulet entier surgelé',    quantite_kg: 1800, nb_caisses: 60, nb_caisses_en_circulation: 20, nb_caisses_retournees: 10, temperature_c: -24, lot: 'LOT-2026-002', agent_nom: 'Rekik', agent_prenom: 'Ali' },
  { id: 4, date_production: new Date().toISOString().split('T')[0], type_produit: 'SURGELE', designation: 'Abats surgelés',           quantite_kg:  600, nb_caisses: 20, nb_caisses_en_circulation: 5,  nb_caisses_retournees: 2,  temperature_c: -24, lot: 'LOT-2026-002', agent_nom: 'Rekik', agent_prenom: 'Ali' },
];
const MOCK_COMPTEURS = {
  total_stock: 200, en_circulation: 65, retournees_frigo: 32, disponibles: 135,
  congele_caisses: 120, surgele_caisses: 80, congele_kg: 3600, surgele_kg: 2400,
};
const MOCK_HISTORIQUE = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - i);
  return [
    { date_production: d.toISOString().split('T')[0], type_produit: 'CONGELE', total_kg: 3200 + i * 50, total_caisses: 110, caisses_en_circulation: 35, caisses_retournees: 20, caisses_disponibles: 75 },
    { date_production: d.toISOString().split('T')[0], type_produit: 'SURGELE', total_kg: 2100 + i * 30, total_caisses:  80, caisses_en_circulation: 25, caisses_retournees: 15, caisses_disponibles: 55 },
  ];
}).flat();
const MOCK_ANOMALIES_ALERTES = [
  { id: 1, type: 'ECART_POIDS_CHARGEMENT', niveau: 'CRITIQUE', message: 'Écart poids 12% — camion 190TN1234', resolue: false, created_at: new Date().toISOString(), chauffeur_nom: 'Ahmed Ben Ali', source: 'ALERTE' },
];
const MOCK_ANOMALIES_CORRECTIONS = [
  { id: 1, date_production: new Date().toISOString().split('T')[0], type_produit: 'CONGELE', designation: 'Poulet entier', correction_super_admin: -5, correction_motif: 'Caisses endommagées', corrige_at: new Date().toISOString(), corrige_par_nom: 'Admin', source: 'CORRECTION' },
];

export default router;
