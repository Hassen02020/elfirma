import express from 'express';
import pool from '../db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────
//  BARÈME EN MÉMOIRE (persisté en DB dès que disponible)
// ─────────────────────────────────────────────────────────────
const BAREME_DEFAUT = {
  // Sanctions caisses
  cout_par_caisse_perdue:     15,   // DT par caisse non retournée
  seuil_tolerance_caisses:     2,   // nb de caisses tolérées avant sanction
  // Primes performance
  prime_taux_retour_100:      50,   // DT si taux retour = 100 %
  prime_taux_retour_95:       30,   // DT si taux retour >= 95 %
  prime_taux_retour_90:       15,   // DT si taux retour >= 90 %
  seuil_prime_min_livraisons: 10,   // nb min livraisons pour être éligible à la prime
  // Seuils d'alerte
  seuil_alerte_caisses:        5,   // au-delà : signalement automatique
  // Visibilité remarques
  remarque_visible_par: 'all' as 'controller' | 'comptable' | 'all' | 'admin_only',
};

let bareme = { ...BAREME_DEFAUT };

// ─────────────────────────────────────────────────────────────
//  1. BARÈME — lecture/écriture (Super Admin)
// ─────────────────────────────────────────────────────────────

// GET /api/fin-de-mois/bareme
router.get('/bareme', async (_req, res) => {
  try {
    const r = await pool.query(`SELECT config FROM bareme_sanctions ORDER BY id DESC LIMIT 1`);
    if (r.rows.length > 0) bareme = { ...BAREME_DEFAUT, ...r.rows[0].config };
  } catch { /* utiliser la valeur en mémoire */ }
  res.json(bareme);
});

// PUT /api/fin-de-mois/bareme
router.put('/bareme', async (req, res) => {
  const updated = { ...bareme, ...req.body };
  bareme = updated;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bareme_sanctions (
        id         SERIAL PRIMARY KEY,
        config     JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
    const exists = await pool.query(`SELECT id FROM bareme_sanctions LIMIT 1`);
    if (exists.rows.length > 0) {
      await pool.query(`UPDATE bareme_sanctions SET config=$1, updated_at=NOW() WHERE id=$2`,
        [JSON.stringify(updated), exists.rows[0].id]);
    } else {
      await pool.query(`INSERT INTO bareme_sanctions (config) VALUES ($1)`, [JSON.stringify(updated)]);
    }
  } catch { /* continuer même sans DB */ }
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────
//  2. MOTEUR DE CALCUL — POST /api/fin-de-mois/calcul
//     Génère les penalties + rewards du mois et les persiste
// ─────────────────────────────────────────────────────────────

router.post('/calcul', async (req, res) => {
  const { year, month, valider = false } = req.body;
  if (!year || !month) return res.status(400).json({ error: 'year et month requis' });

  // Recharger le barème depuis la DB si possible
  try {
    const r = await pool.query(`SELECT config FROM bareme_sanctions ORDER BY id DESC LIMIT 1`);
    if (r.rows.length > 0) bareme = { ...BAREME_DEFAUT, ...r.rows[0].config };
  } catch { /* bareme en mémoire */ }

  try {
    // ── Collecte des données mensuelles par chauffeur ──────────
    const stats = await pool.query(`
      SELECT
        ch.id                                                         AS chauffeur_id,
        ch.nom                                                        AS chauffeur_nom,
        ch.prenom                                                     AS chauffeur_prenom,
        cam.matricule,
        COUNT(d.id) FILTER (WHERE d.type='depart')                   AS nb_departs,
        COUNT(d.id) FILTER (WHERE d.type='retour')                   AS nb_retours,
        COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0) AS total_chargees,
        COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS total_retournees,
        COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0)
          - COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS caisses_ecart,
        ROUND(
          CASE WHEN COALESCE(SUM(d.nb_caisses_chargees) FILTER (WHERE d.type='depart'), 0) > 0
            THEN (COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0)::NUMERIC
                 / COALESCE(SUM(d.nb_caisses_chargees)  FILTER (WHERE d.type='depart'), 0)::NUMERIC) * 100
          ELSE 0 END, 2)                                              AS taux_retour,
        ROUND(AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at))/3600)::NUMERIC, 2) AS duree_moy_h
      FROM chauffeurs ch
      LEFT JOIN deliveries d   ON d.chauffeur_id = ch.id
        AND EXTRACT(YEAR  FROM d.date) = $1
        AND EXTRACT(MONTH FROM d.date) = $2
      LEFT JOIN camions cam ON cam.chauffeur_id = ch.id
      GROUP BY ch.id, ch.nom, ch.prenom, cam.matricule
      ORDER BY ch.nom`,
      [year, month]
    );

    const resultats: any[] = [];

    for (const row of stats.rows) {
      const {
        chauffeur_id, chauffeur_nom, chauffeur_prenom, matricule,
        nb_departs, nb_retours,
        total_chargees, total_retournees, caisses_ecart,
        taux_retour, duree_moy_h
      } = row;

      const ecart          = Math.max(0, parseInt(caisses_ecart) || 0);
      const taux           = parseFloat(taux_retour) || 0;
      const nbDeparts      = parseInt(nb_departs) || 0;
      const nbRetours      = parseInt(nb_retours) || 0;

      // ── Calcul sanction ────────────────────────────────────
      const caisses_sanctionnables = Math.max(0, ecart - bareme.seuil_tolerance_caisses);
      const montant_penalty        = caisses_sanctionnables * bareme.cout_par_caisse_perdue;
      const alerte                 = ecart >= bareme.seuil_alerte_caisses;

      // ── Calcul prime ───────────────────────────────────────
      let montant_prime = 0;
      let motif_prime   = '';
      if (nbDeparts >= bareme.seuil_prime_min_livraisons) {
        if (taux >= 100) { montant_prime = bareme.prime_taux_retour_100; motif_prime = 'Taux retour 100%'; }
        else if (taux >= 95) { montant_prime = bareme.prime_taux_retour_95; motif_prime = `Taux retour ${taux}% (≥95%)`; }
        else if (taux >= 90) { montant_prime = bareme.prime_taux_retour_90; motif_prime = `Taux retour ${taux}% (≥90%)`; }
      }

      // ── Net ────────────────────────────────────────────────
      const net = montant_prime - montant_penalty;

      const ligne = {
        chauffeur_id,
        chauffeur_nom: `${chauffeur_nom}${chauffeur_prenom ? ' ' + chauffeur_prenom : ''}`,
        matricule: matricule || '—',
        nb_departs: nbDeparts,
        nb_retours: nbRetours,
        total_chargees: parseInt(total_chargees) || 0,
        total_retournees: parseInt(total_retournees) || 0,
        caisses_ecart: ecart,
        caisses_sanctionnables,
        taux_retour: taux,
        duree_moy_h: parseFloat(duree_moy_h) || 0,
        alerte,
        montant_penalty,
        remarque_penalty: caisses_sanctionnables > 0
          ? `${caisses_sanctionnables} caisse(s) non retournée(s) × ${bareme.cout_par_caisse_perdue} DT`
          : null,
        montant_prime,
        motif_prime: montant_prime > 0 ? motif_prime : null,
        net,
        statut: valider ? 'validee' : 'en_attente',
      };

      resultats.push(ligne);

      // ── Persistance (si valider=true) ─────────────────────
      if (valider) {
        const moisStr = `${year}-${String(month).padStart(2,'0')}`;

        if (montant_penalty > 0) {
          await pool.query(`
            INSERT INTO penalties
              (chauffeur_id, chauffeur_nom, caisses_non_retournees, cout_par_caisse,
               penalite_totale, remarque, date, statut, cree_par)
            VALUES ($1,$2,$3,$4,$5,$6,NOW(),'validee','admin')
            ON CONFLICT DO NOTHING`,
            [chauffeur_id, ligne.chauffeur_nom, caisses_sanctionnables,
             bareme.cout_par_caisse_perdue, montant_penalty, ligne.remarque_penalty]
          );
        }

        if (montant_prime > 0) {
          await pool.query(`
            INSERT INTO rewards
              (chauffeur_id, chauffeur_nom, montant, motif, date, statut, cree_par, mois_eligibles)
            VALUES ($1,$2,$3,$4,NOW(),'VALIDEE','admin',$5)
            ON CONFLICT DO NOTHING`,
            [chauffeur_id, ligne.chauffeur_nom, montant_prime, motif_prime, [moisStr]]
          );
        }
      }
    }

    res.json({
      periode: { year: parseInt(year), month: parseInt(month) },
      bareme_utilise: bareme,
      valide: valider,
      resultats,
      totaux: {
        total_penalty: resultats.reduce((s, r) => s + r.montant_penalty, 0),
        total_prime:   resultats.reduce((s, r) => s + r.montant_prime, 0),
        net_global:    resultats.reduce((s, r) => s + r.net, 0),
        chauffeurs_en_alerte: resultats.filter(r => r.alerte).length,
      }
    });

  } catch (error) {
    console.error('fin-de-mois calcul error:', error);
    // ── Fallback mock ─────────────────────────────────────────
    const mock = [
      { chauffeur_id:1, chauffeur_nom:'Ahmed Ben Ali',    matricule:'190 TN 1234', nb_departs:22, nb_retours:22, total_chargees:1100, total_retournees:1085, caisses_ecart:15, caisses_sanctionnables:13, taux_retour:98.6, duree_moy_h:4.2, alerte:true,  montant_penalty:195, remarque_penalty:'13 caisses × 15 DT', montant_prime:30, motif_prime:'Taux retour 98.6% (≥95%)', net:-165, statut:'en_attente' },
      { chauffeur_id:2, chauffeur_nom:'Mohamed Trabelsi', matricule:'190 TN 5678', nb_departs:20, nb_retours:20, total_chargees:980,  total_retournees:980,  caisses_ecart:0,  caisses_sanctionnables:0,  taux_retour:100,  duree_moy_h:3.8, alerte:false, montant_penalty:0,   remarque_penalty:null, montant_prime:50, motif_prime:'Taux retour 100%', net:50, statut:'en_attente' },
      { chauffeur_id:3, chauffeur_nom:'Sami Bouazizi',    matricule:'190 TN 9012', nb_departs:24, nb_retours:23, total_chargees:1200, total_retournees:1155, caisses_ecart:45, caisses_sanctionnables:43, taux_retour:96.3, duree_moy_h:5.1, alerte:true,  montant_penalty:645, remarque_penalty:'43 caisses × 15 DT', montant_prime:30, motif_prime:'Taux retour 96.3% (≥95%)', net:-615, statut:'en_attente' },
    ];
    res.json({
      periode: { year: parseInt(year), month: parseInt(month) },
      bareme_utilise: bareme,
      valide: false,
      resultats: mock,
      totaux: { total_penalty: 840, total_prime: 110, net_global: -730, chauffeurs_en_alerte: 2 }
    });
  }
});

// ─────────────────────────────────────────────────────────────
//  3. RAPPORT CONSOLIDÉ — GET /api/fin-de-mois/rapport/:year/:month
//     Pour Comptable (paie) et Contrôleur (historique)
// ─────────────────────────────────────────────────────────────

router.get('/rapport/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  try {
    // Penalties du mois
    const pen = await pool.query(`
      SELECT p.*, ch.prenom
      FROM penalties p
      LEFT JOIN chauffeurs ch ON ch.id = p.chauffeur_id
      WHERE EXTRACT(YEAR FROM p.date) = $1 AND EXTRACT(MONTH FROM p.date) = $2
      ORDER BY p.chauffeur_nom`, [year, month]);

    // Rewards du mois
    const rew = await pool.query(`
      SELECT * FROM rewards
      WHERE EXTRACT(YEAR FROM date) = $1 AND EXTRACT(MONTH FROM date) = $2
      ORDER BY chauffeur_nom`, [year, month]);

    // Résumé livraisons
    const stats = await pool.query(`
      SELECT
        ch.id, ch.nom AS chauffeur_nom, ch.prenom, cam.matricule,
        COUNT(d.id) FILTER (WHERE d.type='depart')                    AS nb_departs,
        COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0) AS total_chargees,
        COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS total_retournees,
        ROUND(
          CASE WHEN COALESCE(SUM(d.nb_caisses_chargees) FILTER (WHERE d.type='depart'),0) > 0
            THEN (COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'),0)::NUMERIC
                 / COALESCE(SUM(d.nb_caisses_chargees)  FILTER (WHERE d.type='depart'),0)::NUMERIC) * 100
          ELSE 0 END, 2) AS taux_retour
      FROM chauffeurs ch
      LEFT JOIN deliveries d   ON d.chauffeur_id = ch.id
        AND EXTRACT(YEAR FROM d.date) = $1
        AND EXTRACT(MONTH FROM d.date) = $2
      LEFT JOIN camions cam ON cam.chauffeur_id = ch.id
      GROUP BY ch.id, ch.nom, ch.prenom, cam.matricule
      ORDER BY ch.nom`, [year, month]);

    // Agréger par chauffeur
    const lignes = stats.rows.map(ch => {
      const penalties_ch = pen.rows.filter(p => p.chauffeur_id === ch.id);
      const rewards_ch   = rew.rows.filter(r => r.chauffeur_id === ch.id);
      const total_penalty = penalties_ch.reduce((s, p) => s + parseFloat(p.penalite_totale || 0), 0);
      const total_prime   = rewards_ch.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
      return {
        ...ch,
        penalties: penalties_ch,
        rewards: rewards_ch,
        total_penalty,
        total_prime,
        net: total_prime - total_penalty,
      };
    });

    res.json({
      periode: { year: parseInt(year), month: parseInt(month) },
      bareme: bareme,
      lignes,
      totaux: {
        total_penalty: lignes.reduce((s, l) => s + l.total_penalty, 0),
        total_prime:   lignes.reduce((s, l) => s + l.total_prime,   0),
        net_global:    lignes.reduce((s, l) => s + l.net,            0),
      }
    });
  } catch (error) {
    console.error('rapport fin-de-mois error:', error);
    res.json({
      periode: { year: parseInt(year), month: parseInt(month) },
      bareme,
      lignes: [
        { id:1, chauffeur_nom:'Ahmed Ben Ali',    prenom:'',          matricule:'190 TN 1234', nb_departs:22, total_chargees:1100, total_retournees:1085, taux_retour:98.6, penalties:[{ id:1, penalite_totale:195, caisses_non_retournees:13, remarque:'13 caisses × 15 DT', statut:'validee' }], rewards:[{ id:1, montant:30, motif:'Taux retour 98.6%', statut:'VALIDEE' }], total_penalty:195, total_prime:30, net:-165 },
        { id:2, chauffeur_nom:'Mohamed Trabelsi', prenom:'',          matricule:'190 TN 5678', nb_departs:20, total_chargees:980,  total_retournees:980,  taux_retour:100,  penalties:[], rewards:[{ id:2, montant:50, motif:'Taux retour 100%', statut:'VALIDEE' }], total_penalty:0, total_prime:50, net:50 },
        { id:3, chauffeur_nom:'Sami Bouazizi',    prenom:'',          matricule:'190 TN 9012', nb_departs:24, total_chargees:1200, total_retournees:1155, taux_retour:96.3, penalties:[{ id:2, penalite_totale:645, caisses_non_retournees:43, remarque:'43 caisses × 15 DT', statut:'validee' }], rewards:[{ id:3, montant:30, motif:'Taux retour 96.3%', statut:'VALIDEE' }], total_penalty:645, total_prime:30, net:-615 },
      ],
      totaux: { total_penalty: 840, total_prime: 110, net_global: -730 }
    });
  }
});

// ─────────────────────────────────────────────────────────────
//  4. HISTORIQUE PERFORMANCES — GET /api/fin-de-mois/historique/:chauffeur_id
//     Pour Contrôleur (justificatifs)
// ─────────────────────────────────────────────────────────────

router.get('/historique/:chauffeur_id', async (req, res) => {
  const { chauffeur_id } = req.params;
  try {
    const hist = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM d.date)::INT AS annee,
        EXTRACT(MONTH FROM d.date)::INT AS mois,
        COUNT(d.id) FILTER (WHERE d.type='depart')                    AS nb_departs,
        COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0) AS total_chargees,
        COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS total_retournees,
        ROUND(
          CASE WHEN COALESCE(SUM(d.nb_caisses_chargees) FILTER (WHERE d.type='depart'),0) > 0
            THEN (COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'),0)::NUMERIC
                 / COALESCE(SUM(d.nb_caisses_chargees)  FILTER (WHERE d.type='depart'),0)::NUMERIC) * 100
          ELSE 0 END, 2) AS taux_retour,
        COALESCE(SUM(d.nb_caisses_chargees) FILTER (WHERE d.type='depart'),0)
          - COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'),0) AS caisses_ecart
      FROM deliveries d
      WHERE d.chauffeur_id = $1
      GROUP BY EXTRACT(YEAR FROM d.date), EXTRACT(MONTH FROM d.date)
      ORDER BY annee DESC, mois DESC
      LIMIT 12`,
      [chauffeur_id]
    );
    res.json(hist.rows);
  } catch {
    res.json([]);
  }
});

export default router;
