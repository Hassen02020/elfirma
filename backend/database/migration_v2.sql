-- =============================================================
--  EL FIRMA — Migration v2 (juin 2026)
--  À exécuter sur une base existante pour la mettre à niveau
--  sans perte de données. Toutes les opérations sont idempotentes.
-- =============================================================

-- ─── 1. POSTES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postes (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  type        VARCHAR(10)  NOT NULL DEFAULT 'JOUR',
  heure_debut VARCHAR(5)   DEFAULT '06:00',
  heure_fin   VARCHAR(5)   DEFAULT '18:00',
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW()
);
INSERT INTO postes (nom, type, heure_debut, heure_fin) VALUES
  ('Poste Jour', 'JOUR', '06:00', '18:00'),
  ('Poste Nuit', 'NUIT', '18:00', '06:00')
ON CONFLICT DO NOTHING;

-- ─── 2. AGENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id         SERIAL PRIMARY KEY,
  nom        VARCHAR(100) NOT NULL,
  prenom     VARCHAR(100),
  code_agent VARCHAR(20)  UNIQUE NOT NULL,
  poste_id   INTEGER      REFERENCES postes(id),
  role       VARCHAR(30)  NOT NULL DEFAULT 'agent',
  actif      BOOLEAN      DEFAULT true,
  created_at TIMESTAMP    DEFAULT NOW(),
  updated_at TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agents_code  ON agents(code_agent);
CREATE INDEX IF NOT EXISTS idx_agents_role  ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_poste ON agents(poste_id);

INSERT INTO agents (nom, prenom, code_agent, poste_id, role) VALUES
  ('Hamdi',     'Ali',        '1111', 1, 'agent'),
  ('Maaloul',   'Sonia',      '1122', 1, 'agent'),
  ('Chaouch',   'Karim',      '1133', 1, 'controleur'),
  ('Ferchichi', 'Nizar',      '2211', 2, 'agent'),
  ('Belhadj',   'Rim',        '2222', 2, 'agent'),
  ('Nasri',     'Anouar',     '2233', 2, 'controleur'),
  ('Admin',     'Comptable',  '3333', 1, 'comptable'),
  ('Brahmi',    'Logistique', '4444', 1, 'logistique')
ON CONFLICT (code_agent) DO NOTHING;

-- ─── 3. CHAUFFEURS : nouvelles colonnes ──────────────────────
ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS prenom       VARCHAR(100);
ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS code_employe VARCHAR(50) UNIQUE;
ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS statut       VARCHAR(20) DEFAULT 'ACTIF';
ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP   DEFAULT NOW();

-- ─── 4. CAMIONS : nouvelles colonnes ─────────────────────────
ALTER TABLE camions ADD COLUMN IF NOT EXISTS serie      VARCHAR(50) UNIQUE;
ALTER TABLE camions ADD COLUMN IF NOT EXISTS modele     VARCHAR(100);
ALTER TABLE camions ADD COLUMN IF NOT EXISTS statut     VARCHAR(20) DEFAULT 'ACTIF';
ALTER TABLE camions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP   DEFAULT NOW();

-- ─── 5. SECTEURS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secteurs (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  description TEXT,
  zone        VARCHAR(50),
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW()
);
INSERT INTO secteurs (nom, description, zone) VALUES
  ('Secteur Nord',   'Zone nord',   'Nord'),
  ('Secteur Sud',    'Zone sud',    'Sud'),
  ('Secteur Est',    'Zone est',    'Est'),
  ('Secteur Ouest',  'Zone ouest',  'Ouest'),
  ('Secteur Centre', 'Zone centre', 'Centre')
ON CONFLICT DO NOTHING;

-- ─── 6. CLIENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         SERIAL PRIMARY KEY,
  nom        VARCHAR(150) NOT NULL,
  telephone  VARCHAR(20),
  adresse    TEXT,
  secteur_id INTEGER      REFERENCES secteurs(id),
  actif      BOOLEAN      DEFAULT true,
  created_at TIMESTAMP    DEFAULT NOW(),
  updated_at TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clients_secteur ON clients(secteur_id);

INSERT INTO clients (nom, telephone, adresse, secteur_id) VALUES
  ('Boucherie El Baraka Nord',       '70 111 001', 'Av. de la Liberté, Ben Arous',    1),
  ('Supérette Nour Nord',            '70 111 002', '12 rue Tahar Haddad, Ben Arous',  1),
  ('Restauration Scolaire Nord',     '70 111 003', 'Cité Ettahrir, Bloc A',           1),
  ('Boucherie Ennour Sud',           '70 222 001', 'Marché Municipal, Mégrine',       2),
  ('GMS Magasin Général Sud',        '70 222 002', 'Route Sfax km 5, Mégrine',        2),
  ('Hôtel Résidence Sud',            '70 222 003', 'Zone touristique, Borj Cédria',   2),
  ('Grossiste Imed & Fils',          '71 333 001', 'Zone industrielle Mghira',        3),
  ('Boucherie El Amel Est',          '71 333 002', 'Rue Ibn Sina, Fouchana',          3),
  ('Supermarché Monoprix Est',       '71 333 003', 'Centre commercial Fouchana',      3),
  ('Boucherie Rahma Ouest',          '71 444 001', 'Marché Hédi Chaker, Ariana',      4),
  ('Coopérative Consommation Ouest', '71 444 002', 'Route de Bizerte km 8',           4),
  ('Restauration Collective Ouest',  '71 444 003', 'Zone industrielle Ksar Saïd',     4),
  ('Boucherie du Centre Ville',      '70 555 001', 'Rue de la Kasbah, Tunis',         5),
  ('GMS Carrefour Market Centre',    '70 555 002', 'Av. Habib Bourguiba, Tunis',      5),
  ('Hôtel Africa Tunis',             '70 555 003', '50 av. Habib Bourguiba, Tunis',   5)
ON CONFLICT DO NOTHING;

-- ─── 7. PRODUITS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produits (
  id         SERIAL PRIMARY KEY,
  nom        VARCHAR(150) NOT NULL,
  code       VARCHAR(30)  UNIQUE NOT NULL,
  unite      VARCHAR(20)  DEFAULT 'caisses',
  actif      BOOLEAN      DEFAULT true,
  created_at TIMESTAMP    DEFAULT NOW()
);
INSERT INTO produits (nom, code, unite) VALUES
  ('Poulet Entier Frais',      'VOL-001', 'caisses'),
  ('Poulet Entier Congelé',    'VOL-002', 'caisses'),
  ('Découpe Cuisse/Pilon',     'VOL-003', 'caisses'),
  ('Blanc de Poulet',          'VOL-004', 'caisses'),
  ('Ailes de Poulet',          'VOL-005', 'caisses'),
  ('Foie & Abats de Volaille', 'VOL-006', 'caisses'),
  ('Dinde Entière',            'VOL-007', 'caisses'),
  ('Découpe Dinde',            'VOL-008', 'caisses')
ON CONFLICT (code) DO NOTHING;

-- ─── 8. DELIVERIES : nouvelles colonnes ──────────────────────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS agent_id      INTEGER REFERENCES agents(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poste_id      INTEGER REFERENCES postes(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS secteur_id    INTEGER REFERENCES secteurs(id);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poids_caisses DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poids_produit DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS poids_net     DECIMAL(10,2) DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS type          VARCHAR(10)   DEFAULT 'depart';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP     DEFAULT NOW();

-- Normaliser le statut si besoin (EN_COURS/TERMINE -> minuscules)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='deliveries' AND column_name='statut') THEN
    UPDATE deliveries SET statut = 'TERMINE' WHERE statut = 'termine';
    UPDATE deliveries SET statut = 'EN_COURS' WHERE statut = 'en_cours';
    UPDATE deliveries SET statut = 'ANNULE'   WHERE statut = 'annule';
  END IF;
END $$;

-- Vue livraisons (alias pour report.ts qui utilise "livraisons")
CREATE OR REPLACE VIEW livraisons AS SELECT * FROM deliveries;

CREATE INDEX IF NOT EXISTS idx_deliveries_type  ON deliveries(type);
CREATE INDEX IF NOT EXISTS idx_deliveries_agent ON deliveries(agent_id);

-- ─── 9. LIVRAISON_CLIENTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS livraison_clients (
  id           SERIAL PRIMARY KEY,
  livraison_id INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
  client_id    INTEGER REFERENCES clients(id),
  produit_id   INTEGER REFERENCES produits(id),
  nb_caisses   INTEGER DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ─── 10. TOURNEES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournees (
  id               SERIAL PRIMARY KEY,
  chauffeur_id     INTEGER REFERENCES chauffeurs(id),
  camion_id        INTEGER REFERENCES camions(id),
  secteur_id       INTEGER REFERENCES secteurs(id),
  produit_id       INTEGER REFERENCES produits(id),
  agent_id         INTEGER REFERENCES agents(id),
  date_tournee     DATE    NOT NULL DEFAULT CURRENT_DATE,
  poids_cible      NUMERIC(10,2) DEFAULT 0,
  nb_caisses_total INTEGER DEFAULT 0,
  statut           VARCHAR(20) DEFAULT 'planifiee',
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournees_date   ON tournees(date_tournee);
CREATE INDEX IF NOT EXISTS idx_tournees_camion ON tournees(camion_id);
CREATE INDEX IF NOT EXISTS idx_tournees_agent  ON tournees(agent_id);

-- ─── 11. TOURNEE_LIGNES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournee_lignes (
  id         SERIAL PRIMARY KEY,
  tournee_id INTEGER REFERENCES tournees(id) ON DELETE CASCADE,
  client_id  INTEGER REFERENCES clients(id),
  produit_id INTEGER REFERENCES produits(id),
  nb_caisses INTEGER DEFAULT 0,
  poids_kg   NUMERIC(10,2) DEFAULT 0,
  note       TEXT,
  livre      BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tl_tournee ON tournee_lignes(tournee_id);

-- ─── 12. CAISSES_LAISSEES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS caisses_laissees (
  id             SERIAL PRIMARY KEY,
  livraison_id   INTEGER REFERENCES deliveries(id),
  chauffeur_id   INTEGER REFERENCES chauffeurs(id),
  secteur_id     INTEGER REFERENCES secteurs(id),
  client_id      INTEGER REFERENCES clients(id),
  client_nom     VARCHAR(150),
  telephone      VARCHAR(20),
  adresse        TEXT,
  nb_caisses     INTEGER NOT NULL DEFAULT 0,
  date_laissee   DATE    DEFAULT CURRENT_DATE,
  date_recuperee DATE,
  statut         VARCHAR(20) DEFAULT 'laissee',
  justification  TEXT,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cl_chauffeur ON caisses_laissees(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_cl_statut    ON caisses_laissees(statut);
CREATE INDEX IF NOT EXISTS idx_cl_date      ON caisses_laissees(date_laissee);

-- ─── 13. STOCK_AUDITS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_audits (
  id               SERIAL PRIMARY KEY,
  date_audit       DATE    NOT NULL DEFAULT CURRENT_DATE,
  stock_initial    INTEGER DEFAULT 0,
  stock_reel       INTEGER DEFAULT 0,
  stock_fictif     INTEGER DEFAULT 0,
  caisses_cassees  INTEGER DEFAULT 0,
  caisses_perimees INTEGER DEFAULT 0,
  ecart            INTEGER DEFAULT 0,
  agent_id         INTEGER REFERENCES agents(id),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ─── 14. STOCKS : nouvelles colonnes ─────────────────────────
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS stock_reel       INTEGER;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS stock_fictif     INTEGER;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS caisses_cassees  INTEGER DEFAULT 0;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS caisses_perimees INTEGER DEFAULT 0;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS ecart            INTEGER DEFAULT 0;

-- ─── 15. VUES ANALYTIQUES ────────────────────────────────────

-- Super Admin : aperçu global
CREATE OR REPLACE VIEW v_dashboard_super_admin AS
SELECT
  (SELECT COUNT(*) FROM agents      WHERE actif = true)                          AS nb_agents_actifs,
  (SELECT COUNT(*) FROM agents      WHERE role = 'logistique' AND actif = true)  AS nb_agents_logistique,
  (SELECT COUNT(*) FROM agents      WHERE role = 'controleur' AND actif = true)  AS nb_controleurs,
  (SELECT COUNT(*) FROM chauffeurs  WHERE statut = 'ACTIF')                      AS nb_chauffeurs_actifs,
  (SELECT COUNT(*) FROM camions     WHERE statut = 'ACTIF')                      AS nb_camions_actifs,
  (SELECT COUNT(*) FROM deliveries  WHERE DATE(date) = CURRENT_DATE)             AS livraisons_jour,
  (SELECT COUNT(*) FROM caisses     WHERE statut = 'en_usine')                   AS stock_usine,
  (SELECT COUNT(*) FROM caisses     WHERE statut = 'en_exterieur')               AS stock_exterieur,
  (SELECT COUNT(*) FROM tournees    WHERE date_tournee = CURRENT_DATE)           AS tournees_jour,
  (SELECT COUNT(*) FROM caisses_laissees WHERE statut = 'laissee')               AS caisses_non_recuperees;

-- Comptable : rapport mensuel par chauffeur
CREATE OR REPLACE VIEW v_rapport_mensuel AS
SELECT
  ch.id                                       AS chauffeur_id,
  ch.nom                                      AS chauffeur_nom,
  ch.prenom                                   AS chauffeur_prenom,
  cam.matricule,
  EXTRACT(YEAR  FROM d.date)::INT             AS annee,
  EXTRACT(MONTH FROM d.date)::INT             AS mois,
  COUNT(d.id) FILTER (WHERE d.type='depart')  AS nb_departs,
  COUNT(d.id) FILTER (WHERE d.type='retour')  AS nb_retours,
  COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0) AS total_caisses_chargees,
  COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS total_caisses_retournees,
  COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0)
    - COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS caisses_ecart,
  COALESCE(SUM(d.poids_net) FILTER (WHERE d.type='depart'), 0)            AS total_poids_net_kg
FROM chauffeurs ch
LEFT JOIN deliveries d   ON d.chauffeur_id = ch.id
LEFT JOIN camions    cam ON cam.chauffeur_id = ch.id
GROUP BY ch.id, ch.nom, ch.prenom, cam.matricule,
         EXTRACT(YEAR FROM d.date), EXTRACT(MONTH FROM d.date);

-- Contrôleur : livraisons du jour enrichies
CREATE OR REPLACE VIEW v_livraisons_jour AS
SELECT
  d.*,
  ch.nom     AS chauffeur_nom,
  ch.prenom  AS chauffeur_prenom,
  cam.matricule,
  s.nom      AS secteur_nom,
  a.nom      AS agent_nom,
  a.prenom   AS agent_prenom,
  a.role     AS agent_role,
  p.nom      AS poste_nom,
  p.type     AS poste_type,
  (d.poids_charge - d.poids_vide) AS poids_brut_kg
FROM deliveries d
LEFT JOIN chauffeurs ch  ON ch.id  = d.chauffeur_id
LEFT JOIN camions    cam ON cam.id = d.camion_id
LEFT JOIN secteurs   s   ON s.id   = d.secteur_id
LEFT JOIN agents     a   ON a.id   = d.agent_id
LEFT JOIN postes     p   ON p.id   = d.poste_id
WHERE DATE(d.date) = CURRENT_DATE;

-- Agent logistique : tournées du jour
CREATE OR REPLACE VIEW v_tournees_jour AS
SELECT
  t.*,
  ch.nom        AS chauffeur_nom,
  cam.matricule AS camion_matricule,
  s.nom         AS secteur_nom,
  pr.nom        AS produit_nom,
  a.nom         AS agent_nom,
  a.prenom      AS agent_prenom
FROM tournees t
LEFT JOIN chauffeurs ch  ON ch.id  = t.chauffeur_id
LEFT JOIN camions    cam ON cam.id = t.camion_id
LEFT JOIN secteurs   s   ON s.id   = t.secteur_id
LEFT JOIN produits   pr  ON pr.id  = t.produit_id
LEFT JOIN agents     a   ON a.id   = t.agent_id
WHERE t.date_tournee = CURRENT_DATE;

-- ─── FIN DE LA MIGRATION ────────────────────────────────────
