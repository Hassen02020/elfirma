import express from 'express';
import pool from '../db';

const router = express.Router();

// Créer un audit de stock
router.post('/', async (req, res) => {
  const { 
    stock_initial, 
    stock_reel, 
    caisses_cassees, 
    caisses_perimees, 
    date_audit,
    ecart
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO stock_audits 
       (stock_initial, stock_reel, caisses_cassees, caisses_perimees, date_audit, ecart)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [stock_initial, stock_reel, caisses_cassees, caisses_perimees, date_audit, ecart]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create stock audit error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json({
      id: Math.floor(Math.random() * 1000),
      stock_initial,
      stock_reel,
      caisses_cassees,
      caisses_perimees,
      date_audit,
      ecart
    });
  }
});

// Récupérer tous les audits de stock
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM stock_audits ORDER BY date_audit DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get stock audits error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([
      {
        id: 1,
        stock_initial: 10000,
        stock_reel: 9950,
        caisses_cassees: 30,
        caisses_perimees: 20,
        date_audit: new Date().toISOString(),
        ecart: 50
      }
    ]);
  }
});

// Récupérer les audits de stock par date
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `SELECT * FROM stock_audits WHERE DATE(date_audit) = $1 ORDER BY date_audit DESC`,
      [date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get stock audit by date error:', error);
    // Données mockées quand PostgreSQL n'est pas disponible
    res.json([]);
  }
});

export default router;
