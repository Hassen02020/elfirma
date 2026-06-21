import express from 'express';
import pool from '../db';

const router = express.Router();

// GET all chauffeurs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, telephone, 
             stock_caisses_actuel, created_at
      FROM chauffeurs
      ORDER BY nom
    `);
    
    const chauffeurs = result.rows.map(row => ({
      id: row.id,
      nom: row.nom,
      telephone: row.telephone,
      stockCaissesActuel: row.stock_caisses_actuel,
      createdAt: row.created_at
    }));
    
    res.json(chauffeurs);
  } catch (error) {
    console.error('Error fetching chauffeurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET single chauffeur
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, nom, telephone, 
              stock_caisses_actuel, created_at
       FROM chauffeurs
       WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chauffeur non trouvé' });
    }
    
    const row = result.rows[0];
    const chauffeur = {
      id: row.id,
      nom: row.nom,
      telephone: row.telephone,
      stockCaissesActuel: row.stock_caisses_actuel,
      createdAt: row.created_at
    };
    
    res.json(chauffeur);
  } catch (error) {
    console.error('Error fetching chauffeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST create chauffeur
router.post('/', async (req, res) => {
  try {
    const { nom, telephone } = req.body;
    
    const result = await pool.query(
      `INSERT INTO chauffeurs (nom, telephone)
       VALUES ($1, $2)
       RETURNING *`,
      [nom, telephone]
    );
    
    const row = result.rows[0];
    const chauffeur = {
      id: row.id,
      nom: row.nom,
      telephone: row.telephone,
      stockCaissesActuel: row.stock_caisses_actuel,
      createdAt: row.created_at
    };
    
    res.status(201).json(chauffeur);
  } catch (error) {
    console.error('Error creating chauffeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT update chauffeur
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, telephone } = req.body;
    
    const result = await pool.query(
      `UPDATE chauffeurs 
       SET nom = $1, telephone = $2
       WHERE id = $3
       RETURNING *`,
      [nom, telephone, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chauffeur non trouvé' });
    }
    
    const row = result.rows[0];
    const chauffeur = {
      id: row.id,
      nom: row.nom,
      telephone: row.telephone,
      stockCaissesActuel: row.stock_caisses_actuel,
      createdAt: row.created_at
    };
    
    res.json(chauffeur);
  } catch (error) {
    console.error('Error updating chauffeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE chauffeur
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM chauffeurs WHERE id = $1', [id]);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting chauffeur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
