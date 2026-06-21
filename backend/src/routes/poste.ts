import express from 'express';
import pool from '../db';

const router = express.Router();

// Données mock (fallback si DB indisponible)
const MOCK_POSTES = [
  { id: 1, nom: 'Poste Jour',  type: 'JOUR', heure_debut: '06:00', heure_fin: '18:00', actif: true },
  { id: 2, nom: 'Poste Nuit',  type: 'NUIT', heure_debut: '18:00', heure_fin: '06:00', actif: true },
];

const MOCK_AGENTS = [
  { id: 1, nom: 'Hamdi',     prenom: 'Ali',      code_agent: '1111', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 2, nom: 'Maaloul',   prenom: 'Sonia',    code_agent: '1122', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 3, nom: 'Chaouch',   prenom: 'Karim',    code_agent: '1133', poste_id: 1, role: 'controleur', poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 4, nom: 'Ferchichi', prenom: 'Nizar',    code_agent: '2211', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 5, nom: 'Belhadj',   prenom: 'Rim',      code_agent: '2222', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 6, nom: 'Nasri',     prenom: 'Anouar',   code_agent: '2233', poste_id: 2, role: 'controleur', poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
];

// GET tous les postes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM postes ORDER BY id`);
    res.json(result.rows);
  } catch {
    res.json(MOCK_POSTES);
  }
});

// GET agents d'un poste
router.get('/:id/agents', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as poste_nom, p.type as poste_type
       FROM agents a
       LEFT JOIN postes p ON a.poste_id = p.id
       WHERE a.poste_id = $1 AND a.actif = true
       ORDER BY a.nom`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch {
    res.json(MOCK_AGENTS.filter(a => a.poste_id === parseInt(req.params.id)));
  }
});

// GET tous les agents
router.get('/agents/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as poste_nom, p.type as poste_type
       FROM agents a
       LEFT JOIN postes p ON a.poste_id = p.id
       WHERE a.actif = true
       ORDER BY p.type, a.nom`
    );
    res.json(result.rows);
  } catch {
    res.json(MOCK_AGENTS);
  }
});

// POST: authentifier un agent par son code_agent (PIN)
router.post('/auth', async (req, res) => {
  const { code_agent, role } = req.body;
  if (!code_agent) return res.status(400).json({ error: 'code_agent requis' });

  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as poste_nom, p.type as poste_type, p.heure_debut, p.heure_fin
       FROM agents a
       LEFT JOIN postes p ON a.poste_id = p.id
       WHERE a.code_agent = $1 AND a.actif = true`,
      [code_agent]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Code agent invalide' });
    }
    const agent = result.rows[0];
    if (role && agent.role !== role) {
      return res.status(401).json({ error: `Ce code appartient au rôle: ${agent.role}` });
    }
    res.json({ agent });
  } catch {
    // Fallback mock
    const agent = MOCK_AGENTS.find(a => a.code_agent === code_agent);
    if (!agent) return res.status(401).json({ error: 'Code agent invalide' });
    if (role && agent.role !== role) {
      return res.status(401).json({ error: `Ce code appartient au rôle: ${agent.role}` });
    }
    res.json({ agent });
  }
});

// POST créer un agent
router.post('/agents', async (req, res) => {
  try {
    const { nom, prenom, code_agent, poste_id, role } = req.body;
    const result = await pool.query(
      `INSERT INTO agents (nom, prenom, code_agent, poste_id, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nom, prenom, code_agent, poste_id, role || 'agent']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce code agent existe déjà' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT mettre à jour un agent
router.put('/agents/:id', async (req, res) => {
  try {
    const { nom, prenom, code_agent, poste_id, role, actif } = req.body;
    const result = await pool.query(
      `UPDATE agents SET nom=$1, prenom=$2, code_agent=$3, poste_id=$4, role=$5, actif=$6
       WHERE id=$7 RETURNING *`,
      [nom, prenom, code_agent, poste_id, role, actif, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST créer un poste
router.post('/', async (req, res) => {
  try {
    const { nom, type, heure_debut, heure_fin } = req.body;
    const result = await pool.query(
      `INSERT INTO postes (nom, type, heure_debut, heure_fin) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nom, type, heure_debut, heure_fin]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
