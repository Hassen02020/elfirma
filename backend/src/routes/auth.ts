import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = express.Router();

// Agents mock (fallback si DB indisponible)
const MOCK_AGENTS = [
  { id: 1, nom: 'Hamdi',     prenom: 'Ali',    code_agent: '1111', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 2, nom: 'Maaloul',   prenom: 'Sonia',  code_agent: '1122', poste_id: 1, role: 'agent',      poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 3, nom: 'Chaouch',   prenom: 'Karim',  code_agent: '1133', poste_id: 1, role: 'controleur', poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 4, nom: 'Ferchichi', prenom: 'Nizar',  code_agent: '2211', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 5, nom: 'Belhadj',   prenom: 'Rim',    code_agent: '2222', poste_id: 2, role: 'agent',      poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 6, nom: 'Nasri',     prenom: 'Anouar', code_agent: '2233', poste_id: 2, role: 'controleur', poste_nom: 'Poste Nuit', poste_type: 'NUIT' },
  { id: 7, nom: 'Admin',     prenom: 'Comptable',   code_agent: '3333', poste_id: 1, role: 'comptable',  poste_nom: 'Poste Jour', poste_type: 'JOUR' },
  { id: 8, nom: 'Brahmi',    prenom: 'Logistique',  code_agent: '4444', poste_id: 1, role: 'logistique', poste_nom: 'Poste Jour', poste_type: 'JOUR' },
];

router.post('/login', async (req, res) => {
  try {
    const { pin, role } = req.body;
    if (!pin || !role) {
      return res.status(400).json({ error: 'PIN et rôle requis' });
    }

    // Super Admin
    if (role === 'super_admin') {
      const superAdminPin = process.env.PIN_SUPER_ADMIN || '1234';
      if (pin !== superAdminPin) {
        return res.status(401).json({ error: 'PIN incorrect' });
      }
      const token = jwt.sign({ role: 'super_admin', agentId: null, posteId: null }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
      return res.json({ token, role: 'super_admin', agent: { nom: 'Super Admin', poste_nom: '', poste_type: '' } });
    }

    // Chercher l'agent par code_agent (PIN) en DB d'abord
    let agent: any = null;
    try {
      const result = await pool.query(
        `SELECT a.*, p.nom as poste_nom, p.type as poste_type
         FROM agents a
         LEFT JOIN postes p ON a.poste_id = p.id
         WHERE a.code_agent = $1 AND a.actif = true`,
        [pin]
      );
      if (result.rows.length > 0) {
        agent = result.rows[0];
      } else {
        // DB disponible mais agent absent → fallback mock (table non migrée)
        agent = MOCK_AGENTS.find(a => a.code_agent === pin) || null;
      }
    } catch {
      // DB non disponible → fallback mock
      agent = MOCK_AGENTS.find(a => a.code_agent === pin) || null;
    }

    if (!agent) {
      return res.status(401).json({ error: 'Code PIN invalide' });
    }

    // Vérifier que le rôle correspond
    const roleMapping: Record<string, string[]> = {
      agent:      ['agent'],
      controleur: ['controleur'],
      comptable:  ['comptable'],
      logistique: ['logistique'],
    };
    if (!roleMapping[role]?.includes(agent.role)) {
      return res.status(401).json({ error: `Ce code appartient à un "${agent.role}", pas à un "${role}"` });
    }

    const token = jwt.sign(
      { role: agent.role, agentId: agent.id, posteId: agent.poste_id, posteType: agent.poste_type },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      role: agent.role,
      agent: {
        id:          agent.id,
        nom:         agent.nom,
        prenom:      agent.prenom,
        poste_id:    agent.poste_id,
        poste_nom:   agent.poste_nom,
        poste_type:  agent.poste_type,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
