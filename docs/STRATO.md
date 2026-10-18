# Mise en ligne chez STRATO

## Adresse

Les sous-domaines et les redirections internes vers leurs dossiers dédiés sont créés. L’adresse de production est :

**`https://hugoli-mariage.frammery.com/`**

Le site de test est `https://hugoli-mariage-test.frammery.com/`. Voir [le guide du pipeline](DEPLOYMENT.md) pour les déploiements automatiques en test et la promotion manuelle en production. Les étapes ci-dessous restent utiles pour comprendre la configuration STRATO ou faire un transfert manuel.

## Préparer les fichiers

```sh
npm run check
npm test
npm run build
```

Le contenu de `dist/` est autonome. Node.js n’est pas nécessaire sur le serveur. Les scripts JavaScript utilisent l’extension `.mjs` : vérifier qu’elle est servie avec un type MIME JavaScript, par exemple `text/javascript`. Le fichier `.htaccess` fourni applique ce réglage sur Apache lorsque `mod_mime` est disponible. Il doit être transféré avec les autres fichiers ; activer l’affichage des fichiers cachés dans le client SFTP si nécessaire. Son contenu est :

```apache
AddType text/javascript .mjs
```

## Configuration dans l’espace client

Les intitulés peuvent varier selon le contrat. Se référer aux guides STRATO ci-dessous.

1. Créer un répertoire dédié, par exemple `/hugoli-mariage/`, dans l’espace web. Garder les fichiers de l’éventuel site principal de `frammery.com` dans leur répertoire actuel.
2. Dans la gestion des domaines, créer le sous-domaine `hugoli-mariage` de `frammery.com`.
3. Configurer sa **redirection interne** vers `/hugoli-mariage/`. La cible est un répertoire, pas `index.html`, et conserve le sous-domaine dans la barre d’adresse.
4. Configurer un certificat SSL couvrant le nom d’hôte exact et activer la redirection vers HTTPS. Le certificat disponible et ses éventuels coûts dépendent du contrat ; vérifier dans l’espace client.
5. Utiliser un accès SFTP limité à ce répertoire, avec l’hôte et l’utilisateur indiqués par STRATO. Télécharger **le contenu** de `dist/`, pas le dossier `dist` lui-même, via SFTP (port 22). `index.html` doit être directement à la racine du répertoire associé au sous-domaine.

Les identifiants ne doivent pas être ajoutés au dépôt. Il n’est pas nécessaire de modifier les enregistrements du domaine principal ni la messagerie pour ce déploiement sur l’espace web existant.

## Vérification après transfert

- L’adresse HTTPS choisie charge la page et le navigateur accepte le certificat.
- L’accès HTTP redirige vers HTTPS.
- Les illustrations, styles et le compte à rebours se chargent sans erreur.
- La page s’adapte à un téléphone sans défilement horizontal.
- Les liens d’itinéraire et du château pointent vers la bonne destination.
- Le fichier calendrier importe le **10 juin 2028 uniquement**, en événement sur une journée entière, avec le bon lieu.
- Le site principal de `frammery.com` continue de fonctionner.

Pour les mises à jour habituelles, utiliser le [pipeline GitHub Actions → SFTP](DEPLOYMENT.md). Éviter de mélanger un transfert manuel et un déploiement du pipeline au même moment. Le pipeline construit des chemins de ressources propres à chaque version et conserve les précédents.

## Documentation officielle consultée

- [STRATO — redirection interne d’un sous-domaine vers un répertoire](https://www.strato.fr/faq/nom-domaine/mettre-en-place-une-redirection-de-domaine/)
- [STRATO — accès SFTP et SSH](https://www.strato.fr/faq/hebergement/comment-utiliser-votre-acces-sftpssh/)
- [STRATO — certificats SSL](https://www.strato.fr/faq/nom-domaine/comment-utiliser-strato-ssl/)
- [Lieu et adresse — Château des Comtes de Challes](https://www.chateaudescomtesdechalles.com/fr/)
