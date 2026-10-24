# HugOli — Olivia & Hugo

Site de mariage en français pour **Olivia Delage et Hugo Frammery**, le **samedi 10 juin 2028**, au Château des Comtes de Challes.

## Première version

- Accueil avec la photo d’Olivia et Hugo en fond, palette ivoire et vert profond.
- Compte à rebours vers le début du 10 juin 2028 en France, à minuit (UTC+02:00). Aucune heure de cérémonie n’est annoncée.
- Adresse du lieu, itinéraire Google Maps et lien vers le site officiel.
- Ajout au calendrier : événement sur la journée entière.
- Bouton RSVP ouvrant un quiz humoristique de quatre questions : bouton fuyant, seconde chance et confettis. Ce jeu ne collecte aucune donnée et ne confirme aucune présence.
- Mise en page mobile et ordinateur, navigation au clavier, mouvements réduits.

Le site est statique : **HTML, CSS et JavaScript natifs, sans dépendance**. Il ne nécessite ni base de données ni serveur Node.js sur le Raspberry Pi. L’illustration SVG est originale et évocatrice ; ce n’est pas une représentation fidèle du château. Aucun service externe, police distante, outil statistique ou carte intégrée n’est chargé à l’ouverture de la page. Les liens externes s’ouvrent uniquement à la demande du visiteur.

## Travailler en local

Installer Node.js 22 ou une version plus récente, puis :

```sh
npm run dev
```

Ouvrir `http://127.0.0.1:4173`. Recharger la page après modification. Aucun `npm install` n’est nécessaire. Sous PowerShell, utiliser `npm.cmd` si l’exécution de `npm.ps1` est bloquée.

```sh
npm run check
npm test
npm run build
```

Le dossier `dist/` contient uniquement les fichiers à envoyer chez l’hébergeur. `public/` peut aussi être servi directement sans compilation. Les commandes Node.js servent seulement au développement et à la préparation des fichiers.

## Modifier le site

| Contenu | Fichier |
| --- | --- |
| Textes, liens, informations du lieu | `public/index.html` |
| Couleurs, typographies, mise en page | `public/assets/style.css` |
| Date et états du compte à rebours | `public/assets/countdown.mjs` |
| Affichage du compte à rebours | `public/assets/app.mjs` |
| Questions et règles du quiz RSVP | `public/assets/rsvp-game.mjs` |
| Fenêtre et interactions du quiz RSVP | `public/assets/rsvp.mjs` |
| Photo de fond | `public/assets/hugo-olivia.jpg` |
| Illustration et icône | `public/assets/chateau.svg`, `public/assets/favicon.svg` |
| Événement de calendrier | `public/hugoli-10-juin-2028.ics` |

Si la date change, mettre à jour le HTML (texte et métadonnées), le compte à rebours et le calendrier. Le compte à rebours utilise explicitement le décalage horaire français de juin 2028, même pour un visiteur à l’étranger. Il dépend de l’horloge de l’appareil. Après le début du mariage, il affiche un message pour la journée, puis un message de souvenir.

## Hébergement et suite du projet

Voir [le pipeline test → production](docs/DEPLOYMENT.md), [le guide STRATO](docs/STRATO.md) et [le plan du projet](docs/PLAN.md).

Le test est hébergé sur le Raspberry Pi existant, sans mise à niveau de l’OS. Chaque modification de `main` prépare une version que le Pi récupère automatiquement depuis GitHub. L’aperçu local est http://192.168.1.183:2585/. Le site public de test est disponible sur https://hugoli-mariage-test.frammery.com/ avec Let’s Encrypt et renouvellement automatique. La production est disponible sur https://hugoli-mariage.frammery.com/. Sa publication est manuelle et reprend les fichiers exacts d’une exécution de test réussie et validée. Voir aussi [l’installation Raspberry Pi](docs/RASPBERRY.md).

Le code comprend une directive `noindex, nofollow` pour demander aux moteurs de recherche de ne pas indexer le site. Cette directive ne limite pas l’accès. Le dépôt GitHub étant public, son contenu est également public. Si une restriction d’accès est souhaitée plus tard, la définir au niveau de l’hébergement avant d’ajouter des données d’invités.
