# Mise en ligne chez STRATO

## Adresse

La demande mentionnait `https://www.hugoli-mariage.frammery`. Avec le domaine existant `frammery.com`, l’adresse proposée est :

**`https://hugoli-mariage.frammery.com/`**

Si la variante `https://www.hugoli-mariage.frammery.com/` est souhaitée, elle doit aussi être déclarée et couverte par le certificat HTTPS ; ne pas supposer qu’un certificat couvrant un seul niveau de sous-domaines couvre cette variante imbriquée. Confirmer l’adresse avant configuration.

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

Pour une mise à jour, exécuter de nouveau la préparation et transférer les fichiers de `dist/`. Si le navigateur conserve d’anciens fichiers, effectuer un rechargement complet. Une automatisation GitHub → SFTP pourra être envisagée ultérieurement ; elle n’est pas configurée dans cette première version.

## Documentation officielle consultée

- [STRATO — redirection interne d’un sous-domaine vers un répertoire](https://www.strato.fr/faq/nom-domaine/mettre-en-place-une-redirection-de-domaine/)
- [STRATO — accès SFTP et SSH](https://www.strato.fr/faq/hebergement/comment-utiliser-votre-acces-sftpssh/)
- [STRATO — certificats SSL](https://www.strato.fr/faq/nom-domaine/comment-utiliser-strato-ssl/)
- [Lieu et adresse — Château des Comtes de Challes](https://www.chateaudescomtesdechalles.com/fr/)
