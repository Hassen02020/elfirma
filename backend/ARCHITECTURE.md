# Clean Architecture - Structure de Dossiers

```
backend/
├── src/
│   ├── core/                          # Domain Layer (Business Logic)
│   │   ├── entities/                  # Entités du domaine
│   │   │   ├── Delivery.ts
│   │   │   ├── Chauffeur.ts
│   │   │   ├── Caisse.ts
│   │   │   └── index.ts
│   │   ├── repositories/              # Interfaces des repositories
│   │   │   ├── IDeliveryRepository.ts
│   │   │   ├── IChauffeurRepository.ts
│   │   │   └── index.ts
│   │   ├── use-cases/                 # Cas d'utilisation
│   │   │   ├── delivery/
│   │   │   │   ├── CreateDelivery.ts
│   │   │   │   ├── GetDelivery.ts
│   │   │   │   ├── UpdateDelivery.ts
│   │   │   │   ├── DeleteDelivery.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── services/                  # Services du domaine
│   │       ├── StockService.ts
│   │       ├── PenaltyService.ts
│   │       └── RewardService.ts
│   │
│   ├── infrastructure/                # Infrastructure Layer
│   │   ├── database/                 # Database
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   ├── prisma-client.ts
│   │   │   └── migrations/
│   │   ├── repositories/             # Implémentations des repositories
│   │   │   ├── PrismaDeliveryRepository.ts
│   │   │   ├── PrismaChauffeurRepository.ts
│   │   │   └── index.ts
│   │   └── external/                 # Services externes
│   │       └── email/
│   │
│   ├── application/                  # Application Layer
│   │   ├── dtos/                     # Data Transfer Objects
│   │   │   ├── delivery.dto.ts
│   │   │   ├── chauffeur.dto.ts
│   │   │   └── index.ts
│   │   ├── validators/               # Validation
│   │   │   ├── delivery.validator.ts
│   │   │   └── index.ts
│   │   └── middleware/               # Middleware Express
│   │       ├── auth.middleware.ts
│   │       ├── error.middleware.ts
│   │       └── index.ts
│   │
│   ├── presentation/                # Presentation Layer
│   │   ├── controllers/              # Controllers API
│   │   │   ├── delivery.controller.ts
│   │   │   ├── chauffeur.controller.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── index.ts
│   │   ├── routes/                   # Routes Express
│   │   │   ├── delivery.routes.ts
│   │   │   ├── chauffeur.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   └── index.ts
│   │   └── responses/                # Formatters de réponse
│   │       ├── success.response.ts
│   │       └── error.response.ts
│   │
│   ├── config/                      # Configuration
│   │   ├── index.ts
│   │   ├── database.config.ts
│   │   └── env.config.ts
│   │
│   ├── utils/                       # Utilitaires
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   │
│   ├── types/                       # Types TypeScript globaux
│   │   ├── express.d.ts
│   │   └── index.ts
│   │
│   ├── scripts/                     # Scripts utilitaires
│   │   ├── setupNeon.ts
│   │   └── stressTest.ts
│   │
│   └── index.ts                     # Point d'entrée
│
├── prisma/                          # Prisma (génération automatique)
│   └── schema.prisma
│
├── database/                        # Scripts SQL manuels
│   └── schema.sql
│
├── .env                             # Variables d'environnement
├── .env.example                     # Exemple de variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Principes de Clean Architecture

### 1. Dependency Rule
Les dépendances pointent uniquement vers l'intérieur. Le domaine ne dépend de rien.

### 2. Layers
- **Core (Domain):** Logique métier pure, sans dépendances externes
- **Infrastructure:** Implémentations concrètes (DB, API externes)
- **Application:** Orchestration, DTOs, validation
- **Presentation:** Controllers, routes, formats de réponse

### 3. Benefits
- Testabilité facile
- Maintenance facilitée
- Remplacement d'implémentations sans impact sur le domaine
- Séparation claire des responsabilités
