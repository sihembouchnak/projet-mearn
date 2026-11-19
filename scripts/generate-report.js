import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'RAPPORT.pdf');
const pages = [
  {
    title: '1. Presentation du projet',
    paragraphs: [
      'BudgetTracker est une application web de gestion de finances personnelles realisee pour le mini-projet de l’Atelier de Bases de Donnees Avancees (DSI31 & DSI32, annee universitaire 2026-2027). Elle permet de saisir des depenses et revenus, de detailler des achats, de rechercher rapidement dans un historique volumineux et de consulter des statistiques.',
      'Le choix du sujet repond a un besoin concret tout en offrant des donnees variees a modeliser : transactions nombreuses, categories partagees, utilisateurs et budgets mensuels. La collection principale contient 10 500 enregistrements generes par un script reproductible. Les donnees de demonstration couvrent 2025 et 2026.',
      'La solution est divisee en deux applications : une API REST Node.js/Express avec MongoDB et Mongoose, et une interface React. Les echanges utilisent JSON. La devise de demonstration est le dinar tunisien (TND).'
    ],
    bullets: [
      'Saisir, modifier et supprimer une transaction.',
      'Consulter les lignes d’articles integrees au document.',
      'Filtrer par type et categorie, rechercher par texte et parcourir les resultats par pages.',
      'Analyser les depenses par categorie et l’evolution des revenus et depenses par mois.'
    ]
  },
  {
    title: '2. Modelisation et choix MongoDB',
    paragraphs: [
      'La base retenue s’appelle mearn. La collection principale s’appelle budget, conformement au parametrage du projet. Elle represente les transactions financieres et comprend titre, type, montant_total, date_transaction, mode_paiement, tags, user_id, categorie_id et details_articles.',
      'Relation 1-N imbriquee : details_articles est un tableau de sous-documents dans chaque transaction. Une ligne (nom, quantite, prix_unitaire) n’a pas d’existence independante ; elle est creee, lue et modifiee avec l’achat. L’imbrication permet une lecture coherente en une requete et conserve l’atomicite du document.',
      'Relations referencees : user_id pointe vers users et categorie_id vers categories. Plusieurs transactions utilisent le meme profil ou la meme categorie. Les references evitent de recopier leurs informations dans des milliers de documents et facilitent une modification centralisee. La consultation detaillee utilise populate et les statistiques utilisent $lookup.',
      'Les quatre collections sont budget (transactions), users, categories et budgets. Cette derniere contient user_id, categorie_id, mois, annee et montant_alloue ; un index compose unique evite les doublons d’allocation pour une meme periode. La date de transaction permet l’extraction de l’annee et du mois, les montants alimentent les calculs, et tags est un tableau de mots-cles.'
    ],
    bullets: [
      'Index textuel sur titre et tags pour la recherche MongoDB $text.',
      'Index sur date_transaction pour le tri chronologique.',
      'Index compose categorie_id/type/date_transaction pour les filtres courants.',
      'Donnees generees en lots de 500 ; le script ne supprime que ses propres documents marques.'
    ]
  },
  {
    title: '3. Backend et requetes',
    paragraphs: [
      'Le serveur Express expose neuf routes metier protegees : cinq routes CRUD sur transactions, une recherche textuelle, la liste des categories et deux routes de statistiques. Quatre routes d’authentification permettent inscription, connexion, deconnexion et consultation du profil. La liste accepte page, limit, type et category ; la limite de page est plafonnee.',
      'Les mots de passe sont haches avec bcrypt. Un JWT de huit heures est transmis dans un cookie HttpOnly, SameSite=Lax et Secure en production. Les routes metier exigent une session valide ; chaque liste, recherche, modification, suppression et pipeline est scope par le user_id authentifie. Un compte ne peut donc pas lire ni modifier les transactions d’un autre.',
      'La route de detail recupere les informations de la categorie et de l’utilisateur avec Mongoose populate. La recherche combine l’index texte et les filtres de la liste, et renvoie la meme enveloppe paginee. Les entrees sont validees, les identifiants invalides sont signales et les erreurs HTTP retournent un message explicite.',
      'L’agregation by-category filtre les depenses avec $match, regroupe par categorie avec $group, calcule le nombre d’operations, la somme et la moyenne, puis joint categories avec $lookup. L’agregation monthly extrait annee et mois avec $year et $month ; $facet produit simultanement les totaux globaux et les series mensuelles.',
      'Le seed cree un utilisateur de demonstration, sept categories, des budgets et 10 500 transactions plausibles avec tags, articles, moyens de paiement et dates aleatoires mais reproductibles. Chaque transaction dont les articles sont connus a un montant total calcule depuis les lignes.'
    ],
    bullets: [
      'GET /api/transactions et GET /api/transactions/:id',
      'POST, PUT et DELETE /api/transactions',
      'GET /api/transactions/search?q=... et GET /api/categories',
      'GET /api/stats/by-category et GET /api/stats/monthly'
    ]
  },
  {
    title: '4. Interface, execution et conclusion',
    paragraphs: [
      'L’interface React comprend une page de transactions, un formulaire de creation et de modification, une fenetre de detail et un tableau de bord. La liste affiche date, titre, categorie, type, montant, tags et actions. La recherche est retardee de quelques millisecondes pour eviter une requete a chaque frappe ; la pagination affiche vingt operations.',
      'Le formulaire charge les categories depuis l’API, convertit les tags separes par des virgules en tableau et permet d’ajouter ou de retirer des lignes d’articles. Le montant des lignes est calcule automatiquement. Le tableau de bord presente les revenus, depenses, solde net, les sommes par categorie et l’evolution mensuelle.',
      'L’inscription et la connexion ouvrent une session securisee. Les pages sont protegees et les transactions sont isolees par compte. Une erreur de session ou de reseau est signalee a l’utilisateur.',
      'Pour lancer le projet, installer les dependances avec npm install, configurer MONGODB_URI, MONGODB_DB et une cle JWT dans .env, executer npm run seed puis npm run dev. Pour explorer le jeu de demonstration, fournir un DEMO_PASSWORD lors du seed. L’interface est sur localhost:5173 et l’API sur localhost:5000.',
      'Le projet met en pratique les relations imbriquees et referencees, les tableaux, les index textuels, la pagination, les pipelines d’agregation et l’authentification associee a la propriete des donnees. Des evolutions possibles seraient la gestion des budgets depuis l’interface et des tests automatises.'
    ],
    bullets: [
      'Frontend : React, React Router, Axios et Recharts.',
      'Backend : Node.js, Express, Mongoose, bcrypt, JWT et cookies HTTP-only.',
      'Base de donnees : MongoDB, quatre collections et plus de 10 000 transactions.',
      'Livrables : code source, README d’installation et rapport PDF.'
    ]
  }
];

const doc = new PDFDocument({ size: 'A4', margin: 58, bufferPages: true, info: { Title: 'Rapport BudgetTracker MERN', Author: 'DSI31 & DSI32' } });
doc.pipe(fs.createWriteStream(output));

pages.forEach((page, index) => {
  if (index) doc.addPage();
  doc.rect(0, 0, doc.page.width, 12).fill('#2f6848');
  doc.moveDown(2);
  doc.fillColor('#2f6848').font('Helvetica-Bold').fontSize(index === 0 ? 13 : 10).text('ATELIER BASES DE DONNEES AVANCEES • DSI31 & DSI32', { characterSpacing: .5 });
  if (index === 0) {
    doc.moveDown(1.7);
    doc.fillColor('#202820').font('Helvetica-Bold').fontSize(29).text('BudgetTracker MERN');
    doc.moveDown(.4);
    doc.fillColor('#758477').font('Helvetica').fontSize(14).text('Application web de gestion de finances personnelles');
    doc.moveDown(.5);
    doc.fillColor('#8b958b').fontSize(11).text('Mini-projet MongoDB • Annee universitaire 2026-2027');
    doc.moveDown(1.2);
    doc.strokeColor('#e5ebe4').moveTo(58, doc.y).lineTo(doc.page.width - 58, doc.y).stroke();
    doc.moveDown(1.1);
  } else {
    doc.moveDown(1.5);
  }
  doc.fillColor('#202820').font('Helvetica-Bold').fontSize(18).text(page.title, { lineGap: 4 });
  doc.moveDown(.8);
  doc.fillColor('#485248').font('Helvetica').fontSize(10.5);
  for (const paragraph of page.paragraphs) {
    doc.text(paragraph, { align: 'justify', lineGap: 4 });
    doc.moveDown(.8);
  }
  doc.moveDown(.2);
  doc.fillColor('#2f6848').font('Helvetica-Bold').fontSize(10.5).text(index === 1 ? 'Points techniques' : index === 2 ? 'Routes principales' : 'Fonctionnalites et lancement');
  doc.moveDown(.4);
  doc.fillColor('#485248').font('Helvetica').fontSize(10);
  for (const bullet of page.bullets) {
    doc.text(`•  ${bullet}`, { indent: 12, hanging: 3, lineGap: 3 });
    doc.moveDown(.35);
  }
  doc.moveDown(1);
  doc.fillColor('#879187').fontSize(9).text('BudgetTracker • Projet academique MERN', { align: 'left' });
});

const range = doc.bufferedPageRange();
for (let index = 0; index < range.count; index += 1) {
  doc.switchToPage(index);
  doc.font('Helvetica').fontSize(9).fillColor('#929a92');
  doc.text(`${index + 1} / ${range.count}`, 58, doc.page.height - 70, {
    align: 'right',
    width: doc.page.width - 116,
    lineBreak: false
  });
}
doc.end();
console.log(`Rapport PDF genere : ${output}`);
