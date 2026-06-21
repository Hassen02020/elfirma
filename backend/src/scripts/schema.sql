-- Table pour les pénalités
CREATE TABLE IF NOT EXISTS penalties (
  id SERIAL PRIMARY KEY,
  chauffeur_id INTEGER NOT NULL,
  chauffeur_nom VARCHAR(255) NOT NULL,
  caisses_non_retournees INTEGER NOT NULL,
  cout_par_caisse DECIMAL(10, 2) NOT NULL,
  penalite_totale DECIMAL(10, 2) NOT NULL,
  remarque TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les audits de stock
CREATE TABLE IF NOT EXISTS stock_audits (
  id SERIAL PRIMARY KEY,
  stock_initial INTEGER NOT NULL,
  stock_reel INTEGER NOT NULL,
  caisses_cassees INTEGER NOT NULL,
  caisses_perimees INTEGER NOT NULL,
  date_audit DATE NOT NULL,
  ecart INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_penalties_chauffeur ON penalties(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_penalties_date ON penalties(date);
CREATE INDEX IF NOT EXISTS idx_stock_audits_date ON stock_audits(date_audit);
