-- ═══════════════════════════════════════════════════════════════════
-- Migration v5 — RBAC, Audit Logs, colonnes v1, table alertes_actives
-- Idempotente : utilise IF NOT EXISTS / DO $$ EXCEPTION WHEN
-- ═══════════════════════════════════════════════════════════════════

-- 1. Table audit_logs (traces RBAC)
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  agent_id   INT        REFERENCES agents(id) ON DELETE SET NULL,
  role       VARCHAR(30) NOT NULL,
  action     VARCHAR(100) NOT NULL,
  resource   VARCHAR(100) NOT NULL,
  ip         VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent   ON audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 2. Table alertes_actives (SSE + historique)
CREATE TABLE IF NOT EXISTS alertes_actives (
  id            BIGSERIAL PRIMARY KEY,
  type          VARCHAR(60)  NOT NULL,           -- ECART_POIDS_CHARGEMENT | ECART_CAISSES_RETOUR
  niveau        VARCHAR(20)  NOT NULL DEFAULT 'ALERTE', -- ALERTE | CRITIQUE
  livraison_id  INT          REFERENCES deliveries(id) ON DELETE SET NULL,
  message       TEXT         NOT NULL,
  resolue       BOOLEAN      NOT NULL DEFAULT false,
  resolu_par    INT          REFERENCES agents(id) ON DELETE SET NULL,
  resolu_motif  TEXT,
  resolu_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alertes_livraison ON alertes_actives(livraison_id);
CREATE INDEX IF NOT EXISTS idx_alertes_resolue   ON alertes_actives(resolue);
CREATE INDEX IF NOT EXISTS idx_alertes_type      ON alertes_actives(type);

-- 3. Colonnes v1 sur deliveries (idempotentes via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='deliveries' AND column_name='statut_chargement') THEN
    ALTER TABLE deliveries ADD COLUMN statut_chargement VARCHAR(30)
      CHECK (statut_chargement IN ('VALIDE_AUTO','ECART_BLOQUE','DEBLOQUE_CTRL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='deliveries' AND column_name='ecart_poids') THEN
    ALTER TABLE deliveries ADD COLUMN ecart_poids NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='deliveries' AND column_name='statut_litige') THEN
    ALTER TABLE deliveries ADD COLUMN statut_litige VARCHAR(30)
      CHECK (statut_litige IN ('RETOUR_OK','LITIGE_RETOUR','LITIGE_RESOLU','PERTES_ACCEPTEES','ERREUR_SAISIE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='deliveries' AND column_name='ecart_caisses_retour') THEN
    ALTER TABLE deliveries ADD COLUMN ecart_caisses_retour INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='deliveries' AND column_name='updated_at') THEN
    ALTER TABLE deliveries ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 4. Index performances deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_statut_chargement ON deliveries(statut_chargement);
CREATE INDEX IF NOT EXISTS idx_deliveries_statut_litige     ON deliveries(statut_litige);
CREATE INDEX IF NOT EXISTS idx_deliveries_chauffeur_date    ON deliveries(chauffeur_id, date DESC);

-- 5. Colonnes v1 sur stock_volaille (si table déjà créée par migration v4)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='stock_volaille' AND column_name='temperature_c') THEN
    ALTER TABLE stock_volaille ADD COLUMN temperature_c NUMERIC(5,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='stock_volaille' AND column_name='lot') THEN
    ALTER TABLE stock_volaille ADD COLUMN lot VARCHAR(50);
  END IF;
END $$;

-- 6. Vue v_alertes_actives enrichie
CREATE OR REPLACE VIEW v_alertes_actives AS
  SELECT
    a.*,
    d.chauffeur_id,
    ch.nom   AS chauffeur_nom,
    ag.nom   AS resolu_par_nom
  FROM alertes_actives a
  LEFT JOIN deliveries  d  ON d.id  = a.livraison_id
  LEFT JOIN chauffeurs  ch ON ch.id = d.chauffeur_id
  LEFT JOIN agents      ag ON ag.id = a.resolu_par
  WHERE a.resolue = false
  ORDER BY a.created_at DESC;

-- 7. Vue v_bilan_caisses_mensuel (remplace l'ancien calcul finDeMois)
CREATE OR REPLACE VIEW v_bilan_caisses_mensuel AS
  SELECT
    EXTRACT(YEAR  FROM d.date)::INT AS annee,
    EXTRACT(MONTH FROM d.date)::INT AS mois,
    d.chauffeur_id,
    ch.nom                          AS chauffeur_nom,
    COUNT(d.id)                     AS nb_departs,
    SUM(d.nb_caisses_chargees)      AS total_chargees,
    SUM(d.nb_caisses_retournees)    AS total_retournees,
    SUM(d.nb_caisses_chargees) - SUM(d.nb_caisses_retournees) AS caisses_ecart,
    CASE WHEN SUM(d.nb_caisses_chargees) > 0
      THEN ROUND(SUM(d.nb_caisses_retournees)::NUMERIC
             / SUM(d.nb_caisses_chargees) * 100, 2)
      ELSE 0
    END AS taux_retour
  FROM deliveries d
  JOIN chauffeurs ch ON ch.id = d.chauffeur_id
  WHERE d.type = 'depart'
  GROUP BY annee, mois, d.chauffeur_id, ch.nom;

COMMENT ON TABLE audit_logs      IS 'Traces RBAC — chaque action sensible loguée';
COMMENT ON TABLE alertes_actives IS 'Alertes temps réel pesée/retour, résolues via validation manuelle';
COMMENT ON VIEW  v_alertes_actives        IS 'Alertes non résolues enrichies chauffeur/agent';
COMMENT ON VIEW  v_bilan_caisses_mensuel  IS 'Bilan mensuel caisses par chauffeur, base calcul fin de mois';
