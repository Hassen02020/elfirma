#!/bin/bash

echo "🗄️ Application de la migration v6 (validation de pesée)..."
echo "============================================================"

# Vérifier si DATABASE_URL est défini
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur: DATABASE_URL n'est pas défini."
  echo "💡 Veuillez définir DATABASE_URL dans votre fichier .env ou en variable d'environnement."
  echo ""
  echo "Exemple:"
  echo "  export DATABASE_URL='postgresql://user:password@host/database?sslmode=require'"
  echo "  ./scripts/apply-migration.sh"
  exit 1
fi

# Appliquer la migration
echo "📡 Connexion à la base de données..."
psql "$DATABASE_URL" -f database/migration_v6_pesee_validation.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration v6 appliquée avec succès !"
  echo "📋 Champs ajoutés :"
  echo "   - poids_factures (DECIMAL)"
  echo "   - ecart (DECIMAL)"
  echo "   - statut_validation (VARCHAR)"
  echo "   - controleur_id (INTEGER)"
  echo "   - controleur_commentaire (TEXT)"
  echo "   - alerte_envoyee (BOOLEAN)"
  echo ""
  echo "📊 Index créés :"
  echo "   - idx_deliveries_statut_validation"
  echo "   - idx_deliveries_alerte_envoyee"
else
  echo ""
  echo "❌ Erreur lors de l'application de la migration."
  echo "💡 Veuillez vérifier votre connexion à la base de données."
  exit 1
fi
