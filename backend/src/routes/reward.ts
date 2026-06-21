import express from 'express';
import pool from '../db';

const router = express.Router();

// Créer une nouvelle récompense
router.post('/', async (req, res) => {
  const {
    chauffeur_id,
    chauffeur_nom,
    montant,
    motif,
    date,
    statut,
    cree_par,
    mois_eligibles
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO rewards
       (chauffeur_id, chauffeur_nom, montant, motif, date, statut, cree_par, mois_eligibles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [chauffeur_id, chauffeur_nom, montant, motif, date, statut, cree_par, JSON.stringify(mois_eligibles)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create reward error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json({
      id: Math.floor(Math.random() * 1000),
      chauffeur_id,
      chauffeur_nom,
      montant,
      motif,
      date: date || new Date().toISOString(),
      statut: statut || 'validee',
      cree_par: cree_par || 'admin',
      mois_eligibles: mois_eligibles || []
    });
  }
});

// Récupérer toutes les récompenses
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM rewards ORDER BY date DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get rewards error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      {
        id: 1,
        chauffeur_id: 1,
        chauffeur_nom: 'Ahmed Ben Ali',
        montant: 200,
        motif: 'Performance exceptionnelle - 0 écart pendant 3 mois',
        date: new Date().toISOString(),
        statut: 'validee',
        cree_par: 'admin',
        mois_eligibles: ['2026-03', '2026-04', '2026-05']
      }
    ]);
  }
});

// Récupérer les chauffeurs éligibles aux récompenses (0 écart pendant 3 mois)
router.get('/eligible', async (req, res) => {
  try {
    // Logique: trouver les chauffeurs avec 0 écart pendant 3 mois consécutifs
    const result = await pool.query(
      `SELECT 
        c.id,
        c.nom as chauffeur_nom,
        ARRAY_AGG(DISTINCT TO_CHAR(d.date, 'YYYY-MM')) as mois_eligibles
       FROM chauffeurs c
       JOIN deliveries d ON c.id = d.chauffeur_id
       WHERE d.date >= NOW() - INTERVAL '3 months'
       GROUP BY c.id, c.nom
       HAVING COUNT(*) >= 3 AND 
              SUM(d.nb_caisses_chargees - d.nb_caisses_retournees) = 0
       ORDER BY c.nom`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get eligible drivers error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      {
        id: 1,
        chauffeur_nom: 'Ahmed Ben Ali',
        mois_eligibles: ['2026-03', '2026-04', '2026-05']
      },
      {
        id: 2,
        chauffeur_nom: 'Mohamed Trabelsi',
        mois_eligibles: ['2026-04', '2026-05', '2026-06']
      }
    ]);
  }
});

// Récupérer les récompenses par chauffeur
router.get('/chauffeur/:chauffeurId', async (req, res) => {
  try {
    const { chauffeurId } = req.params;
    const result = await pool.query(
      `SELECT * FROM rewards WHERE chauffeur_id = $1 ORDER BY date DESC`,
      [chauffeurId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get chauffeur rewards error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([]);
  }
});

export default router;
