#!/bin/bash

echo "🚀 Déploiement du backend EL FIRMA..."

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm install

# Application de la migration de base de données
echo "🗄️ Application de la migration v6 (validation de pesée)..."
if [ -f ".env" ]; then
  npx ts-node scripts/migrate.ts
else
  echo "⚠️ Fichier .env non trouvé. Veuillez configurer DATABASE_URL avant de continuer."
  echo "💡 Appliquez manuellement la migration via l'interface Neon:"
  echo "   backend/database/migration_v6_pesee_validation.sql"
fi

# Build TypeScript
echo "🔨 Build TypeScript..."
npm run build

# Deploy sur Vercel
echo "🌐 Déploiement sur Vercel..."
npx vercel --prod

echo "✅ Déploiement terminé !"
