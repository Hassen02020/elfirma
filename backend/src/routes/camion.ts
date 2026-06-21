import express from 'express';
import pool from '../db';

const router = express.Router();

// GET all camions
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             ch.id as chauffeur_id, 
             ch.nom as chauffeur_nom
      FROM camions c
      LEFT JOIN chauffeurs ch ON c.chauffeur_id = ch.id
      ORDER BY c.id
    `);
    
    const camions = result.rows.map(row => ({
      id: row.id,
      serie: row.serie,
      matricule: row.matricule,
      modele: row.modele,
      chauffeurId: row.chauffeur_id,
      capaciteMax: row.capacite_max,
      statut: row.statut,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chauffeur: row.chauffeur_id ? {
        id: row.chauffeur_id,
        nom: row.chauffeur_nom
      } : null
    }));
    
    res.json(camions);
  } catch (error) {
    console.error('Error fetching camions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET single camion
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, 
             ch.id as chauffeur_id, 
             ch.nom as chauffeur_nom
      FROM camions c
      LEFT JOIN chauffeurs ch ON c.chauffeur_id = ch.id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Camion non trouvé' });
    }
    
    const row = result.rows[0];
    const camion = {
      id: row.id,
      serie: row.serie,
      matricule: row.matricule,
      modele: row.modele,
      chauffeurId: row.chauffeur_id,
      capaciteMax: row.capacite_max,
      statut: row.statut,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chauffeur: row.chauffeur_id ? {
        id: row.chauffeur_id,
        nom: row.chauffeur_nom
      } : null
    };
    
    res.json(camion);
  } catch (error) {
    console.error('Error fetching camion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST create camion
router.post('/', async (req, res) => {
  try {
    const { serie, matricule, modele, chauffeurId, capaciteMax, statut } = req.body;
    
    const result = await pool.query(
      `INSERT INTO camions (serie, matricule, modele, chauffeur_id, capacite_max, statut)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [serie, matricule, modele, chauffeurId || null, capaciteMax, statut]
    );
    
    const row = result.rows[0];
    const camion = {
      id: row.id,
      serie: row.serie,
      matricule: row.matricule,
      modele: row.modele,
      chauffeurId: row.chauffeur_id,
      capaciteMax: row.capacite_max,
      statut: row.statut,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.status(201).json(camion);
  } catch (error) {
    console.error('Error creating camion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT update camion
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { serie, matricule, modele, chauffeurId, capaciteMax, statut } = req.body;
    
    const result = await pool.query(
      `UPDATE camions 
       SET serie = $1, matricule = $2, modele = $3, chauffeur_id = $4, capacite_max = $5, statut = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [serie, matricule, modele, chauffeurId || null, capaciteMax, statut, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Camion non trouvé' });
    }
    
    const row = result.rows[0];
    const camion = {
      id: row.id,
      serie: row.serie,
      matricule: row.matricule,
      modele: row.modele,
      chauffeurId: row.chauffeur_id,
      capaciteMax: row.capacite_max,
      statut: row.statut,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.json(camion);
  } catch (error) {
    console.error('Error updating camion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE camion
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM camions WHERE id = $1', [id]);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting camion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
