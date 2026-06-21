import pool from '../db';
import bcrypt from 'bcryptjs';

const NB_CAMIONS = 250;
const NB_JOURS = 30;
const LIVRAISONS_PAR_CAMION_PAR_JOUR_MIN = 1;
const LIVRAISONS_PAR_CAMION_PAR_JOUR_MAX = 3;
const POIDS_CAISSE = 0.7; // 700g
const TOLERANCE = 0.05; // 5%

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatMatricule(index: number): string {
  const num = String(index).padStart(4, '0');
  return `190 TN ${num}`;
}

function generateDate(day: number, hour: number, minute: number): Date {
  const date = new Date(2026, 5, day); // Juin 2026
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function stressTest() {
  console.log('🚀 Démarrage du stress test...');
  console.log(`📊 Configuration: ${NB_CAMIONS} camions, ${NB_JOURS} jours`);
  
  const startTime = Date.now();
  let totalLivraisons = 0;
  let totalCaissesChargees = 0;
  let totalCaissesRetournees = 0;

  try {
    // Nettoyer les données existantes
    console.log('🧹 Nettoyage des données existantes...');
    await pool.query('DELETE FROM deliveries');
    await pool.query('DELETE FROM caisses');
    await pool.query('DELETE FROM camions');
    await pool.query('DELETE FROM chauffeurs');
    console.log('✅ Données nettoyées');

    // Créer les chauffeurs et camions
    console.log(`🚚 Création de ${NB_CAMIONS} camions et chauffeurs...`);
    const chauffeurs: any[] = [];
    const camions: any[] = [];

    for (let i = 1; i <= NB_CAMIONS; i++) {
      const chauffeurResult = await pool.query(
        'INSERT INTO chauffeurs (nom, telephone, stock_caisses_actuel) VALUES ($1, $2, $3) RETURNING id',
        [`Chauffeur ${i}`, `216 20 ${String(i).padStart(8, '0')}`, 0]
      );
      chauffeurs.push(chauffeurResult.rows[0]);

      const camionResult = await pool.query(
        'INSERT INTO camions (matricule, chauffeur_id, capacite_max) VALUES ($1, $2, $3) RETURNING id',
        [formatMatricule(i), chauffeurs[i - 1].id, 100]
      );
      camions.push(camionResult.rows[0]);

      if (i % 50 === 0) {
        console.log(`   ${i}/${NB_CAMIONS} camions créés...`);
      }
    }
    console.log('✅ Camions et chauffeurs créés');

    // Créer les caisses initiales (10000 caisses à l'usine)
    console.log('📦 Création des caisses initiales...');
    const NB_CAISSES_INITIALES = 10000;
    for (let i = 1; i <= NB_CAISSES_INITIALES; i++) {
      await pool.query(
        'INSERT INTO caisses (numero_unique, statut) VALUES ($1, $2)',
        [`Caisse ${String(i).padStart(5, '0')}`, 'en_usine']
      );

      if (i % 1000 === 0) {
        console.log(`   ${i}/${NB_CAISSES_INITIALES} caisses créées...`);
      }
    }
    console.log('✅ Caisses initiales créées');

    // Simuler les livraisons sur un mois
    console.log(`📈 Simulation des livraisons sur ${NB_JOURS} jours...`);
    
    for (let jour = 1; jour <= NB_JOURS; jour++) {
      console.log(`\n📅 Jour ${jour}/${NB_JOURS}`);
      
      for (let camionIndex = 0; camionIndex < NB_CAMIONS; camionIndex++) {
        const camion = camions[camionIndex];
        const chauffeur = chauffeurs[camionIndex];
        
        const nbLivraisons = randomInt(LIVRAISONS_PAR_CAMION_PAR_JOUR_MIN, LIVRAISONS_PAR_CAMION_PAR_JOUR_MAX);
        
        for (let livraisonIndex = 0; livraisonIndex < nbLivraisons; livraisonIndex++) {
          const heure = randomInt(6, 18);
          const minute = randomInt(0, 59);
          const date = generateDate(jour, heure, minute);
          
          const poidsVide = randomFloat(2000, 3000);
          const nbCaisses = randomInt(50, 100);
          const poidsTheorique = nbCaisses * POIDS_CAISSE;
          const variation = randomFloat(-TOLERANCE, TOLERANCE);
          const poidsNet = poidsTheorique * (1 + variation);
          const poidsCharge = poidsVide + poidsNet;
          
          const nbCaissesRetournees = randomInt(Math.floor(nbCaisses * 0.9), nbCaisses);
          
          await pool.query(
            `INSERT INTO deliveries 
             (camion_id, chauffeur_id, poids_vide, poids_charge, nb_caisses_chargees, nb_caisses_retournees, statut, date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [camion.id, chauffeur.id, poidsVide, poidsCharge, nbCaisses, nbCaissesRetournees, 'termine', date]
          );
          
          totalLivraisons++;
          totalCaissesChargees += nbCaisses;
          totalCaissesRetournees += nbCaissesRetournees;
        }
      }
      
      console.log(`   Livraisons du jour: ${totalLivraisons} totales`);
    }

    console.log('\n✅ Stress test terminé avec succès!');
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Résultats du stress test:');
    console.log(`⏱️  Durée: ${duration.toFixed(2)} secondes`);
    console.log(`🚚 Camions: ${NB_CAMIONS}`);
    console.log(`📅 Jours: ${NB_JOURS}`);
    console.log(`📦 Total livraisons: ${totalLivraisons}`);
    console.log(`📊 Total caisses chargées: ${totalCaissesChargees}`);
    console.log(`📊 Total caisses retournées: ${totalCaissesRetournees}`);
    console.log(`📊 Taux de retour: ${((totalCaissesRetournees / totalCaissesChargees) * 100).toFixed(2)}%`);
    console.log(`⚡ Livraisons/seconde: ${(totalLivraisons / duration).toFixed(2)}`);
    
    // Vérifier les statistiques finales
    const stockResult = await pool.query('SELECT COUNT(*) as count FROM caisses WHERE statut = $1', ['en_usine']);
    const stockUsine = parseInt(stockResult.rows[0].count);
    
    console.log(`\n📦 Stock final à l'usine: ${stockUsine} caisses`);
    
  } catch (error) {
    console.error('❌ Erreur lors du stress test:', error);
    throw error;
  }
}

stressTest()
  .then(() => {
    console.log('\n✨ Stress test complété!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur:', error);
    process.exit(1);
  });
