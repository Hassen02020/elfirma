import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/delivery';
import reportRoutes from './routes/report';
import penaltyRoutes from './routes/penalty';
import stockAuditRoutes from './routes/stockAudit';
import signatureRoutes from './routes/signature';
import rewardRoutes from './routes/reward';
import camionRoutes from './routes/camion';
import chauffeurRoutes from './routes/chauffeur';
import secteurRoutes from './routes/secteur';
import produitRoutes from './routes/produit';
import posteRoutes from './routes/poste';
import tourneeRoutes from './routes/tournee';
import agentRoutes from './routes/agent';
import finDeMoisRoutes from './routes/finDeMois';
import validationRoutes from './routes/validation';
import stockVolailleRoutes from './routes/stockVolaille';
import peseeRoutes from './routes/pesee';
import v1Router from './routes/v1/index';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware CORS manuel — prioritaire sur tout le reste
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/penalty', penaltyRoutes);
app.use('/api/stock-audit', stockAuditRoutes);
app.use('/api/signature', signatureRoutes);
app.use('/api/reward', rewardRoutes);
app.use('/api/camion', camionRoutes);
app.use('/api/chauffeur', chauffeurRoutes);
app.use('/api/secteur', secteurRoutes);
app.use('/api/produit', produitRoutes);
app.use('/api/poste', posteRoutes);
app.use('/api/tournee', tourneeRoutes);
app.use('/api/agent',       agentRoutes);
app.use('/api/fin-de-mois', finDeMoisRoutes);
app.use('/api/validation',     validationRoutes);
app.use('/api/stock-volaille', stockVolailleRoutes);
app.use('/api/pesee',          peseeRoutes);
app.use('/api/v1',             v1Router);

app.get('/api/health', (_req, res) => {
  res.json({
    status:  'ok',
    message: 'EL FIRMA Caisse Management API',
    version: '2.0.0',
    v1: {
      stocks:      '/api/v1/stocks/daily',
      expeditions: '/api/v1/expeditions/pesee',
      retours:     '/api/v1/retours/controle',
      bilan:       '/api/v1/chauffeurs/bilan-mensuel',
      sse:         '/api/v1/events/stream',
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'EL FIRMA Caisse Management API',
    version: '1.0.0',
    description: 'API de gestion des caisses pour EL FIRMA',
    endpoints: {
      health: '/api/health',
      auth: {
        login: '/api/auth/login'
      },
      delivery: '/api/delivery',
      report: '/api/report',
      penalty: '/api/penalty',
      stockAudit: '/api/stock-audit',
      signature: '/api/signature',
      reward: '/api/reward',
      agent: '/api/agent',
      camion: '/api/camion',
      chauffeur: '/api/chauffeur',
      secteur: '/api/secteur',
      produit: '/api/produit',
      poste: '/api/poste',
      tournee:      '/api/tournee',
      v1_stocks:   '/api/v1/stocks',
      v1_exped:    '/api/v1/expeditions',
      v1_retours:  '/api/v1/retours',
      v1_bilan:    '/api/v1/chauffeurs/bilan-mensuel',
      v1_sse:      '/api/v1/events/stream',
      pesee:       '/api/pesee',
    },
    documentation: 'Consultez /api/health pour le catalogue complet'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
