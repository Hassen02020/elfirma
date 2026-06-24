-- =============================================================
--  EL FIRMA Caisse Management — Schéma complet PostgreSQL
--  Mise à jour : juin 2026
--  Couvre : Super Admin, Comptable, Contrôleur, Agent pesée,
--           Agent logistique + toutes les routes backend
-- =============================================================

-- =============================================================
--  1. TABLE DE BASE : POSTES DE TRAVAIL
-- =============================================================
CREATE TABLE IF NOT EXISTS postes (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  type        VARCHAR(10)  NOT NULL CHECK (type IN ('JOUR','NUIT')),
  heure_debut VARCHAR(5)   DEFAULT '06:00',
  heure_fin   VARCHAR(5)   DEFAULT '18:00',
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  2. AGENTS (pesée, contrôleur, logistique, comptable)
-- =============================================================
CREATE TABLE IF NOT EXISTS agents (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  prenom      VARCHAR(100),
  code_agent  VARCHAR(20)  UNIQUE NOT NULL,  -- PIN de connexion
  poste_id    INTEGER      REFERENCES postes(id),
  role        VARCHAR(30)  NOT NULL CHECK (role IN ('agent','controleur','logistique','comptable')),
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_code   ON agents(code_agent);
CREATE INDEX IF NOT EXISTS idx_agents_role   ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_poste  ON agents(poste_id);

-- =============================================================
--  3. CHAUFFEURS (enrichi : prenom, code_employe, statut)
-- =============================================================
CREATE TABLE IF NOT EXISTS chauffeurs (
  id                   SERIAL PRIMARY KEY,
  nom                  VARCHAR(100) NOT NULL,
  prenom               VARCHAR(100),
  code_employe         VARCHAR(50)  UNIQUE,
  telephone            VARCHAR(20),
  statut               VARCHAR(20)  DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF','INACTIF','EN_CONGE')),
  stock_caisses_actuel INTEGER      DEFAULT 0,
  created_at           TIMESTAMP    DEFAULT NOW(),
  updated_at           TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  4. CAMIONS (enrichi : serie, modele, statut, updated_at)
-- =============================================================
CREATE TABLE IF NOT EXISTS camions (
  id           SERIAL PRIMARY KEY,
  serie        VARCHAR(50)  UNIQUE,
  matricule    VARCHAR(50)  UNIQUE NOT NULL,
  modele       VARCHAR(100),
  chauffeur_id INTEGER      REFERENCES chauffeurs(id),
  capacite_max INTEGER      DEFAULT 100,
  statut       VARCHAR(20)  DEFAULT 'ACTIF' CHECK (statut IN ('ACTIF','INACTIF','EN_MAINTENANCE')),
  created_at   TIMESTAMP    DEFAULT NOW(),
  updated_at   TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  5. SECTEURS GÉOGRAPHIQUES
-- =============================================================
CREATE TABLE IF NOT EXISTS secteurs (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  description TEXT,
  zone        VARCHAR(50),
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  6. CLIENTS (rattachés à un secteur)
-- =============================================================
CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  telephone   VARCHAR(20),
  adresse     TEXT,
  secteur_id  INTEGER      REFERENCES secteurs(id),
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW(),
  updated_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_secteur ON clients(secteur_id);

-- =============================================================
--  7. PRODUITS VOLAILLE
-- =============================================================
CREATE TABLE IF NOT EXISTS produits (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL,
  code        VARCHAR(30)  UNIQUE NOT NULL,
  unite       VARCHAR(20)  DEFAULT 'caisses',
  actif       BOOLEAN      DEFAULT true,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  8. DELIVERIES / LIVRAISONS (table principale pesée)
--     Alignée avec les colonnes utilisées dans delivery.ts et report.ts
-- =============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id                    SERIAL PRIMARY KEY,
  camion_id             INTEGER      REFERENCES camions(id),
  chauffeur_id          INTEGER      REFERENCES chauffeurs(id),
  agent_id              INTEGER      REFERENCES agents(id),
  poste_id              INTEGER      REFERENCES postes(id),
  secteur_id            INTEGER      REFERENCES secteurs(id),
  poids_vide            DECIMAL(10,2) NOT NULL DEFAULT 0,
  poids_charge          DECIMAL(10,2) NOT NULL DEFAULT 0,
  poids_caisses         DECIMAL(10,2) DEFAULT 0,
  poids_produit         DECIMAL(10,2) DEFAULT 0,
  poids_net             DECIMAL(10,2) DEFAULT 0,
  poids_factures        DECIMAL(10,2) DEFAULT 0,           -- Somme des poids selon factures
  ecart                 DECIMAL(10,2) DEFAULT 0,           -- Écart calculé : (poids_charge - poids_vide) - poids_factures
  nb_caisses_chargees   INTEGER      NOT NULL DEFAULT 0,
  nb_caisses_retournees INTEGER      DEFAULT 0,
  signature             TEXT,
  statut                VARCHAR(20)  DEFAULT 'TERMINE' CHECK (statut IN ('EN_COURS','TERMINE','ANNULE','validee','rejetee')),
  statut_validation     VARCHAR(20)  DEFAULT 'VALIDE' CHECK (statut_validation IN ('VALIDE','EN_ATTENTE','REJETE')), -- Validation de la pesée
  controleur_id         INTEGER      REFERENCES agents(id), -- Contrôleur qui valide
  controleur_commentaire TEXT,                              -- Commentaire du contrôleur
  alerte_envoyee        BOOLEAN      DEFAULT false,        -- Indique si l'alerte a été envoyée
  type                  VARCHAR(10)  DEFAULT 'depart'  CHECK (type IN ('depart','retour')),
  date                  TIMESTAMP    NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMP    DEFAULT NOW(),
  updated_at            TIMESTAMP    DEFAULT NOW()
);

-- Alias SQL pour les rapports qui utilisent "livraisons"
CREATE OR REPLACE VIEW livraisons AS SELECT * FROM deliveries;

CREATE INDEX IF NOT EXISTS idx_deliveries_date      ON deliveries(date);
CREATE INDEX IF NOT EXISTS idx_deliveries_chauffeur ON deliveries(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_camion    ON deliveries(camion_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_type      ON deliveries(type);
CREATE INDEX IF NOT EXISTS idx_deliveries_agent     ON deliveries(agent_id);

-- =============================================================
--  9. LIGNES CLIENTS PAR LIVRAISON (affectations départ)
-- =============================================================
CREATE TABLE IF NOT EXISTS livraison_clients (
  id          SERIAL PRIMARY KEY,
  livraison_id INTEGER     REFERENCES deliveries(id) ON DELETE CASCADE,
  client_id   INTEGER      REFERENCES clients(id),
  produit_id  INTEGER      REFERENCES produits(id),
  nb_caisses  INTEGER      DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  10. TOURNÉES LOGISTIQUES
-- =============================================================
CREATE TABLE IF NOT EXISTS tournees (
  id               SERIAL PRIMARY KEY,
  chauffeur_id     INTEGER      REFERENCES chauffeurs(id),
  camion_id        INTEGER      REFERENCES camions(id),
  secteur_id       INTEGER      REFERENCES secteurs(id),
  produit_id       INTEGER      REFERENCES produits(id),
  agent_id         INTEGER      REFERENCES agents(id),   -- agent logistique
  date_tournee     DATE         NOT NULL DEFAULT CURRENT_DATE,
  poids_cible      NUMERIC(10,2) DEFAULT 0,
  nb_caisses_total INTEGER      DEFAULT 0,
  statut           VARCHAR(20)  DEFAULT 'planifiee' CHECK (statut IN ('planifiee','en_cours','terminee')),
  created_at       TIMESTAMP    DEFAULT NOW(),
  updated_at       TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournees_date    ON tournees(date_tournee);
CREATE INDEX IF NOT EXISTS idx_tournees_camion  ON tournees(camion_id);
CREATE INDEX IF NOT EXISTS idx_tournees_agent   ON tournees(agent_id);

-- =============================================================
--  11. LIGNES DE TOURNÉE (clients affectés)
-- =============================================================
CREATE TABLE IF NOT EXISTS tournee_lignes (
  id          SERIAL PRIMARY KEY,
  tournee_id  INTEGER      REFERENCES tournees(id) ON DELETE CASCADE,
  client_id   INTEGER      REFERENCES clients(id),
  produit_id  INTEGER      REFERENCES produits(id),
  nb_caisses  INTEGER      DEFAULT 0,
  poids_kg    NUMERIC(10,2) DEFAULT 0,
  note        TEXT,
  livre       BOOLEAN      DEFAULT false,
  created_at  TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tl_tournee ON tournee_lignes(tournee_id);

-- =============================================================
--  12. CAISSES LAISSÉES EN EXTÉRIEUR (retour partiel)
-- =============================================================
CREATE TABLE IF NOT EXISTS caisses_laissees (
  id             SERIAL PRIMARY KEY,
  livraison_id   INTEGER      REFERENCES deliveries(id),
  chauffeur_id   INTEGER      REFERENCES chauffeurs(id),
  secteur_id     INTEGER      REFERENCES secteurs(id),
  client_id      INTEGER      REFERENCES clients(id),
  client_nom     VARCHAR(150),  -- si client hors base
  telephone      VARCHAR(20),
  adresse        TEXT,
  nb_caisses     INTEGER      NOT NULL DEFAULT 0,
  date_laissee   DATE         DEFAULT CURRENT_DATE,
  date_recuperee DATE,
  statut         VARCHAR(20)  DEFAULT 'laissee' CHECK (statut IN ('laissee','recuperee','perdue')),
  justification  TEXT,
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cl_chauffeur ON caisses_laissees(chauffeur_id);
CREATE INDEX IF NOT EXISTS idx_cl_statut    ON caisses_laissees(statut);
CREATE INDEX IF NOT EXISTS idx_cl_date      ON caisses_laissees(date_laissee);

-- =============================================================
--  13. CAISSES (inventaire physique)
-- =============================================================
CREATE TABLE IF NOT EXISTS caisses (
  id           SERIAL PRIMARY KEY,
  numero_unique VARCHAR(50)  UNIQUE NOT NULL,
  statut        VARCHAR(20)  DEFAULT 'en_usine'
                CHECK (statut IN ('en_usine','chargee','livree','retournee','en_exterieur')),
  camion_id     INTEGER      REFERENCES camions(id),
  chauffeur_id  INTEGER      REFERENCES chauffeurs(id),
  livraison_id  INTEGER      REFERENCES deliveries(id),
  created_at    TIMESTAMP    DEFAULT NOW(),
  updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caisses_statut    ON caisses(statut);
CREATE INDEX IF NOT EXISTS idx_caisses_chauffeur ON caisses(chauffeur_id);

-- =============================================================
--  14. PESÉES (historique)
-- =============================================================
CREATE TABLE IF NOT EXISTS pesees (
  id           SERIAL PRIMARY KEY,
  livraison_id INTEGER      REFERENCES deliveries(id),
  type         VARCHAR(10)  NOT NULL CHECK (type IN ('VIDE','CHARGE')),
  poids        DECIMAL(10,2) NOT NULL,
  horodatage   TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  15. STOCKS (historique journalier)
-- =============================================================
CREATE TABLE IF NOT EXISTS stocks (
  id                      SERIAL PRIMARY KEY,
  date                    DATE         NOT NULL,
  total_caisses_usine     INTEGER      NOT NULL DEFAULT 0,
  total_caisses_en_transit INTEGER     NOT NULL DEFAULT 0,
  stock_reel              INTEGER,
  stock_fictif            INTEGER,
  caisses_cassees         INTEGER      DEFAULT 0,
  caisses_perimees        INTEGER      DEFAULT 0,
  ecart                   INTEGER      DEFAULT 0,
  created_at              TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  16. PÉNALITÉS
-- =============================================================
CREATE TABLE IF NOT EXISTS penalties (
  id                    SERIAL PRIMARY KEY,
  chauffeur_id          INTEGER      REFERENCES chauffeurs(id),
  chauffeur_nom         VARCHAR(100),
  caisses_non_retournees INTEGER     DEFAULT 0,
  cout_par_caisse       DECIMAL(10,2) DEFAULT 0,
  penalite_totale       DECIMAL(10,2) DEFAULT 0,
  remarque              TEXT,
  date                  TIMESTAMP    DEFAULT NOW(),
  statut                VARCHAR(20)  DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE','VALIDEE','REJETEE')),
  cree_par              VARCHAR(20)  DEFAULT 'comptable'  CHECK (cree_par IN ('comptable','admin')),
  created_at            TIMESTAMP    DEFAULT NOW(),
  updated_at            TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  17. RÉCOMPENSES
-- =============================================================
CREATE TABLE IF NOT EXISTS rewards (
  id             SERIAL PRIMARY KEY,
  chauffeur_id   INTEGER      REFERENCES chauffeurs(id),
  chauffeur_nom  VARCHAR(100),
  montant        DECIMAL(10,2) DEFAULT 0,
  motif          TEXT,
  date           TIMESTAMP    DEFAULT NOW(),
  statut         VARCHAR(20)  DEFAULT 'VALIDEE' CHECK (statut IN ('VALIDEE','REJETEE')),
  cree_par       VARCHAR(20)  DEFAULT 'admin',
  mois_eligibles TEXT[]       DEFAULT '{}',
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  18. SIGNATURES
-- =============================================================
CREATE TABLE IF NOT EXISTS signatures (
  id           SERIAL PRIMARY KEY,
  livraison_id INTEGER      REFERENCES deliveries(id),
  chauffeur    TEXT,
  controleur   TEXT,
  date         TIMESTAMP    DEFAULT NOW(),
  created_at   TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  19. AUDITS STOCK (saisie contrôleur / comptable)
-- =============================================================
CREATE TABLE IF NOT EXISTS stock_audits (
  id              SERIAL PRIMARY KEY,
  date_audit      DATE         NOT NULL DEFAULT CURRENT_DATE,
  stock_initial   INTEGER      DEFAULT 0,
  stock_reel      INTEGER      DEFAULT 0,
  stock_fictif    INTEGER      DEFAULT 0,
  caisses_cassees INTEGER      DEFAULT 0,
  caisses_perimees INTEGER     DEFAULT 0,
  ecart           INTEGER      DEFAULT 0,
  agent_id        INTEGER      REFERENCES agents(id),
  created_at      TIMESTAMP    DEFAULT NOW()
);

-- =============================================================
--  VUES ANALYTIQUES
-- =============================================================

-- Vue Super Admin : aperçu global consolidé
CREATE OR REPLACE VIEW v_dashboard_super_admin AS
SELECT
  (SELECT COUNT(*) FROM agents  WHERE actif = true)               AS nb_agents_actifs,
  (SELECT COUNT(*) FROM agents  WHERE role = 'logistique' AND actif = true) AS nb_agents_logistique,
  (SELECT COUNT(*) FROM agents  WHERE role = 'controleur' AND actif = true) AS nb_controleurs,
  (SELECT COUNT(*) FROM chauffeurs WHERE statut = 'ACTIF')         AS nb_chauffeurs_actifs,
  (SELECT COUNT(*) FROM camions    WHERE statut = 'ACTIF')         AS nb_camions_actifs,
  (SELECT COUNT(*) FROM deliveries WHERE DATE(date) = CURRENT_DATE) AS livraisons_jour,
  (SELECT COUNT(*) FROM caisses    WHERE statut = 'en_usine')      AS stock_usine,
  (SELECT COUNT(*) FROM caisses    WHERE statut = 'en_exterieur')  AS stock_exterieur,
  (SELECT COUNT(*) FROM tournees   WHERE date_tournee = CURRENT_DATE) AS tournees_jour,
  (SELECT COUNT(*) FROM caisses_laissees WHERE statut = 'laissee') AS caisses_non_recuperees;

-- Vue Comptable : rapport mensuel par chauffeur
CREATE OR REPLACE VIEW v_rapport_mensuel AS
SELECT
  ch.id                                     AS chauffeur_id,
  ch.nom                                    AS chauffeur_nom,
  ch.prenom                                 AS chauffeur_prenom,
  cam.matricule,
  EXTRACT(YEAR  FROM d.date)::INT           AS annee,
  EXTRACT(MONTH FROM d.date)::INT           AS mois,
  COUNT(d.id) FILTER (WHERE d.type='depart') AS nb_departs,
  COUNT(d.id) FILTER (WHERE d.type='retour') AS nb_retours,
  COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0) AS total_caisses_chargees,
  COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS total_caisses_retournees,
  COALESCE(SUM(d.nb_caisses_chargees)   FILTER (WHERE d.type='depart'), 0)
    - COALESCE(SUM(d.nb_caisses_retournees) FILTER (WHERE d.type='retour'), 0) AS caisses_ecart,
  COALESCE(SUM(d.poids_net) FILTER (WHERE d.type='depart'), 0) AS total_poids_net_kg
FROM chauffeurs ch
LEFT JOIN deliveries d   ON d.chauffeur_id = ch.id
LEFT JOIN camions    cam ON cam.chauffeur_id = ch.id
GROUP BY ch.id, ch.nom, ch.prenom, cam.matricule,
         EXTRACT(YEAR FROM d.date), EXTRACT(MONTH FROM d.date);

-- Vue Contrôleur : livraisons du jour enrichies
CREATE OR REPLACE VIEW v_livraisons_jour AS
SELECT
  d.*,
  ch.nom          AS chauffeur_nom,
  ch.prenom       AS chauffeur_prenom,
  cam.matricule,
  s.nom           AS secteur_nom,
  a.nom           AS agent_nom,
  a.prenom        AS agent_prenom,
  a.role          AS agent_role,
  p.nom           AS poste_nom,
  p.type          AS poste_type,
  (d.poids_charge - d.poids_vide) AS poids_brut_kg
FROM deliveries d
LEFT JOIN chauffeurs ch  ON ch.id  = d.chauffeur_id
LEFT JOIN camions    cam ON cam.id = d.camion_id
LEFT JOIN secteurs   s   ON s.id   = d.secteur_id
LEFT JOIN agents     a   ON a.id   = d.agent_id
LEFT JOIN postes     p   ON p.id   = d.poste_id
WHERE DATE(d.date) = CURRENT_DATE;

-- Vue Agent logistique : tournées du jour
CREATE OR REPLACE VIEW v_tournees_jour AS
SELECT
  t.*,
  ch.nom          AS chauffeur_nom,
  cam.matricule   AS camion_matricule,
  s.nom           AS secteur_nom,
  pr.nom          AS produit_nom,
  a.nom           AS agent_nom,
  a.prenom        AS agent_prenom
FROM tournees t
LEFT JOIN chauffeurs ch  ON ch.id  = t.chauffeur_id
LEFT JOIN camions    cam ON cam.id = t.camion_id
LEFT JOIN secteurs   s   ON s.id   = t.secteur_id
LEFT JOIN produits   pr  ON pr.id  = t.produit_id
LEFT JOIN agents     a   ON a.id   = t.agent_id
WHERE t.date_tournee = CURRENT_DATE;

-- =============================================================
--  DONNÉES INITIALES
-- =============================================================

-- Postes de travail
INSERT INTO postes (nom, type, heure_debut, heure_fin) VALUES
  ('Poste Jour',  'JOUR', '06:00', '18:00'),
  ('Poste Nuit',  'NUIT', '18:00', '06:00')
ON CONFLICT DO NOTHING;

-- Agents (PIN = code_agent)
INSERT INTO agents (nom, prenom, code_agent, poste_id, role) VALUES
  ('Hamdi',     'Ali',      '1111', 1, 'agent'),
  ('Maaloul',   'Sonia',    '1122', 1, 'agent'),
  ('Lounissi',  'Said',     '1133', 1, 'controleur'),
  ('Ferchichi', 'Nizar',    '2211', 2, 'agent'),
  ('Belhadj',   'Rim',      '2222', 2, 'agent'),
  ('Lounissi',  'Said',     '2233', 2, 'controleur'),
  ('Admin',     'Comptable','3333', 1, 'comptable'),
  ('Brahmi',    'Logistique','4444',1, 'logistique')
ON CONFLICT (code_agent) DO NOTHING;

-- Chauffeurs
INSERT INTO chauffeurs (nom, prenom, code_employe, telephone, statut) VALUES
  ('Ben Ali',    'Ahmed',   'CHF-001', '216 20 123 456', 'ACTIF'),
  ('Trabelsi',   'Mohamed', 'CHF-002', '216 20 234 567', 'ACTIF'),
  ('Bouazizi',   'Sami',    'CHF-003', '216 20 345 678', 'ACTIF')
ON CONFLICT (code_employe) DO NOTHING;

-- Camions
INSERT INTO camions (serie, matricule, modele, chauffeur_id, capacite_max, statut) VALUES
  ('CAM-001', '190 TN 1234', 'Mercedes Actros', 1, 150, 'ACTIF'),
  ('CAM-002', '190 TN 5678', 'Renault Trucks',  2, 150, 'ACTIF'),
  ('CAM-003', '190 TN 9012', 'MAN TGX',         3, 150, 'ACTIF')
ON CONFLICT (matricule) DO NOTHING;

-- Secteurs géographiques
INSERT INTO secteurs (nom, description, zone) VALUES
  ('Secteur Nord',   'Zone nord de la wilaya',   'Nord'),
  ('Secteur Sud',    'Zone sud de la wilaya',    'Sud'),
  ('Secteur Est',    'Zone est de la wilaya',    'Est'),
  ('Secteur Ouest',  'Zone ouest de la wilaya',  'Ouest'),
  ('Secteur Centre', 'Zone centre de la wilaya', 'Centre')
ON CONFLICT DO NOTHING;

-- Clients par secteur
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

-- Produits volaille
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

-- Stock initial : 1000 caisses en usine
INSERT INTO caisses (numero_unique, statut)
SELECT 'ELF-' || LPAD(generate_series(1, 1000)::TEXT, 5, '0'), 'en_usine'
ON CONFLICT DO NOTHING;
