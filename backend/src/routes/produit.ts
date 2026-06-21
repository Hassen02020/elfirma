import express from 'express';
import pool from '../db';

const router = express.Router();

// GET tous les produits
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM produits ORDER BY nom`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get produits error:', error);
    res.json([
      { id: 1, nom: 'Poulet Entier Frais',      code: 'VOL-001', unite: 'caisses' },
      { id: 2, nom: 'Poulet Entier Congelé',    code: 'VOL-002', unite: 'caisses' },
      { id: 3, nom: 'Découpe Cuisse/Pilon',     code: 'VOL-003', unite: 'caisses' },
      { id: 4, nom: 'Blanc de Poulet',          code: 'VOL-004', unite: 'caisses' },
      { id: 5, nom: 'Ailes de Poulet',          code: 'VOL-005', unite: 'caisses' },
      { id: 6, nom: 'Foie & Abats de Volaille', code: 'VOL-006', unite: 'caisses' },
      { id: 7, nom: 'Dinde Entière',            code: 'VOL-007', unite: 'caisses' },
      { id: 8, nom: 'Découpe Dinde',            code: 'VOL-008', unite: 'caisses' },
    ]);
  }
});

// PUT reset produits → abattoir de volaille
router.put('/reset-volaille', async (req, res) => {
  try {
    // Créer la table si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS produits (
        id          SERIAL PRIMARY KEY,
        nom         VARCHAR(100) NOT NULL,
        code        VARCHAR(50) UNIQUE NOT NULL,
        unite       VARCHAR(20) DEFAULT 'caisses',
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `);
    // Upsert tous les produits volaille
    const produits = [
      ['Poulet Entier Frais',      'VOL-001', 'Poulet entier frais, livré en caisses isothermes'],
      ['Poulet Entier Congelé',    'VOL-002', 'Poulet entier congelé, livré en caisses frigorigènes'],
      ['Découpe Cuisse/Pilon',     'VOL-003', 'Cuisses et pilons de poulet conditionnés en caisses'],
      ['Blanc de Poulet',          'VOL-004', 'Filets et blancs de poulet conditionnés en caisses'],
      ['Ailes de Poulet',          'VOL-005', 'Ailes de poulet conditionnées en caisses'],
      ['Foie & Abats de Volaille', 'VOL-006', 'Foies, gésiers et abats de volaille en caisses'],
      ['Dinde Entière',            'VOL-007', 'Dinde entière fraîche ou congelée en caisses'],
      ['Découpe Dinde',            'VOL-008', 'Morceaux de dinde conditionnés en caisses'],
    ];
    for (const [nom, code, description] of produits) {
      await pool.query(`
        INSERT INTO produits (nom, code, unite, description)
        VALUES ($1, $2, 'caisses', $3)
        ON CONFLICT (code) DO UPDATE SET nom=EXCLUDED.nom, unite='caisses', description=EXCLUDED.description
      `, [nom, code, description]);
    }
    const result = await pool.query(`SELECT * FROM produits ORDER BY id`);
    res.json({ message: 'Produits mis à jour (abattoir volaille)', produits: result.rows });
  } catch (error) {
    console.error('Reset produits volaille error:', error);
    res.status(500).json({ error: 'Erreur serveur', detail: String(error) });
  }
});

// POST créer un produit
router.post('/', async (req, res) => {
  try {
    const { nom, code, unite, description } = req.body;
    const result = await pool.query(
      `INSERT INTO produits (nom, code, unite, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nom, code, unite || 'kg', description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create produit error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
