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

interface Camion {
  id: number;
  matricule: string;
  chauffeurId: number;
}

interface Chauffeur {
  id: number;
  nom: string;
  telephone: string;
}

interface Delivery {
  id: number;
  camionId: number;
  chauffeurId: number;
  poidsVide: number;
  poidsCharge: number;
  nbCaissesChargees: number;
  nbCaissesRetournees: number;
  date: Date;
}

function stressTest() {
  console.log('🚀 Démarrage du stress test en mémoire...');
  console.log(`📊 Configuration: ${NB_CAMIONS} camions, ${NB_JOURS} jours`);
  
  const startTime = Date.now();
  let totalLivraisons = 0;
  let totalCaissesChargees = 0;
  let totalCaissesRetournees = 0;

  const chauffeurs: Chauffeur[] = [];
  const camions: Camion[] = [];
  const deliveries: Delivery[] = [];

  try {
    // Créer les chauffeurs et camions
    console.log(`🚚 Création de ${NB_CAMIONS} camions et chauffeurs...`);

    for (let i = 1; i <= NB_CAMIONS; i++) {
      chauffeurs.push({
        id: i,
        nom: `Chauffeur ${i}`,
        telephone: `216 20 ${String(i).padStart(8, '0')}`
      });

      camions.push({
        id: i,
        matricule: formatMatricule(i),
        chauffeurId: i
      });

      if (i % 50 === 0) {
        console.log(`   ${i}/${NB_CAMIONS} camions créés...`);
      }
    }
    console.log('✅ Camions et chauffeurs créés');

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
          
          deliveries.push({
            id: totalLivraisons + 1,
            camionId: camion.id,
            chauffeurId: chauffeur.id,
            poidsVide,
            poidsCharge,
            nbCaissesChargees: nbCaisses,
            nbCaissesRetournees,
            date
          });
          
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
    
    // Calculer les statistiques par chauffeur
    console.log('\n📊 Statistiques par chauffeur (top 10):');
    const statsParChauffeur = new Map<number, { totalLivraisons: number; totalCaisses: number; caissesRetournees: number }>();
    
    deliveries.forEach(delivery => {
      const stats = statsParChauffeur.get(delivery.chauffeurId) || { totalLivraisons: 0, totalCaisses: 0, caissesRetournees: 0 };
      stats.totalLivraisons++;
      stats.totalCaisses += delivery.nbCaissesChargees;
      stats.caissesRetournees += delivery.nbCaissesRetournees;
      statsParChauffeur.set(delivery.chauffeurId, stats);
    });
    
    const sortedStats = Array.from(statsParChauffeur.entries())
      .sort((a, b) => b[1].totalLivraisons - a[1].totalLivraisons)
      .slice(0, 10);
    
    sortedStats.forEach(([chauffeurId, stats]) => {
      const chauffeur = chauffeurs.find(c => c.id === chauffeurId);
      console.log(`   ${chauffeur?.nom}: ${stats.totalLivraisons} livraisons, ${stats.totalCaisses} caisses, ${((stats.caissesRetournees / stats.totalCaisses) * 100).toFixed(1)}% retour`);
    });
    
    // Calculer les statistiques journalières
    console.log('\n📊 Statistiques journalières:');
    const statsParJour = new Map<number, { livraisons: number; caisses: number }>();
    
    deliveries.forEach(delivery => {
      const jour = delivery.date.getDate();
      const stats = statsParJour.get(jour) || { livraisons: 0, caisses: 0 };
      stats.livraisons++;
      stats.caisses += delivery.nbCaissesChargees;
      statsParJour.set(jour, stats);
    });
    
    for (let jour = 1; jour <= NB_JOURS; jour++) {
      const stats = statsParJour.get(jour) || { livraisons: 0, caisses: 0 };
      console.log(`   Jour ${jour}: ${stats.livraisons} livraisons, ${stats.caisses} caisses`);
    }
    
    // Sauvegarder les résultats dans un fichier JSON
    const fs = require('fs');
    const path = require('path');
    
    const results = {
      metadata: {
        nbCamions: NB_CAMIONS,
        nbJours: NB_JOURS,
        duration: duration,
        totalLivraisons,
        totalCaissesChargees,
        totalCaissesRetournees,
        tauxRetour: ((totalCaissesRetournees / totalCaissesChargees) * 100).toFixed(2),
        livraisonsParSeconde: (totalLivraisons / duration).toFixed(2)
      },
      chauffeurs: chauffeurs,
      camions: camions,
      deliveries: deliveries.slice(0, 1000), // Limiter à 1000 livraisons pour le fichier JSON
      statsParChauffeur: Array.from(statsParChauffeur.entries()).map(([id, stats]) => ({
        chauffeurId: id,
        chauffeurNom: chauffeurs.find(c => c.id === id)?.nom,
        ...stats
      })),
      statsParJour: Array.from(statsParJour.entries()).map(([jour, stats]) => ({
        jour,
        ...stats
      }))
    };
    
    const outputPath = path.join(__dirname, '../../stress_test_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Résultats sauvegardés dans: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Erreur lors du stress test:', error);
    throw error;
  }
}

stressTest();
