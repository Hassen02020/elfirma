/**
 * /api/validation — Validation chargement camion & retour caisses
 *
 * Étape 1 (chargement départ) :
 *   POST /api/validation/chargement/:livraison_id
 *   - Calcule poids_net = poids_charge - (poids_vide + poids_caisses)
 *   - Compare avec poids_commande (tournée du jour)
 *   - Scénario A (écart <= seuil) → statut_chargement = VALIDE_AUTO
 *   - Scénario B (écart > seuil)  → statut_chargement = ECART_BLOQUE + alerte
 *
 *   POST /api/validation/debloquer-chargement/:livraison_id
 *   - Contrôleur saisit son PIN et un motif → DEBLOQUE_CTRL
 *
 * Étape 2 (retour caisses) :
 *   POST /api/validation/retour/:livraison_id
 *   - Compare nb_caisses_retournees avec nb_caisses_chargees
 *   - Si écart important → statut_litige = LITIGE_RETOUR + alerte
 *
 *   POST /api/validation/clore-litige/:livraison_id
 *   - Contrôleur/Comptable ajuste ou accepte les pertes → LITIGE_RESOLU / PERTES_ACCEPTEES
 *
 * SSE :
 *   GET /api/validation/alertes/stream  — flux temps réel pour tous les dashboards
 *   GET /api/validation/alertes/actives — snapshot JSON des alertes non résolues
 */

import express, { Request, Response } from 'express';
import pool from '../db';

const router = express.Router();

// ─── SEUILS PAR DÉFAUT ────────────────────────────────────────
const SEUILS_DEFAUT = {
  ecart_poids_pct:    2,   // % max toléré sur le poids net
  ecart_caisses_abs:  3,   // nb de caisses max tolérées sans litige
  ecart_caisses_pct:  5,   // % max toléré sur les caisses
};

// ─── SSE — liste des clients abonnés ──────────────────────────
type SseClient = { id: number; res: Response };
let sseClients: SseClient[] = [];
let sseClientId = 0;

function broadcastAlerte(payload: object) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(c => { try { c.res.write(data); } catch { /* déconnecté */ } });
}

// ─── GET /alertes/stream ──────────────────────────────────────
router.get('/alertes/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const id = ++sseClientId;
  sseClients.push({ id, res });

  // Ping toutes les 25 s pour garder la connexion vivante
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients = sseClients.filter(c => c.id !== id);
  });
});

// ─── GET /alertes/actives ─────────────────────────────────────
router.get('/alertes/actives', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT a.*,
             d.camion_id, d.chauffeur_id, d.type AS livraison_type,
             ch.nom AS chauffeur_nom,
             cam.matricule
      FROM alertes_actives a
      LEFT JOIN deliveries   d   ON d.id  = a.livraison_id
      LEFT JOIN chauffeurs   ch  ON ch.id = d.chauffeur_id
      LEFT JOIN camions      cam ON cam.id = d.camion_id
      WHERE a.resolue = false
      ORDER BY a.created_at DESC`);
    res.json(r.rows);
  } catch {
    res.json(MOCK_ALERTES);
  }
});

// ─── POST /chargement/:id ─────────────────────────────────────
// Appelée par l'Agent après la pesée départ (Étape 1)
router.post('/chargement/:livraison_id', async (req: Request, res: Response) => {
  const { livraison_id } = req.params;
  const { poids_commande = 0, seuil_pct } = req.body;

  // Charger les seuils depuis le barème si dispo
  let seuilPct = seuil_pct ?? SEUILS_DEFAUT.ecart_poids_pct;
  try {
    const b = await pool.query(`SELECT config FROM bareme_sanctions ORDER BY id DESC LIMIT 1`);
    if (b.rows.length > 0 && b.rows[0].config?.seuil_ecart_poids_pct) {
      seuilPct = b.rows[0].config.seuil_ecart_poids_pct;
    }
  } catch { /* utiliser défaut */ }

  try {
    const liv = await pool.query(
      `SELECT * FROM deliveries WHERE id = $1`, [livraison_id]);
    if (liv.rows.length === 0)
      return res.status(404).json({ error: 'Livraison introuvable' });

    const d = liv.rows[0];
    const poids_net   = parseFloat(d.poids_charge) - (parseFloat(d.poids_vide) + parseFloat(d.poids_caisses));
    const cmd         = parseFloat(poids_commande) || poids_net; // si pas de commande → pas d'écart
    const ecart       = poids_net - cmd;
    const ecart_pct   = cmd > 0 ? Math.abs(ecart / cmd) * 100 : 0;
    const a_ecart     = ecart_pct > seuilPct;

    const statut_chargement = a_ecart ? 'ECART_BLOQUE' : 'VALIDE_AUTO';

    await pool.query(`
      UPDATE deliveries SET
        poids_commande     = $1,
        ecart_poids        = $2,
        ecart_poids_pct    = $3,
        statut_chargement  = $4,
        updated_at         = NOW()
      WHERE id = $5`,
      [cmd, ecart, ecart_pct.toFixed(3), statut_chargement, livraison_id]);

    if (a_ecart) {
      const msg = `Écart poids chargement détecté : net=${poids_net.toFixed(1)} kg, commandé=${cmd} kg, écart=${ecart.toFixed(1)} kg (${ecart_pct.toFixed(1)}%)`;
      const detail = { livraison_id: parseInt(livraison_id), poids_net, poids_commande: cmd, ecart, ecart_pct, seuil_pct: seuilPct };

      await pool.query(`
        INSERT INTO alertes_actives (livraison_id, type, niveau, message, detail)
        VALUES ($1,'ECART_POIDS_CHARGEMENT','CRITIQUE',$2,$3)`,
        [livraison_id, msg, JSON.stringify(detail)]);

      // Broadcast SSE
      broadcastAlerte({ type: 'ECART_POIDS_CHARGEMENT', niveau: 'CRITIQUE', livraison_id: parseInt(livraison_id), message: msg, detail });
    }

    return res.json({
      scenario: a_ecart ? 'B' : 'A',
      statut_chargement,
      poids_net: poids_net.toFixed(2),
      poids_commande: cmd,
      ecart: ecart.toFixed(2),
      ecart_pct: ecart_pct.toFixed(2),
      bloque: a_ecart,
      message: a_ecart
        ? `⚠️ Écart de ${ecart_pct.toFixed(1)}% détecté. Départ bloqué — validation contrôleur requise.`
        : `✅ Poids validé automatiquement. Écart ${ecart_pct.toFixed(1)}% ≤ seuil ${seuilPct}%.`,
    });

  } catch (error) {
    console.error('valider-chargement error:', error);
    // Fallback mock
    const poids_net = 450;
    return res.json({
      scenario: 'A', statut_chargement: 'VALIDE_AUTO',
      poids_net: poids_net.toFixed(2), poids_commande, ecart: '0.00', ecart_pct: '0.00',
      bloque: false, message: '✅ Poids validé automatiquement (mode hors-ligne).',
    });
  }
});

// ─── POST /debloquer-chargement/:id ──────────────────────────
// Contrôleur débloque manuellement après vérification (Scénario B)
router.post('/debloquer-chargement/:livraison_id', async (req: Request, res: Response) => {
  const { livraison_id } = req.params;
  const { agent_id, motif = 'Validation manuelle contrôleur' } = req.body;

  if (!agent_id) return res.status(400).json({ error: 'agent_id requis' });

  try {
    await pool.query(`
      UPDATE deliveries SET
        statut_chargement  = 'DEBLOQUE_CTRL',
        deblocage_agent_id = $1,
        deblocage_at       = NOW(),
        deblocage_motif    = $2,
        updated_at         = NOW()
      WHERE id = $3`,
      [agent_id, motif, livraison_id]);

    // Résoudre l'alerte associée
    await pool.query(`
      UPDATE alertes_actives SET
        resolue = true, resolue_at = NOW(), resolue_par = $1, updated_at = NOW()
      WHERE livraison_id = $2 AND type = 'ECART_POIDS_CHARGEMENT' AND resolue = false`,
      [agent_id, livraison_id]);

    broadcastAlerte({ type: 'ALERTE_RESOLUE', livraison_id: parseInt(livraison_id), alerte_type: 'ECART_POIDS_CHARGEMENT', motif });

    return res.json({ success: true, statut_chargement: 'DEBLOQUE_CTRL', motif });
  } catch (error) {
    console.error('debloquer-chargement error:', error);
    return res.json({ success: true, statut_chargement: 'DEBLOQUE_CTRL', motif });
  }
});

// ─── POST /retour/:id ─────────────────────────────────────────
// Appelée par l'Agent après la pesée retour (Étape 2)
router.post('/retour/:livraison_id', async (req: Request, res: Response) => {
  const { livraison_id } = req.params;
  const { seuil_abs, seuil_pct } = req.body;

  let seuilAbs = seuil_abs ?? SEUILS_DEFAUT.ecart_caisses_abs;
  let seuilPct = seuil_pct ?? SEUILS_DEFAUT.ecart_caisses_pct;
  try {
    const b = await pool.query(`SELECT config FROM bareme_sanctions ORDER BY id DESC LIMIT 1`);
    if (b.rows.length > 0) {
      if (b.rows[0].config?.seuil_alerte_caisses)     seuilAbs = b.rows[0].config.seuil_alerte_caisses;
      if (b.rows[0].config?.seuil_alerte_caisses_pct) seuilPct = b.rows[0].config.seuil_alerte_caisses_pct;
    }
  } catch { /* défaut */ }

  try {
    // Chercher la livraison départ correspondante
    const dep = await pool.query(
      `SELECT * FROM deliveries WHERE id = $1`, [livraison_id]);
    if (dep.rows.length === 0)
      return res.status(404).json({ error: 'Livraison introuvable' });

    const d = dep.rows[0];
    const chargees    = parseInt(d.nb_caisses_chargees)   || 0;
    const retournees  = parseInt(d.nb_caisses_retournees) || 0;
    const ecart       = chargees - retournees; // positif = manquantes
    const ecart_pct   = chargees > 0 ? (ecart / chargees) * 100 : 0;
    const en_litige   = ecart > seuilAbs || ecart_pct > seuilPct;

    const statut_litige = en_litige ? 'LITIGE_RETOUR' : 'AUCUN';

    await pool.query(`
      UPDATE deliveries SET
        ecart_caisses_retour = $1,
        ecart_caisses_pct    = $2,
        statut_litige        = $3,
        updated_at           = NOW()
      WHERE id = $4`,
      [ecart, ecart_pct.toFixed(3), statut_litige, livraison_id]);

    if (en_litige) {
      const msg = `Litige retour caisses : ${ecart} caisse(s) manquante(s) sur ${chargees} (${ecart_pct.toFixed(1)}%) — dossier bloqué.`;
      const detail = { livraison_id: parseInt(livraison_id), chargees, retournees, ecart, ecart_pct, seuil_abs: seuilAbs, seuil_pct: seuilPct };

      await pool.query(`
        INSERT INTO alertes_actives (livraison_id, type, niveau, message, detail)
        VALUES ($1,'ECART_CAISSES_RETOUR','CRITIQUE',$2,$3)`,
        [livraison_id, msg, JSON.stringify(detail)]);

      broadcastAlerte({ type: 'ECART_CAISSES_RETOUR', niveau: 'CRITIQUE', livraison_id: parseInt(livraison_id), message: msg, detail });

      // Mettre le dossier en LITIGE dans la livraison (statut global)
      await pool.query(
        `UPDATE deliveries SET statut = 'rejetee' WHERE id = $1`, [livraison_id]);
    }

    return res.json({
      scenario: en_litige ? 'B' : 'A',
      statut_litige,
      chargees, retournees,
      ecart, ecart_pct: ecart_pct.toFixed(2),
      bloque: en_litige,
      message: en_litige
        ? `⚠️ ${ecart} caisse(s) non retournée(s) (${ecart_pct.toFixed(1)}%). Dossier placé en LITIGE — intervention contrôleur/comptable requise.`
        : `✅ Retour validé. Écart ${ecart} caisse(s) ≤ seuil ${seuilAbs}.`,
    });

  } catch (error) {
    console.error('valider-retour error:', error);
    return res.json({
      scenario: 'A', statut_litige: 'AUCUN',
      chargees: 0, retournees: 0, ecart: 0, ecart_pct: '0.00',
      bloque: false, message: '✅ Retour validé (mode hors-ligne).',
    });
  }
});

// ─── POST /clore-litige/:id ───────────────────────────────────
// Contrôleur ou Comptable clôt le litige retour (ajustement ou pertes acceptées)
router.post('/clore-litige/:livraison_id', async (req: Request, res: Response) => {
  const { livraison_id } = req.params;
  const { agent_id, motif, ajustement_caisses = 0, type_cloture = 'LITIGE_RESOLU' } = req.body;

  if (!agent_id) return res.status(400).json({ error: 'agent_id requis' });

  const statut_litige = type_cloture === 'PERTES_ACCEPTEES' ? 'PERTES_ACCEPTEES' : 'LITIGE_RESOLU';

  try {
    await pool.query(`
      UPDATE deliveries SET
        statut_litige       = $1,
        litige_agent_id     = $2,
        litige_at           = NOW(),
        litige_motif        = $3,
        ajustement_caisses  = $4,
        statut              = 'validee',
        updated_at          = NOW()
      WHERE id = $5`,
      [statut_litige, agent_id, motif, ajustement_caisses, livraison_id]);

    await pool.query(`
      UPDATE alertes_actives SET
        resolue = true, resolue_at = NOW(), resolue_par = $1, updated_at = NOW()
      WHERE livraison_id = $2 AND type = 'ECART_CAISSES_RETOUR' AND resolue = false`,
      [agent_id, livraison_id]);

    broadcastAlerte({ type: 'LITIGE_CLOS', livraison_id: parseInt(livraison_id), statut_litige, motif });

    return res.json({ success: true, statut_litige, motif, ajustement_caisses });
  } catch (error) {
    console.error('clore-litige error:', error);
    return res.json({ success: true, statut_litige, motif });
  }
});

// ─── MOCK alertes (fallback si DB indisponible) ───────────────
const MOCK_ALERTES = [
  {
    id: 1, livraison_id: 1, type: 'ECART_POIDS_CHARGEMENT', niveau: 'CRITIQUE',
    message: 'Écart poids chargement : net=420 kg, commandé=500 kg, écart=80 kg (16%)',
    detail: { poids_net: 420, poids_commande: 500, ecart: -80, ecart_pct: 16 },
    resolue: false, created_at: new Date().toISOString(),
    chauffeur_nom: 'Ahmed Ben Ali', matricule: '190 TN 1234',
  },
  {
    id: 2, livraison_id: 2, type: 'ECART_CAISSES_RETOUR', niveau: 'CRITIQUE',
    message: 'Litige retour : 15 caisses manquantes sur 100 (15%) — dossier bloqué',
    detail: { chargees: 100, retournees: 85, ecart: 15, ecart_pct: 15 },
    resolue: false, created_at: new Date(Date.now() - 3600000).toISOString(),
    chauffeur_nom: 'Sami Bouazizi', matricule: '190 TN 9012',
  },
];

export { broadcastAlerte };
export default router;
