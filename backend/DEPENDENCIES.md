# Dépendances NPM

## Dépendances de Production

```json
{
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1",
    "date-fns": "^3.3.1",
    "winston": "^3.11.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "rate-limiter-flexible": "^4.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "reflect-metadata": "^0.2.1"
  }
}
```

## Dépendances de Développement

```json
{
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/compression": "^1.7.5",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "prisma": "^5.7.0",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/supertest": "^6.0.2",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "prettier": "^3.1.1"
  }
}
```

## Description des Dépendances

### Production
- **@prisma/client**: Client Prisma pour interagir avec la base de données
- **express**: Framework web pour Node.js
- **cors**: Middleware pour gérer CORS
- **dotenv**: Gestion des variables d'environnement
- **bcryptjs**: Hachage des mots de passe (PIN)
- **jsonwebtoken**: Génération et validation des tokens JWT
- **express-validator**: Validation des requêtes
- **date-fns**: Manipulation des dates
- **winston**: Logger professionnel
- **helmet**: Sécurité HTTP headers
- **compression**: Compression des réponses
- **rate-limiter-flexible**: Rate limiting pour prévenir les attaques
- **class-transformer**: Transformation des objets (DTOs)
- **class-validator**: Validation décorateur-based
- **reflect-metadata**: Métadonnées pour class-validator

### Développement
- **@types/***: Types TypeScript pour les packages
- **typescript**: Compilateur TypeScript
- **tsx**: Exécution TypeScript directe
- **prisma**: CLI Prisma
- **ts-node**: Exécution TypeScript avec Node
- **nodemon**: Redémarrage automatique en développement
- **jest**: Framework de tests
- **supertest**: Tests d'API HTTP
- **eslint**: Linter JavaScript/TypeScript
- **prettier**: Formateur de code

## Commandes d'Installation

```bash
# Installation des dépendances de production
npm install @prisma/client express cors dotenv bcryptjs jsonwebtoken express-validator date-fns winston helmet compression rate-limiter-flexible class-transformer class-validator reflect-metadata

# Installation des dépendances de développement
npm install -D @types/express @types/cors @types/bcryptjs @types/jsonwebtoken @types/compression @types/node typescript tsx prisma ts-node nodemon jest @types/jest ts-jest supertest @types/supertest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier

# Installation Prisma
npm install prisma --save-dev
npx prisma generate
```

## Scripts package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\""
  }
}
```
