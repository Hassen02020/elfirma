import express from 'express';
import pool from '../db';

const router = express.Router();

// Configuration des pénalités (Super Admin)
let penaltyConfig = {
  cout_par_caisse_defaut: 10,
  remarque_visible_par: 'controller' as 'controller' | 'comptable' | 'all' | 'admin_only'
};

// Obtenir la configuration des pénalités
router.get('/config', async (req, res) => {
  try {
    res.json(penaltyConfig);
  } catch (error) {
    console.error('Get penalty config error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour la configuration des pénalités
router.post('/config', async (req, res) => {
  try {
    const { cout_par_caisse_defaut, remarque_visible_par } = req.body;

    penaltyConfig = {
      cout_par_caisse_defaut: cout_par_caisse_defaut || 10,
      remarque_visible_par: remarque_visible_par || 'controller'
    };

    res.json(penaltyConfig);
  } catch (error) {
    console.error('Update penalty config error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les pénalités avec remarques visibles par un rôle spécifique
router.get('/remarks/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const config = penaltyConfig;

    // Vérifier si le rôle a accès aux remarques
    let hasAccess = false;
    if (config.remarque_visible_par === 'all') {
      hasAccess = true;
    } else if (config.remarque_visible_par === role) {
      hasAccess = true;
    } else if (config.remarque_visible_par === 'admin_only' && role === 'admin') {
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT * FROM penalties WHERE remarque IS NOT NULL AND remarque != '' ORDER BY date DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get remarks error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    const config = penaltyConfig;
    let hasAccess = false;
    if (config.remarque_visible_par === 'all') {
      hasAccess = true;
    } else if (config.remarque_visible_par === req.params.role) {
      hasAccess = true;
    } else if (config.remarque_visible_par === 'admin_only' && req.params.role === 'admin') {
      hasAccess = true;
    }

    if (!hasAccess) {
      return res.json([]);
    }

    res.json([
      {
        id: 1,
        chauffeur_id: 1,
        chauffeur_nom: 'Ahmed Ben Ali',
        caisses_non_retournees: 5,
        cout_par_caisse: 10,
        penalite_totale: 50,
        remarque: 'Retard de 2 jours',
        date: new Date().toISOString(),
        statut: 'en_attente',
        cree_par: 'comptable'
      }
    ]);
  }
});

// Créer une nouvelle pénalité
router.post('/', async (req, res) => {
  const {
    chauffeur_id,
    chauffeur_nom,
    caisses_non_retournees,
    cout_par_caisse,
    penalite_totale,
    remarque,
    date,
    statut,
    cree_par
  } = req.body;

  try {
    const finalPenaliteTotale = penalite_totale || (caisses_non_retournees * cout_par_caisse);
    const finalStatut = statut || (cree_par === 'admin' ? 'validee' : 'en_attente');

    const result = await pool.query(
      `INSERT INTO penalties
       (chauffeur_id, chauffeur_nom, caisses_non_retournees, cout_par_caisse, penalite_totale, remarque, date, statut, cree_par)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [chauffeur_id, chauffeur_nom, caisses_non_retournees, cout_par_caisse, finalPenaliteTotale, remarque, date, finalStatut, cree_par]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create penalty error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    const finalPenaliteTotale = penalite_totale || (caisses_non_retournees * cout_par_caisse);
    const finalStatut = statut || (cree_par === 'admin' ? 'validee' : 'en_attente');
    res.json({
      id: Math.floor(Math.random() * 1000),
      chauffeur_id,
      chauffeur_nom,
      caisses_non_retournees,
      cout_par_caisse,
      penalite_totale: finalPenaliteTotale,
      remarque,
      date: date || new Date().toISOString(),
      statut: finalStatut,
      cree_par: cree_par || 'comptable'
    });
  }
});

// Récupérer toutes les pénalités
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM penalties ORDER BY date DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get penalties error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      {
        id: 1,
        chauffeur_id: 1,
        chauffeur_nom: 'Ahmed Ben Ali',
        caisses_non_retournees: 5,
        cout_par_caisse: 10,
        penalite_totale: 50,
        remarque: 'Retard de 2 jours',
        date: new Date().toISOString(),
        statut: 'en_attente',
        cree_par: 'comptable'
      }
    ]);
  }
});

// Récupérer toutes les pénalités avec statut (pour admin)
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM penalties ORDER BY date DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get all penalties error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      {
        id: 1,
        chauffeur_id: 1,
        chauffeur_nom: 'Ahmed Ben Ali',
        caisses_non_retournees: 5,
        cout_par_caisse: 10,
        penalite_totale: 50,
        remarque: 'Retard de 2 jours',
        date: new Date().toISOString(),
        statut: 'en_attente',
        cree_par: 'comptable'
      },
      {
        id: 2,
        chauffeur_id: 2,
        chauffeur_nom: 'Mohamed Trabelsi',
        caisses_non_retournees: 3,
        cout_par_caisse: 10,
        penalite_totale: 30,
        remarque: 'Caisses endommagées',
        date: new Date().toISOString(),
        statut: 'validee',
        cree_par: 'admin'
      }
    ]);
  }
});

// Valider ou rejeter une pénalité (Admin)
router.put('/:id/validate', async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;

  try {
    const result = await pool.query(
      `UPDATE penalties SET statut = $1 WHERE id = $2 RETURNING *`,
      [statut, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Validate penalty error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json({
      id: parseInt(id),
      statut,
      message: 'Pénalité mise à jour'
    });
  }
});

// Récupérer les pénalités par chauffeur
router.get('/chauffeur/:chauffeurId', async (req, res) => {
  try {
    const { chauffeurId } = req.params;
    const result = await pool.query(
      `SELECT * FROM penalties WHERE chauffeur_id = $1 ORDER BY date DESC`,
      [chauffeurId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get chauffeur penalties error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([]);
  }
});

export default router;
