-- ============================================================
-- Migration 002: Postes de travail (Jour/Nuit) + Agents
-- ============================================================

-- Enum type pour les postes
DO $$ BEGIN
  CREATE TYPE type_poste AS ENUM ('JOUR', 'NUIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table des postes de travail
CREATE TABLE IF NOT EXISTS postes (
  id           SERIAL PRIMARY KEY,
  nom          VARCHAR(50) NOT NULL,          -- ex: "Poste Jour", "Poste Nuit"
  type         type_poste NOT NULL,            -- JOUR | NUIT
  heure_debut  TIME NOT NULL,                  -- ex: 06:00
  heure_fin    TIME NOT NULL,                  -- ex: 18:00
  actif        BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Table des agents (opérateurs usine, poste jour ou nuit)
CREATE TABLE IF NOT EXISTS agents (
  id           SERIAL PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,
  prenom       VARCHAR(100),
  code_agent   VARCHAR(20) UNIQUE NOT NULL,    -- code PIN propre à l'agent
  poste_id     INT REFERENCES postes(id) ON DELETE SET NULL,
  role         VARCHAR(30) DEFAULT 'agent',    -- agent | controleur | comptable
  actif        BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Ajouter colonne poste_id aux chauffeurs
ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS poste_id INT REFERENCES postes(id) ON DELETE SET NULL;

-- Ajouter colonne poste_id et agent_id aux livraisons
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poste_id    INT REFERENCES postes(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS agent_id    INT REFERENCES agents(id) ON DELETE SET NULL;

-- Données initiales: postes
INSERT INTO postes (nom, type, heure_debut, heure_fin) VALUES
  ('Poste Jour',  'JOUR', '06:00', '18:00'),
  ('Poste Nuit',  'NUIT', '18:00', '06:00')
ON CONFLICT DO NOTHING;

-- Données initiales: agents (code_agent = PIN de connexion)
INSERT INTO agents (nom, prenom, code_agent, poste_id, role) VALUES
  ('Hamdi',    'Ali',      '1111', 1, 'agent'),       -- Agent Jour
  ('Maaloul',  'Sonia',    '1122', 1, 'agent'),       -- Agent Jour
  ('Chaouch',  'Karim',    '1133', 1, 'controleur'),  -- Controleur Jour
  ('Ferchichi','Nizar',    '2211', 2, 'agent'),       -- Agent Nuit
  ('Belhadj',  'Rim',      '2222', 2, 'agent'),       -- Agent Nuit
  ('Nasri',    'Anouar',   '2233', 2, 'controleur')   -- Controleur Nuit
ON CONFLICT (code_agent) DO NOTHING;

-- Chauffeurs: assigner par défaut au poste jour (id=1)
UPDATE chauffeurs SET poste_id = 1 WHERE poste_id IS NULL;
