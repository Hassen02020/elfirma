import express from 'express';
import pool from '../db';

const router = express.Router();

// Tournées mock en mémoire (fallback si DB indisponible)
let MOCK_TOURNEES: any[] = [];
let mockIdSeq = 1;

// GET toutes les tournées (du jour par défaut)
router.get('/', async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT t.*, c.nom as chauffeur_nom, cam.matricule as camion_matricule,
              s.nom as secteur_nom, s.zone as secteur_zone,
              a.nom as agent_nom, a.prenom as agent_prenom
       FROM tournees t
       LEFT JOIN chauffeurs c   ON t.chauffeur_id = c.id
       LEFT JOIN camions   cam  ON t.camion_id    = cam.id
       LEFT JOIN secteurs  s    ON t.secteur_id   = s.id
       LEFT JOIN agents    a    ON t.agent_id     = a.id
       WHERE DATE(t.date_tournee) = $1
       ORDER BY t.created_at DESC`,
      [targetDate]
    );
    res.json(result.rows);
  } catch {
    res.json(MOCK_TOURNEES.filter(t => t.date_tournee === targetDate));
  }
});

// GET une tournée par id (avec ses lignes clients)
router.get('/:id', async (req, res) => {
  try {
    const [tournee, lignes] = await Promise.all([
      pool.query(`SELECT t.*, c.nom as chauffeur_nom, cam.matricule as camion_matricule,
                         s.nom as secteur_nom, s.zone as secteur_zone
                  FROM tournees t
                  LEFT JOIN chauffeurs c  ON t.chauffeur_id = c.id
                  LEFT JOIN camions   cam ON t.camion_id    = cam.id
                  LEFT JOIN secteurs  s   ON t.secteur_id   = s.id
                  WHERE t.id = $1`, [req.params.id]),
      pool.query(`SELECT tl.*, cl.nom as client_nom, cl.telephone, cl.adresse,
                         p.nom as produit_nom, p.code as produit_code
                  FROM tournee_lignes tl
                  LEFT JOIN clients  cl ON tl.client_id  = cl.id
                  LEFT JOIN produits p  ON tl.produit_id = p.id
                  WHERE tl.tournee_id = $1 ORDER BY tl.id`, [req.params.id]),
    ]);
    if (tournee.rows.length === 0) return res.status(404).json({ error: 'Tournée introuvable' });
    res.json({ ...tournee.rows[0], lignes: lignes.rows });
  } catch {
    const t = MOCK_TOURNEES.find(t => t.id === parseInt(req.params.id));
    if (!t) return res.status(404).json({ error: 'Tournée introuvable' });
    res.json(t);
  }
});

// POST créer une tournée avec ses lignes clients
router.post('/', async (req, res) => {
  const {
    chauffeur_id, camion_id, secteur_id, produit_id,
    date_tournee, poids_cible, nb_caisses_total, agent_id, lignes
  } = req.body;

  try {
    // Créer tables si nécessaire
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournees (
        id              SERIAL PRIMARY KEY,
        chauffeur_id    INT,
        camion_id       INT,
        secteur_id      INT,
        produit_id      INT,
        agent_id        INT,
        date_tournee    DATE NOT NULL DEFAULT CURRENT_DATE,
        poids_cible     NUMERIC(10,2) DEFAULT 0,
        nb_caisses_total INT DEFAULT 0,
        statut          VARCHAR(20) DEFAULT 'planifiee',
        created_at      TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tournee_lignes (
        id           SERIAL PRIMARY KEY,
        tournee_id   INT REFERENCES tournees(id) ON DELETE CASCADE,
        client_id    INT,
        produit_id   INT,
        nb_caisses   INT DEFAULT 0,
        poids_kg     NUMERIC(10,2) DEFAULT 0,
        note         TEXT
      )
    `);

    const tRes = await pool.query(
      `INSERT INTO tournees (chauffeur_id, camion_id, secteur_id, produit_id, agent_id, date_tournee, poids_cible, nb_caisses_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [chauffeur_id, camion_id, secteur_id, produit_id, agent_id,
       date_tournee || new Date().toISOString().split('T')[0],
       poids_cible || 0, nb_caisses_total || 0]
    );
    const tournee = tRes.rows[0];

    if (Array.isArray(lignes) && lignes.length > 0) {
      for (const l of lignes) {
        await pool.query(
          `INSERT INTO tournee_lignes (tournee_id, client_id, produit_id, nb_caisses, poids_kg, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [tournee.id, l.client_id, l.produit_id || produit_id, l.nb_caisses, l.poids_kg || 0, l.note || '']
        );
      }
    }

    res.status(201).json(tournee);
  } catch (error) {
    // Fallback mock
    const newT = {
      id: mockIdSeq++, chauffeur_id, camion_id, secteur_id, produit_id, agent_id,
      date_tournee: date_tournee || new Date().toISOString().split('T')[0],
      poids_cible: poids_cible || 0, nb_caisses_total: nb_caisses_total || 0,
      statut: 'planifiee', lignes: lignes || [], created_at: new Date().toISOString()
    };
    MOCK_TOURNEES.push(newT);
    res.status(201).json(newT);
  }
});

// PUT mettre à jour statut tournée
router.put('/:id/statut', async (req, res) => {
  const { statut } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tournees SET statut=$1 WHERE id=$2 RETURNING *`,
      [statut, req.params.id]
    );
    res.json(result.rows[0]);
  } catch {
    const t = MOCK_TOURNEES.find(t => t.id === parseInt(req.params.id));
    if (t) t.statut = statut;
    res.json(t);
  }
});

// DELETE supprimer une tournée
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM tournees WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch {
    MOCK_TOURNEES = MOCK_TOURNEES.filter(t => t.id !== parseInt(req.params.id));
    res.json({ success: true });
  }
});

export default router;
