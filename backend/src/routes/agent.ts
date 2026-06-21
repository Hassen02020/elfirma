import express from 'express';
import pool from '../db';

const router = express.Router();

const MOCK_AGENTS = [
  { id: 1, nom: 'Hamdi',     prenom: 'Ali',       code_agent: '1111', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 2, nom: 'Maaloul',   prenom: 'Sonia',     code_agent: '1122', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 3, nom: 'Chaouch',   prenom: 'Karim',     code_agent: '1133', poste_id: 1, role: 'controleur', poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 4, nom: 'Ferchichi', prenom: 'Nizar',     code_agent: '2211', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 5, nom: 'Belhadj',   prenom: 'Rim',       code_agent: '2222', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 6, nom: 'Nasri',     prenom: 'Anouar',    code_agent: '2233', poste_id: 2, role: 'controleur', poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 7, nom: 'Admin',     prenom: 'Comptable', code_agent: '3333', poste_id: 1, role: 'comptable',  poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 8, nom: 'Brahmi',    prenom: 'Logistique',code_agent: '4444', poste_id: 1, role: 'logistique', poste_nom: 'Poste Jour', poste_type: 'JOUR' },
];

// GET tous les agents (avec filtre optionnel par role et poste)
router.get('/', async (req, res) => {
  const { role, poste_id, actif } = req.query;
  try {
    let q = `
      SELECT a.*, p.nom as poste_nom, p.type as poste_type
      FROM agents a
      LEFT JOIN postes p ON a.poste_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (role) {
      params.push(role);
      q += ` AND a.role = $${params.length}`;
    }
    if (poste_id) {
      params.push(poste_id);
      q += ` AND a.poste_id = $${params.length}`;
    }
    if (actif !== undefined) {
      params.push(actif === 'true');
      q += ` AND a.actif = $${params.length}`;
    } else {
      q += ` AND a.actif = true`;
    }
    q += ` ORDER BY p.type, a.role, a.nom`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch {
    let filtered = MOCK_AGENTS.filter(a => {
      if (role && a.role !== role) return false;
      if (poste_id && a.poste_id !== parseInt(poste_id as string)) return false;
      return true;
    });
    res.json(filtered);
  }
});

// GET un agent par id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nom as poste_nom, p.type as poste_type
       FROM agents a
       LEFT JOIN postes p ON a.poste_id = p.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent introuvable' });
    res.json(result.rows[0]);
  } catch {
    const a = MOCK_AGENTS.find(a => a.id === parseInt(req.params.id));
    if (!a) return res.status(404).json({ error: 'Agent introuvable' });
    res.json(a);
  }
});

// POST créer un agent
router.post('/', async (req, res) => {
  const { nom, prenom, code_agent, poste_id, role } = req.body;
  if (!nom || !code_agent || !role) {
    return res.status(400).json({ error: 'nom, code_agent et role sont requis' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO agents (nom, prenom, code_agent, poste_id, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [nom, prenom || null, code_agent, poste_id || null, role]
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
router.put('/:id', async (req, res) => {
  const { nom, prenom, code_agent, poste_id, role, actif } = req.body;
  try {
    const result = await pool.query(
      `UPDATE agents
       SET nom=$1, prenom=$2, code_agent=$3, poste_id=$4, role=$5, actif=$6, updated_at=NOW()
       WHERE id=$7
       RETURNING *`,
      [nom, prenom || null, code_agent, poste_id || null, role, actif !== undefined ? actif : true, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent introuvable' });
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ce code agent existe déjà' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE désactiver un agent (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `UPDATE agents SET actif=false, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
