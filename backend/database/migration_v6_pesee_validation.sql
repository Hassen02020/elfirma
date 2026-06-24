-- =============================================================
--  Migration v6 : Validation de pesée avec alertes
--  Ajoute les champs nécessaires pour la logique de calcul d'écart
--  et le système d'alerte temps réel
-- =============================================================

-- Ajouter les nouveaux champs à la table deliveries
ALTER TABLE deliveries 
  ADD COLUMN IF NOT EXISTS poids_factures DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ecart DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statut_validation VARCHAR(20) DEFAULT 'VALIDE' CHECK (statut_validation IN ('VALIDE','EN_ATTENTE','REJETE')),
  ADD COLUMN IF NOT EXISTS controleur_id INTEGER REFERENCES agents(id),
  ADD COLUMN IF NOT EXISTS controleur_commentaire TEXT,
  ADD COLUMN IF NOT EXISTS alerte_envoyee BOOLEAN DEFAULT false;

-- Créer un index sur statut_validation pour les requêtes d'alertes
CREATE INDEX IF NOT EXISTS idx_deliveries_statut_validation ON deliveries(statut_validation);

-- Créer un index sur alerte_envoyee pour le suivi des alertes
CREATE INDEX IF NOT EXISTS idx_deliveries_alerte_envoyee ON deliveries(alerte_envoyee);

-- Commentaire explicatif
COMMENT ON COLUMN deliveries.poids_factures IS 'Somme des poids selon factures';
COMMENT ON COLUMN deliveries.ecart IS 'Écart calculé : (poids_charge - poids_vide) - poids_factures';
COMMENT ON COLUMN deliveries.statut_validation IS 'Statut de validation de la pesée (VALIDE, EN_ATTENTE, REJETE)';
COMMENT ON COLUMN deliveries.controleur_id IS 'Référence au contrôleur qui a validé la pesée';
COMMENT ON COLUMN deliveries.controleur_commentaire IS 'Commentaire du contrôleur lors de la validation';
COMMENT ON COLUMN deliveries.alerte_envoyee IS 'Indique si une alerte a été envoyée pour cette pesée';
