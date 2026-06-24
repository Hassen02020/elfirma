import express from 'express';
import pool from '../db';

const router = express.Router();

/**
 * POST /api/pesee/valider-sortie
 * Valide la pesée de sortie après chargement
 * Calcule l'écart et déclenche une alerte si > 15 kg
 */
router.post('/valider-sortie', async (req, res) => {
  const {
    camion_id,
    chauffeur_id,
    agent_id,
    poste_id,
    poids_vide,
    poids_charge,
    poids_factures,
    nb_caisses_chargees,
    type = 'depart'
  } = req.body;

  // Validation des champs requis
  if (!camion_id || !chauffeur_id || !agent_id || !poste_id) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis: camion_id, chauffeur_id, agent_id, poste_id'
    });
  }

  if (poids_vide === undefined || poids_charge === undefined || poids_factures === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis: poids_vide, poids_charge, poids_factures'
    });
  }

  try {
    // Calcul de l'écart : (poids_charge - poids_vide) - poids_factures
    const ecart = Math.abs((poids_charge - poids_vide) - poids_factures);
    
    // Déterminer le statut de validation
    const statut_validation = ecart > 15 ? 'EN_ATTENTE' : 'VALIDE';
    
    // Calcul du poids net
    const poids_net = Math.max(0, poids_charge - poids_vide);

    // Insérer ou mettre à jour la livraison
    const result = await pool.query(
      `INSERT INTO deliveries
       (camion_id, chauffeur_id, agent_id, poste_id, poids_vide, poids_charge,
        poids_factures, ecart, nb_caisses_chargees, poids_net, statut_validation,
        statut, type, date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EN_COURS', $12, NOW(), NOW())
       RETURNING *`,
      [camion_id, chauffeur_id, agent_id, poste_id, poids_vide, poids_charge,
       poids_factures, ecart, nb_caisses_chargees || 0, poids_net, statut_validation, type]
    );

    const livraison = result.rows[0];

    // Si l'écart > 15 kg, créer une alerte
    let alerte = null;
    if (ecart > 15) {
      // Créer une alerte dans la table des alertes (à créer si nécessaire)
      // Pour l'instant, on retourne l'information d'alerte
      alerte = {
        type: 'ECART_PESEE',
        severite: 'CRITIQUE',
        message: `Écart de pesée important: ${ecart.toFixed(2)} kg (> 15 kg)`,
        livraison_id: livraison.id,
        camion_id,
        chauffeur_id,
        agent_id,
        ecart: ecart.toFixed(2),
        statut_validation: 'EN_ATTENTE',
        date: new Date().toISOString()
      };

      // Marquer l'alerte comme envoyée
      await pool.query(
        `UPDATE deliveries SET alerte_envoyee = true WHERE id = $1`,
        [livraison.id]
      );
    }

    return res.json({
      success: true,
      livraison,
      ecart: ecart.toFixed(2),
      statut_validation,
      alerte,
      message: statut_validation === 'EN_ATTENTE'
        ? 'Écart > 15 kg. Validation contrôleur requise.'
        : 'Pesée validée avec succès.'
    });

  } catch (error) {
    console.error('Erreur validation pesée sortie:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la validation de la pesée'
    });
  }
});

/**
 * POST /api/pesee/valider-controleur
 * Permet au contrôleur de valider ou rejeter une pesée en attente
 */
router.post('/valider-controleur', async (req, res) => {
  const {
    livraison_id,
    controleur_id,
    statut_validation, // 'VALIDE' ou 'REJETE'
    commentaire
  } = req.body;

  if (!livraison_id || !controleur_id || !statut_validation) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis: livraison_id, controleur_id, statut_validation'
    });
  }

  if (!['VALIDE', 'REJETE'].includes(statut_validation)) {
    return res.status(400).json({
      success: false,
      error: 'statut_validation doit être "VALIDE" ou "REJETE"'
    });
  }

  try {
    // Vérifier que la livraison existe et est en attente
    const livraisonCheck = await pool.query(
      `SELECT * FROM deliveries WHERE id = $1 AND statut_validation = 'EN_ATTENTE'`,
      [livraison_id]
    );

    if (livraisonCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Livraison non trouvée ou déjà validée'
      });
    }

    // Mettre à jour la livraison avec la décision du contrôleur
    const result = await pool.query(
      `UPDATE deliveries
       SET statut_validation = $1,
           controleur_id = $2,
           controleur_commentaire = $3,
           statut = $1 = 'VALIDE' ? 'TERMINE' : 'ANNULE',
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [statut_validation, controleur_id, commentaire || '', livraison_id]
    );

    const livraison = result.rows[0];

    return res.json({
      success: true,
      livraison,
      message: statut_validation === 'VALIDE'
        ? 'Pesée validée par le contrôleur'
        : 'Pesée rejetée par le contrôleur'
    });

  } catch (error) {
    console.error('Erreur validation contrôleur:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la validation par le contrôleur'
    });
  }
});

/**
 * GET /api/pesee/alertes
 * Récupère les alertes en attente pour les contrôleurs et super admins
 */
router.get('/alertes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, 
              c.matricule,
              ch.nom as chauffeur_nom,
              a.nom as agent_nom,
              a.role as agent_role
       FROM deliveries d
       LEFT JOIN camions c ON d.camion_id = c.id
       LEFT JOIN chauffeurs ch ON d.chauffeur_id = ch.id
       LEFT JOIN agents a ON d.agent_id = a.id
       WHERE d.statut_validation = 'EN_ATTENTE'
       ORDER BY d.created_at DESC`
    );

    return res.json({
      success: true,
      alertes: result.rows
    });

  } catch (error) {
    console.error('Erreur récupération alertes:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des alertes'
    });
  }
});

/**
 * GET /api/pesee/:id
 * Récupère les détails d'une pesée
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT d.*, 
              c.matricule,
              ch.nom as chauffeur_nom,
              ch.prenom as chauffeur_prenom,
              a.nom as agent_nom,
              a.prenom as agent_prenom,
              ctrl.nom as controleur_nom,
              ctrl.prenom as controleur_prenom
       FROM deliveries d
       LEFT JOIN camions c ON d.camion_id = c.id
       LEFT JOIN chauffeurs ch ON d.chauffeur_id = ch.id
       LEFT JOIN agents a ON d.agent_id = a.id
       LEFT JOIN agents ctrl ON d.controleur_id = ctrl.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pesée non trouvée'
      });
    }

    return res.json({
      success: true,
      pesee: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur récupération pesée:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la pesée'
    });
  }
});

export default router;
