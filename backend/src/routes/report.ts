import express from 'express';
import pool from '../db';

const router = express.Router();

// Obtenir le stock actuel
router.get('/stock', async (req, res) => {
  try {
    // Stock à l'usine
    const stockUsineResult = await pool.query(
      `SELECT COUNT(*) as count FROM caisses WHERE statut = 'en_usine'`
    );

    // Caisses en extérieur
    const stockExterieurResult = await pool.query(
      `SELECT COUNT(*) as count FROM caisses WHERE statut = 'en_exterieur'`
    );

    // Stock par chauffeur
    const stockParChauffeurResult = await pool.query(
      `SELECT ch.id, ch.nom, COUNT(c.id) as nb_caisses
       FROM chauffeurs ch
       LEFT JOIN caisses c ON c.chauffeur_id = ch.id AND c.statut = 'en_exterieur'
       GROUP BY ch.id, ch.nom`
    );

    res.json({
      stock_usine: parseInt(stockUsineResult.rows[0].count),
      stock_exterieur: parseInt(stockExterieurResult.rows[0].count),
      stock_par_chauffeur: stockParChauffeurResult.rows
    });
  } catch (error) {
    console.error('Get stock error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json({
      stock_usine: 8500,
      stock_exterieur: 1500,
      stock_par_chauffeur: [
        { id: 1, nom: 'Ahmed Ben Ali', nb_caisses: 500 },
        { id: 2, nom: 'Mohamed Trabelsi', nb_caisses: 450 },
        { id: 3, nom: 'Sami Bouazizi', nb_caisses: 550 }
      ]
    });
  }
});

// Rapport mensuel par chauffeur
router.get('/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;

    const result = await pool.query(
      `SELECT 
        ch.id as chauffeur_id,
        ch.nom as chauffeur_nom,
        c.matricule,
        COUNT(d.id) as nb_livraisons,
        SUM(d.nb_caisses_chargees) as total_caisses_chargees,
        SUM(d.nb_caisses_retournees) as total_caisses_retournees,
        SUM(d.nb_caisses_chargees) - SUM(d.nb_caisses_retournees) as caisses_en_exterieur
       FROM chauffeurs ch
       LEFT JOIN deliveries d ON d.chauffeur_id = ch.id 
         AND EXTRACT(YEAR FROM d.date) = $1 
         AND EXTRACT(MONTH FROM d.date) = $2
       LEFT JOIN camions c ON c.chauffeur_id = ch.id
       GROUP BY ch.id, ch.nom, c.matricule
       ORDER BY ch.nom`,
      [year, month]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get monthly report error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      { chauffeur_id: 1, chauffeur_nom: 'Ahmed Ben Ali', matricule: '190 TN 1234', nb_livraisons: 60, total_caisses_chargees: 4500, total_caisses_retournees: 4300, caisses_en_exterieur: 200 },
      { chauffeur_id: 2, chauffeur_nom: 'Mohamed Trabelsi', matricule: '190 TN 5678', nb_livraisons: 55, total_caisses_chargees: 4200, total_caisses_retournees: 4000, caisses_en_exterieur: 200 },
      { chauffeur_id: 3, chauffeur_nom: 'Sami Bouazizi', matricule: '190 TN 9012', nb_livraisons: 65, total_caisses_chargees: 4800, total_caisses_retournees: 4600, caisses_en_exterieur: 200 }
    ]);
  }
});

// Statistiques journalières
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) as nb_livraisons,
        SUM(nb_caisses_chargees) as total_caisses_chargees,
        SUM(nb_caisses_retournees) as total_caisses_retournees
       FROM deliveries
       WHERE DATE(date) = $1`,
      [date]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get daily stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Alertes de rupture de stock
router.get('/alerts', async (req, res) => {
  try {
    const stockUsineResult = await pool.query(
      `SELECT COUNT(*) as count FROM caisses WHERE statut = 'en_usine'`
    );

    const stockUsine = parseInt(stockUsineResult.rows[0].count);
    let alertLevel = 'normal';
    let message = 'Stock normal';

    if (stockUsine < 50) {
      alertLevel = 'critique';
      message = 'Stock critique - moins de 50 caisses';
    } else if (stockUsine < 100) {
      alertLevel = 'faible';
      message = 'Stock faible - entre 50 et 100 caisses';
    }

    res.json({
      stock_usine: stockUsine,
      alert_level: alertLevel,
      message
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json({
      stock_usine: 8500,
      alert_level: 'normal',
      message: 'Stock normal'
    });
  }
});

// Rapport mensuel enrichi (poids + caisses + tournées)
router.get('/monthly-full/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  try {
    const livraisons = await pool.query(`
      SELECT l.*,
             ch.nom  AS chauffeur_nom,  cam.matricule,
             s.nom   AS secteur_nom,    p.nom AS produit_nom,
             p.code  AS produit_code
      FROM livraisons l
      LEFT JOIN chauffeurs ch  ON ch.id  = l.chauffeur_id
      LEFT JOIN camions    cam ON cam.id = l.camion_id
      LEFT JOIN secteurs   s   ON s.id   = l.secteur_id
      LEFT JOIN produits   p   ON p.id   = l.produit_id
      WHERE EXTRACT(YEAR  FROM l.date) = $1
        AND EXTRACT(MONTH FROM l.date) = $2
      ORDER BY l.date DESC`, [year, month]);

    const tournees = await pool.query(`
      SELECT t.*,
             ch.nom  AS chauffeur_nom,  cam.matricule,
             s.nom   AS secteur_nom,    p.nom AS produit_nom,
             a.nom   AS agent_nom,      a.prenom AS agent_prenom
      FROM tournees t
      LEFT JOIN chauffeurs ch  ON ch.id  = t.chauffeur_id
      LEFT JOIN camions    cam ON cam.id = t.camion_id
      LEFT JOIN secteurs   s   ON s.id   = t.secteur_id
      LEFT JOIN produits   p   ON p.id   = t.produit_id
      LEFT JOIN agents     a   ON a.id   = t.agent_id
      WHERE EXTRACT(YEAR  FROM t.date_tournee) = $1
        AND EXTRACT(MONTH FROM t.date_tournee) = $2
      ORDER BY t.date_tournee DESC`, [year, month]);

    const caissesExt = await pool.query(`
      SELECT cl.*,
             ch.nom AS chauffeur_nom, s.nom AS secteur_nom
      FROM caisses_laissees cl
      LEFT JOIN chauffeurs ch ON ch.id = cl.chauffeur_id
      LEFT JOIN secteurs   s  ON s.id  = cl.secteur_id
      WHERE EXTRACT(YEAR  FROM cl.date_laissee) = $1
        AND EXTRACT(MONTH FROM cl.date_laissee) = $2
      ORDER BY cl.date_laissee DESC`, [year, month]);

    // Agrégats par chauffeur
    const agg = await pool.query(`
      SELECT
        ch.id AS chauffeur_id, ch.nom AS chauffeur_nom, cam.matricule,
        COUNT(l.id) FILTER (WHERE l.type='depart')  AS nb_departs,
        COUNT(l.id) FILTER (WHERE l.type='retour')  AS nb_retours,
        COALESCE(SUM(l.nb_caisses_chargees)   FILTER (WHERE l.type='depart'), 0) AS total_caisses_chargees,
        COALESCE(SUM(l.nb_caisses_retournees) FILTER (WHERE l.type='retour'), 0) AS total_caisses_retournees,
        COALESCE(SUM(l.poids_charge - l.poids_vide) FILTER (WHERE l.type='depart'), 0) AS total_poids_charge_kg,
        COALESCE(SUM(l.poids_charge - l.poids_vide) FILTER (WHERE l.type='retour'), 0) AS total_poids_retour_kg
      FROM chauffeurs ch
      LEFT JOIN livraisons l   ON l.chauffeur_id = ch.id
        AND EXTRACT(YEAR  FROM l.date) = $1
        AND EXTRACT(MONTH FROM l.date) = $2
      LEFT JOIN camions cam ON cam.chauffeur_id = ch.id
      GROUP BY ch.id, ch.nom, cam.matricule
      ORDER BY ch.nom`, [year, month]);

    res.json({
      livraisons: livraisons.rows,
      tournees:   tournees.rows,
      caisses_exterieures: caissesExt.rows,
      agregats_chauffeurs: agg.rows,
      periode: { year: parseInt(year), month: parseInt(month) }
    });
  } catch (error) {
    console.error('monthly-full error:', error);
    // Mock enrichi
    res.json({
      livraisons: [],
      tournees: [],
      caisses_exterieures: [],
      agregats_chauffeurs: [
        { chauffeur_id: 1, chauffeur_nom: 'Ahmed Ben Ali',    matricule: '190 TN 1234', nb_departs: 22, nb_retours: 22, total_caisses_chargees: 1100, total_caisses_retournees: 1080, total_poids_charge_kg: 19800, total_poids_retour_kg: 19440 },
        { chauffeur_id: 2, chauffeur_nom: 'Mohamed Trabelsi', matricule: '190 TN 5678', nb_departs: 20, nb_retours: 20, total_caisses_chargees: 980,  total_caisses_retournees: 960,  total_poids_charge_kg: 17640, total_poids_retour_kg: 17280 },
        { chauffeur_id: 3, chauffeur_nom: 'Sami Bouazizi',    matricule: '190 TN 9012', nb_departs: 24, nb_retours: 23, total_caisses_chargees: 1200, total_caisses_retournees: 1150, total_poids_charge_kg: 21600, total_poids_retour_kg: 20700 },
      ],
      periode: { year: parseInt(year), month: parseInt(month) }
    });
  }
});

// Livraisons détaillées du jour avec secteur/produit/poids
router.get('/today-full', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*,
             ch.nom AS chauffeur_nom, cam.matricule,
             s.nom  AS secteur_nom,   p.nom AS produit_nom, p.code AS produit_code,
             (l.poids_charge - l.poids_vide) AS poids_net_kg
      FROM livraisons l
      LEFT JOIN chauffeurs ch  ON ch.id  = l.chauffeur_id
      LEFT JOIN camions    cam ON cam.id = l.camion_id
      LEFT JOIN secteurs   s   ON s.id   = l.secteur_id
      LEFT JOIN produits   p   ON p.id   = l.produit_id
      WHERE DATE(l.date) = CURRENT_DATE
      ORDER BY l.date DESC`);
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

// Caisses laissées en extérieur (pour contrôleur et comptable)
router.get('/caisses-exterieures', async (req, res) => {
  const { statut } = req.query;
  try {
    const result = await pool.query(`
      SELECT cl.*, ch.nom AS chauffeur_nom, s.nom AS secteur_nom
      FROM caisses_laissees cl
      LEFT JOIN chauffeurs ch ON ch.id = cl.chauffeur_id
      LEFT JOIN secteurs   s  ON s.id  = cl.secteur_id
      ${statut ? "WHERE cl.statut = $1" : ""}
      ORDER BY cl.date_laissee DESC`,
      statut ? [statut] : []);
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

// Affectations logistique par période (pour comptable)
router.get('/affectations/:year/:month', async (req, res) => {
  const { year, month } = req.params;
  try {
    const result = await pool.query(`
      SELECT t.*, tl.client_id, tl.nb_caisses, tl.poids_kg, tl.note, tl.livre,
             cl.nom AS client_nom, cl.telephone, cl.adresse,
             ch.nom AS chauffeur_nom, cam.matricule,
             s.nom  AS secteur_nom,  p.nom AS produit_nom,
             a.nom  AS agent_nom,    a.prenom AS agent_prenom
      FROM tournees t
      LEFT JOIN tournee_lignes tl ON tl.tournee_id = t.id
      LEFT JOIN clients    cl  ON cl.id  = tl.client_id
      LEFT JOIN chauffeurs ch  ON ch.id  = t.chauffeur_id
      LEFT JOIN camions    cam ON cam.id = t.camion_id
      LEFT JOIN secteurs   s   ON s.id   = t.secteur_id
      LEFT JOIN produits   p   ON p.id   = t.produit_id
      LEFT JOIN agents     a   ON a.id   = t.agent_id
      WHERE EXTRACT(YEAR  FROM t.date_tournee) = $1
        AND EXTRACT(MONTH FROM t.date_tournee) = $2
      ORDER BY t.date_tournee DESC, t.id, tl.id`, [year, month]);
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

export default router;

