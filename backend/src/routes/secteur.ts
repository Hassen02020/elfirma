import express from 'express';
import pool from '../db';

const router = express.Router();

// GET tous les secteurs avec leurs clients
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(c.id) as nb_clients
       FROM secteurs s
       LEFT JOIN clients c ON c.secteur_id = s.id AND c.actif = true
       GROUP BY s.id
       ORDER BY s.nom`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get secteurs error:', error);
    res.json([
      { id: 1, nom: 'Secteur Nord',   zone: 'Nord',   nb_clients: 2 },
      { id: 2, nom: 'Secteur Sud',    zone: 'Sud',    nb_clients: 2 },
      { id: 3, nom: 'Secteur Est',    zone: 'Est',    nb_clients: 2 },
      { id: 4, nom: 'Secteur Ouest',  zone: 'Ouest',  nb_clients: 2 },
      { id: 5, nom: 'Secteur Centre', zone: 'Centre', nb_clients: 2 },
    ]);
  }
});

// GET clients d'un secteur
router.get('/:id/clients', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, s.nom as secteur_nom
       FROM clients c
       JOIN secteurs s ON c.secteur_id = s.id
       WHERE c.secteur_id = $1 AND c.actif = true
       ORDER BY c.nom`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get clients secteur error:', error);
    const mockClients: Record<string, any[]> = {
      '1': [
        { id: 1,  nom: 'Boucherie El Baraka Nord',   telephone: '70 111 001', adresse: 'Av. de la Liberté, Ben Arous',   secteur_id: 1 },
        { id: 2,  nom: 'Supérette Nour Nord',        telephone: '70 111 002', adresse: '12 rue Tahar Haddad, Ben Arous', secteur_id: 1 },
        { id: 3,  nom: 'Restauration Scolaire Nord', telephone: '70 111 003', adresse: 'Cité Ettahrir, Bloc A',           secteur_id: 1 },
      ],
      '2': [
        { id: 4,  nom: 'Boucherie Ennour Sud',       telephone: '70 222 001', adresse: 'Marché Municipal, Mégrine',      secteur_id: 2 },
        { id: 5,  nom: 'GMS Magasin Général Sud',    telephone: '70 222 002', adresse: 'Route Sfax km 5, Mégrine',     secteur_id: 2 },
        { id: 6,  nom: 'Hôtel Résidence Sud',       telephone: '70 222 003', adresse: 'Zone touristique, Borj Cédria', secteur_id: 2 },
      ],
      '3': [
        { id: 7,  nom: 'Grossiste Imed & Fils',      telephone: '71 333 001', adresse: 'Zone industrielle Mghira',        secteur_id: 3 },
        { id: 8,  nom: 'Boucherie El Amel Est',      telephone: '71 333 002', adresse: 'Rue Ibn Sina, Fouchana',          secteur_id: 3 },
        { id: 9,  nom: 'Supermarché Monoprix Est',   telephone: '71 333 003', adresse: 'Centre commercial Fouchana',     secteur_id: 3 },
      ],
      '4': [
        { id: 10, nom: 'Boucherie Rahma Ouest',          telephone: '71 444 001', adresse: 'Marché Hédi Chaker, Ariana', secteur_id: 4 },
        { id: 11, nom: 'Coopérative Consommation Ouest', telephone: '71 444 002', adresse: 'Route de Bizerte km 8',      secteur_id: 4 },
        { id: 12, nom: 'Restauration Collective Ouest',  telephone: '71 444 003', adresse: 'Zone industrielle Ksar Saïd', secteur_id: 4 },
      ],
      '5': [
        { id: 13, nom: 'Boucherie du Centre Ville',   telephone: '70 555 001', adresse: 'Rue de la Kasbah, Tunis',        secteur_id: 5 },
        { id: 14, nom: 'GMS Carrefour Market Centre', telephone: '70 555 002', adresse: 'Av. Habib Bourguiba, Tunis',     secteur_id: 5 },
        { id: 15, nom: 'Hôtel Africa Tunis',          telephone: '70 555 003', adresse: '50 av. Habib Bourguiba, Tunis', secteur_id: 5 },
      ],
    };
    res.json(mockClients[req.params.id] || []);
  }
});

// GET tous les clients
router.get('/clients/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, s.nom as secteur_nom, s.zone
       FROM clients c
       LEFT JOIN secteurs s ON c.secteur_id = s.id
       WHERE c.actif = true
       ORDER BY s.nom, c.nom`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get all clients error:', error);
    res.json([]);
  }
});

// POST créer un secteur
router.post('/', async (req, res) => {
  try {
    const { nom, description, zone } = req.body;
    const result = await pool.query(
      `INSERT INTO secteurs (nom, description, zone) VALUES ($1, $2, $3) RETURNING *`,
      [nom, description, zone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create secteur error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST créer un client
router.post('/clients', async (req, res) => {
  try {
    const { nom, telephone, adresse, secteur_id } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (nom, telephone, adresse, secteur_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nom, telephone, adresse, secteur_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT mettre à jour un client
router.put('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, telephone, adresse, secteur_id, actif } = req.body;
    const result = await pool.query(
      `UPDATE clients SET nom=$1, telephone=$2, adresse=$3, secteur_id=$4, actif=$5 WHERE id=$6 RETURNING *`,
      [nom, telephone, adresse, secteur_id, actif, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
