-- ============================================================
-- Migration 003 : Tournées, caisses laissées, livraisons enrichies
-- ============================================================

-- Table tournées (créée par le route mais on la consolide ici)
CREATE TABLE IF NOT EXISTS tournees (
  id               SERIAL PRIMARY KEY,
  chauffeur_id     INT REFERENCES chauffeurs(id) ON DELETE SET NULL,
  camion_id        INT REFERENCES camions(id)    ON DELETE SET NULL,
  secteur_id       INT REFERENCES secteurs(id)   ON DELETE SET NULL,
  produit_id       INT REFERENCES produits(id)   ON DELETE SET NULL,
  agent_id         INT REFERENCES agents(id)     ON DELETE SET NULL,
  date_tournee     DATE NOT NULL DEFAULT CURRENT_DATE,
  poids_cible      NUMERIC(10,2) DEFAULT 0,
  nb_caisses_total INT DEFAULT 0,
  statut           VARCHAR(20) DEFAULT 'planifiee',  -- planifiee | en_cours | terminee
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Lignes de tournée (1 ligne par client)
CREATE TABLE IF NOT EXISTS tournee_lignes (
  id           SERIAL PRIMARY KEY,
  tournee_id   INT NOT NULL REFERENCES tournees(id) ON DELETE CASCADE,
  client_id    INT REFERENCES clients(id) ON DELETE SET NULL,
  produit_id   INT REFERENCES produits(id) ON DELETE SET NULL,
  nb_caisses   INT DEFAULT 0,
  poids_kg     NUMERIC(10,2) DEFAULT 0,
  note         TEXT,
  livre        BOOLEAN DEFAULT false
);

-- Caisses laissées chez les clients (suivi extérieur)
CREATE TABLE IF NOT EXISTS caisses_laissees (
  id              SERIAL PRIMARY KEY,
  livraison_id    INT,               -- référence vers livraisons si disponible
  chauffeur_id    INT REFERENCES chauffeurs(id) ON DELETE SET NULL,
  secteur_id      INT REFERENCES secteurs(id)   ON DELETE SET NULL,
  client_id       INT REFERENCES clients(id)    ON DELETE SET NULL,
  client_nom      VARCHAR(200),      -- pour clients "autre" hors base
  telephone       VARCHAR(50),
  adresse         TEXT,
  nb_caisses      INT DEFAULT 0,
  date_laissee    DATE DEFAULT CURRENT_DATE,
  date_recuperee  DATE,
  nb_recuperees   INT DEFAULT 0,
  statut          VARCHAR(20) DEFAULT 'en_attente',  -- en_attente | partiel | recupere
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Enrichir la table livraisons si elle existe (ajout colonnes manquantes)
DO $$ BEGIN
  -- Ajouter secteur_id si absent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='livraisons' AND column_name='secteur_id') THEN
    ALTER TABLE livraisons ADD COLUMN secteur_id INT REFERENCES secteurs(id) ON DELETE SET NULL;
  END IF;
  -- Ajouter produit_id si absent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='livraisons' AND column_name='produit_id') THEN
    ALTER TABLE livraisons ADD COLUMN produit_id INT REFERENCES produits(id) ON DELETE SET NULL;
  END IF;
  -- Ajouter poids_caisses si absent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='livraisons' AND column_name='poids_caisses') THEN
    ALTER TABLE livraisons ADD COLUMN poids_caisses NUMERIC(10,2) DEFAULT 0;
  END IF;
  -- Ajouter poids_produit si absent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='livraisons' AND column_name='poids_produit') THEN
    ALTER TABLE livraisons ADD COLUMN poids_produit NUMERIC(10,2) DEFAULT 0;
  END IF;
  -- Ajouter tournee_id si absent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='livraisons' AND column_name='tournee_id') THEN
    ALTER TABLE livraisons ADD COLUMN tournee_id INT REFERENCES tournees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_tournees_date        ON tournees(date_tournee);
CREATE INDEX IF NOT EXISTS idx_tournees_chauffeur   ON tournees(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_tournee_lignes_tour  ON tournee_lignes(tournee_id);
CREATE INDEX IF NOT EXISTS idx_caisses_laissees_ch  ON caisses_laissees(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_caisses_laissees_st  ON caisses_laissees(statut);
