# EL FIRMA - Gestion des Caisses de Livraison

Application de gestion des caisses de livraison pour l'abattoir de volaille EL FIRMA.

## Fonctionnalités

- **Gestion des livraisons**: Saisie des pesées (vide/chargé), nombre de caisses chargées et retournées
- **Calcul automatique du poids**: Validation du poids (700g par caisse ±5%)
- **Authentification par code PIN**: Accès sécurisé pour les différents rôles
- **Dashboard temps réel**: Suivi du stock des caisses (usine/extérieur)
- **Rapports mensuels**: Export des rapports par chauffeur avec alertes de rupture de stock
- **Signature numérique**: Signature des bons de livraison

## Rôles utilisateurs

- **Super Admin**: Accès complet au dashboard et aux rapports
- **Contrôleur**: Validation des opérations
- **Comptable**: Accès aux rapports financiers
- **Agent**: Saisie des données de livraison

## Architecture

- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Base de données**: PostgreSQL

## Installation

### Prérequis

- Node.js (v18 ou supérieur)
- PostgreSQL (v12 ou supérieur)
- npm ou yarn

### Configuration de la base de données

1. Créer la base de données PostgreSQL:
```sql
CREATE DATABASE elfirma_caisse;
```

2. Exécuter le script de schéma:
```bash
cd backend
psql -U postgres -d elfirma_caisse -f database/schema.sql
```

### Installation des dépendances

```bash
# Installer toutes les dépendances
npm run install:all
```

Ou manuellement:
```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### Configuration des variables d'environnement

Modifier le fichier `backend/.env`:
```env
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/elfirma_caisse
JWT_SECRET=your-secret-key-change-in-production
PIN_SUPER_ADMIN=1234
```

### Lancement de l'application

```bash
# Lancer le frontend et le backend simultanément
npm run dev
```

Ou manuellement:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

L'application sera accessible sur:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Codes PIN par défaut

- **Super Admin**: 1234 (configurable dans .env)
- **Agent**: À configurer dans la base de données
- **Contrôleur**: À configurer dans la base de données
- **Comptable**: À configurer dans la base de données

## Structure du projet

```
elfirma-caisse-management/
├── frontend/                 # Application React
│   ├── src/
│   │   ├── contexts/       # Contextes React (Auth)
│   │   ├── pages/          # Pages (Login, Agent, Admin)
│   │   └── App.tsx
│   ├── package.json
│   └── tailwind.config.js
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── routes/         # Routes API
│   │   ├── db/             # Configuration base de données
│   │   └── index.ts
│   ├── database/
│   │   └── schema.sql      # Schéma PostgreSQL
│   ├── package.json
│   └── .env
└── README.md
```

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion avec PIN

### Livraisons
- `POST /api/delivery` - Créer une livraison
- `GET /api/delivery/today` - Livraisons du jour
- `GET /api/delivery/month/:year/:month` - Livraisons du mois
- `GET /api/delivery/chauffeur/:chauffeurId` - Livraisons par chauffeur

### Rapports
- `GET /api/report/stock` - Stock actuel
- `GET /api/report/monthly/:year/:month` - Rapport mensuel
- `GET /api/report/daily/:date` - Statistiques journalières
- `GET /api/report/alerts` - Alertes de rupture de stock

## Seuils d'alerte de stock

- **Critique**: < 50 caisses (alerte rouge)
- **Faible**: 50-100 caisses (alerte orange)
- **Normal**: > 100 caisses (vert)

## Développement

### Lancer uniquement le frontend
```bash
cd frontend
npm run dev
```

### Lancer uniquement le backend
```bash
cd backend
npm run dev
```

### Build pour production
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm run build
npm start
```

## Support

Pour toute question ou problème, contactez l'équipe technique EL FIRMA.

---

© 2026 EL FIRMA - Gestion des Caisses de Livraison
