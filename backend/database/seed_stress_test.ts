/**
 * ═══════════════════════════════════════════════════════════════════
 * SEED / STRESS-TEST — 1 mois de travail simulé
 * ═══════════════════════════════════════════════════════════════════
 *
 * Simule :
 *   • 30 jours × 3 camions × 2 postes = ~180 départs/retours
 *   • Saisies stock volaille (congelé + surgelé) chaque matin
 *   • Calculs poids net avec écarts aléatoires → alertes automatiques
 *   • Retours caisses avec pertes aléatoires → litiges
 *   • Clôtures de litiges (manuelle simulée)
 *   • Calcul fin de mois → primes/sanctions
 *
 * Usage :
 *   npx ts-node database/seed_stress_test.ts [--dry-run] [--mois=2026-06] [--clean]
 *
 * Options :
 *   --dry-run  : affiche le plan sans écrire en DB
 *   --mois     : mois cible au format YYYY-MM (défaut: mois courant)
 *   --clean    : supprime les données du mois avant insertion
 *   --verbose  : affiche chaque opération
 */

import pool from '../src/db';

// ─── Configuration ────────────────────────────────────────────
const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const VERBOSE   = args.includes('--verbose');
const CLEAN     = args.includes('--clean');
const moisArg   = args.find(a => a.startsWith('--mois='))?.split('=')[1];
const TARGET    = moisArg ? new Date(`${moisArg}-01`) : new Date();
const YEAR      = TARGET.getFullYear();
const MONTH     = TARGET.getMonth() + 1;
const NB_JOURS  = new Date(YEAR, MONTH, 0).getDate();

const CHAUFFEURS_IDS = [1, 2, 3];
const CAMIONS_IDS    = [1, 2, 3];
const AGENTS_IDS     = [1, 2, 8]; // agents + logistique
const SECTEUR_ID     = 1;

let stats = { livraisons: 0, stocks: 0, alertes: 0, litiges: 0, closures: 0, errors: 0 };

// ─── Helpers ──────────────────────────────────────────────────
const rand   = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt= (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick   = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const sleep  = (ms: number)  => new Promise(r => setTimeout(r, ms));

async function exec(sql: string, params: any[], label: string): Promise<any[]> {
  if (DRY_RUN) {
    if (VERBOSE) console.log(`[DRY] ${label}`);
    return [{ id: Math.floor(Math.random() * 99999) }];
  }
  try {
    const r = await pool.query(sql, params);
    if (VERBOSE) console.log(`  ✓  ${label}`);
    return r.rows;
  } catch (err: any) {
    console.error(`  ✗  ${label} — ${err.message}`);
    stats.errors++;
    return [];
  }
}

// ─── 1. Nettoyage optionnel ───────────────────────────────────
async function cleanMonth() {
  console.log(`\n🗑  Nettoyage données ${YEAR}-${String(MONTH).padStart(2, '0')}…`);
  await exec(
    `DELETE FROM alertes_actives WHERE created_at >= $1 AND created_at < $2`,
    [`${YEAR}-${String(MONTH).padStart(2, '0')}-01`,
     `${YEAR}-${String(MONTH + 1).padStart(2, '0')}-01`],
    'clean alertes_actives'
  );
  await exec(
    `DELETE FROM deliveries WHERE DATE_TRUNC('month', date) = $1::DATE`,
    [`${YEAR}-${String(MONTH).padStart(2, '0')}-01`],
    'clean deliveries'
  );
  await exec(
    `DELETE FROM stock_volaille WHERE DATE_TRUNC('month', date_production) = $1::DATE`,
    [`${YEAR}-${String(MONTH).padStart(2, '0')}-01`],
    'clean stock_volaille'
  );
}

// ─── 2. Saisies stock volaille (chaque matin) ─────────────────
async function seedStockJour(jour: number) {
  const date = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  const types: Array<{ type: string; designation: string; temp: number }> = [
    { type: 'CONGELE',  designation: 'Poulet entier 1,2 kg', temp: -18 },
    { type: 'CONGELE',  designation: 'Escalopes de poulet',  temp: -18 },
    { type: 'SURGELE',  designation: 'Cuisses surgelées',    temp: -24 },
    { type: 'SURGELE',  designation: 'Filet de dinde',       temp: -24 },
  ];
  for (const t of types) {
    const kg      = parseFloat(rand(200, 800).toFixed(1));
    const caisses = randInt(10, 50);
    const lot     = `LOT-${YEAR}-${MONTH}-${String(jour).padStart(2, '0')}-${t.type[0]}`;
    await exec(
      `INSERT INTO stock_volaille
         (type_produit, designation, quantite_kg, nb_caisses, temperature_c, lot, saisie_par, date_production)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::DATE)`,
      [t.type, t.designation, kg, caisses, t.temp, lot, pick(AGENTS_IDS), date],
      `stock ${t.type} j${jour}`
    );
    stats.stocks++;
  }
}

// ─── 3. Départ camion + pesée ─────────────────────────────────
async function seedDepart(jour: number, idx: number): Promise<number | null> {
  const date      = new Date(YEAR, MONTH - 1, jour, 6 + idx * 3, 0, 0);
  const chId      = CHAUFFEURS_IDS[idx % CHAUFFEURS_IDS.length];
  const camId     = CAMIONS_IDS[idx % CAMIONS_IDS.length];
  const poidVide  = parseFloat(rand(2400, 2800).toFixed(1));
  const nb_charg  = randInt(80, 120);
  const pCaisses  = nb_charg * 2.1;

  // Introduire un écart aléatoire (~20 % des cas)
  const ecartKg   = Math.random() < 0.20 ? rand(-30, -80) : rand(-5, 5);
  const poidCible = parseFloat(rand(700, 1200).toFixed(1));
  const poidCharg = parseFloat((poidVide + pCaisses + poidCible + ecartKg).toFixed(1));
  const poidsNet  = Math.max(0, poidCharg - (poidVide + pCaisses));

  const ecartAbs = Math.abs(poidsNet - poidCible);
  const ecartPct = poidCible > 0 ? (ecartAbs / poidCible) * 100 : 0;
  const bloque   = ecartPct > 2;
  const statut_chargement = bloque ? 'ECART_BLOQUE' : 'VALIDE_AUTO';

  const rows = await exec(
    `INSERT INTO deliveries
       (camion_id, chauffeur_id, poids_vide, poids_charge, poids_net, poids_caisses,
        nb_caisses_chargees, nb_caisses_retournees, signature,
        date, statut, type, secteur_id, agent_id, poste_id,
        statut_chargement, ecart_poids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'TERMINE','depart',$11,$12,$13,$14,$15)
     RETURNING id`,
    [camId, chId, poidVide, poidCharg, poidsNet, pCaisses,
     nb_charg, 0, null,
     date.toISOString(), SECTEUR_ID, pick(AGENTS_IDS), 1,
     statut_chargement, parseFloat(ecartAbs.toFixed(2))],
    `livraison départ j${jour} idx${idx}`
  );
  stats.livraisons++;

  const livId = rows[0]?.id ?? null;

  if (bloque && livId) {
    await exec(
      `INSERT INTO alertes_actives (type, niveau, livraison_id, message, resolue)
       VALUES ($1,$2,$3,$4,false)`,
      ['ECART_POIDS_CHARGEMENT',
       ecartPct > 5 ? 'CRITIQUE' : 'ALERTE',
       livId,
       `Écart poids ${ecartPct.toFixed(1)}% (${ecartAbs.toFixed(1)} kg) — camion #${camId}`],
      `alerte pesée livraison ${livId}`
    );
    stats.alertes++;

    // ~70 % résolues dans la journée
    if (Math.random() < 0.70) {
      await exec(
        `UPDATE alertes_actives SET resolue=true, resolu_motif=$1, resolu_at=$2 WHERE livraison_id=$3 AND type=$4`,
        ['Validé contrôleur sur site', new Date(date.getTime() + 1800000).toISOString(),
         livId, 'ECART_POIDS_CHARGEMENT'],
        `résolution alerte pesée ${livId}`
      );
      await exec(
        `UPDATE deliveries SET statut_chargement='DEBLOQUE_CTRL' WHERE id=$1`,
        [livId], `déblocage chargement ${livId}`
      );
    }
  }

  return livId;
}

// ─── 4. Retour camion + contrôle caisses ─────────────────────
async function seedRetour(livId: number, nb_charg: number) {
  // Pertes aléatoires : 0-3 normal, >3 litige
  const pertes      = Math.random() < 0.15 ? randInt(4, 12) : randInt(0, 3);
  const nb_retour   = Math.max(0, nb_charg - pertes);
  const ecartAbs    = nb_charg - nb_retour;
  const ecartPct    = nb_charg > 0 ? (ecartAbs / nb_charg) * 100 : 0;
  const litige      = ecartAbs > 3 || ecartPct > 5;
  const statut      = litige ? 'LITIGE_RETOUR' : 'RETOUR_OK';

  await exec(
    `UPDATE deliveries
     SET nb_caisses_retournees=$1, ecart_caisses_retour=$2, statut_litige=$3, updated_at=NOW()
     WHERE id=$4`,
    [nb_retour, ecartAbs, statut, livId],
    `retour livraison ${livId}`
  );

  if (litige) {
    await exec(
      `INSERT INTO alertes_actives (type, niveau, livraison_id, message, resolue)
       VALUES ($1,$2,$3,$4,false)`,
      ['ECART_CAISSES_RETOUR',
       ecartAbs > 10 ? 'CRITIQUE' : 'ALERTE',
       livId,
       `Retour : ${ecartAbs} caisses manquantes (${ecartPct.toFixed(1)}%)`],
      `alerte caisses livraison ${livId}`
    );
    stats.litiges++;

    // ~80 % litiges clôturés
    if (Math.random() < 0.80) {
      const resolution = pick(['PERTES_ACCEPTEES', 'LITIGE_RESOLU', 'ERREUR_SAISIE']);
      await exec(
        `UPDATE deliveries SET statut_litige=$1 WHERE id=$2`,
        [resolution, livId], `clôture litige ${livId}`
      );
      await exec(
        `UPDATE alertes_actives SET resolue=true, resolu_motif=$1, resolu_at=NOW()
         WHERE livraison_id=$2 AND type='ECART_CAISSES_RETOUR' AND resolue=false`,
        [`${resolution} — clôture contrôleur`, livId],
        `résolution alerte caisses ${livId}`
      );
      stats.closures++;
    }
  }
}

// ─── 5. Rapport fin de mois (lecture seule) ───────────────────
async function afficherBilanMensuel() {
  if (DRY_RUN) return;
  console.log('\n📊 Bilan fin de mois calculé :');
  try {
    const r = await pool.query(`
      SELECT
        ch.nom,
        COUNT(d.id)                    nb_departs,
        SUM(d.nb_caisses_chargees)     chargees,
        SUM(d.nb_caisses_retournees)   retournees,
        SUM(d.nb_caisses_chargees) - SUM(d.nb_caisses_retournees) ecart,
        ROUND(SUM(d.nb_caisses_retournees)::NUMERIC
          / NULLIF(SUM(d.nb_caisses_chargees),0)*100,2) taux_pct
      FROM deliveries d
      JOIN chauffeurs ch ON ch.id = d.chauffeur_id
      WHERE EXTRACT(YEAR  FROM d.date) = $1
        AND EXTRACT(MONTH FROM d.date) = $2
        AND d.type = 'depart'
      GROUP BY ch.nom ORDER BY ch.nom
    `, [YEAR, MONTH]);
    console.table(r.rows);
  } catch (err: any) {
    console.error('Bilan non disponible (DB hors-ligne):', err.message);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
  const label = `${YEAR}-${String(MONTH).padStart(2, '0')}`;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  SEED STRESS-TEST — ${label}  (${NB_JOURS} jours)`);
  if (DRY_RUN) console.log('  MODE : DRY-RUN (aucune écriture DB)');
  console.log(`${'═'.repeat(60)}\n`);

  if (CLEAN) await cleanMonth();

  for (let jour = 1; jour <= NB_JOURS; jour++) {
    // Stock matin
    await seedStockJour(jour);

    // 3 départs par jour (un par camion/chauffeur)
    for (let idx = 0; idx < CHAUFFEURS_IDS.length; idx++) {
      const livId = await seedDepart(jour, idx);
      if (livId) {
        const nb_charg = randInt(80, 120);
        await sleep(10); // légère pause anti-overload
        await seedRetour(livId, nb_charg);
      }
    }

    if (jour % 5 === 0 || jour === NB_JOURS) {
      process.stdout.write(`  Progression : ${jour}/${NB_JOURS} jours traités\r`);
    }
  }

  console.log('\n');
  await afficherBilanMensuel();

  console.log('\n📈 Résumé opérations :');
  console.table({
    'Livraisons créées':  stats.livraisons,
    'Saisies stock':      stats.stocks,
    'Alertes pesée':      stats.alertes,
    'Litiges caisses':    stats.litiges,
    'Litiges clôturés':   stats.closures,
    'Erreurs DB':         stats.errors,
  });

  if (!DRY_RUN) await pool.end();
  console.log('\n✅ Seed terminé.\n');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
