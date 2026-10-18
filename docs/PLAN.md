# Plan du site HugOli

## Informations confirmées

- Mariés : Hugo Frammery et Olivia Delage ; surnom : HugOli.
- Date : samedi 10 juin 2028.
- Lieu : Château des Comtes de Challes, à Challes-les-Eaux, Savoie.
- Langue : français.
- Code : dépôt `HugoFram/hugoliwedding`.
- Hébergement souhaité : espace web STRATO existant, domaine `frammery.com`.
- Priorité : une première page simple avec compte à rebours et informations du lieu.

## Étape 1 — Save the date (réalisée en local)

Une page responsive, un compte à rebours, l’adresse du château, un lien d’itinéraire et un téléchargement calendrier. Pas d’horaire inventé, de réservation d’hébergement annoncée ou de formulaire de démonstration.

### Direction visuelle proposée

**Faire-part botanique** : papier ivoire, vert sauge, touches terre cuite, grands caractères classiques et illustration de château dans un paysage de montagne. C’est la proposition implémentée, à discuter.

Autres directions possibles :

1. **Romantique et chaleureux** : crème, vieux rose et bordeaux, avec une photographie du couple.
2. **Contemporain et festif** : typographie plus graphique, bleu profond et couleurs franches.

Une photographie personnelle ou une photographie du lieu dont l’utilisation est autorisée pourra remplacer l’illustration.

## Étape 2 — Préparer la venue des invités (à discuter)

À ajouter quand les informations seront arrêtées, dans cet ordre conseillé :

1. **Programme** : cérémonie, cocktail, dîner, soirée, éventuellement brunch. Afficher seulement les horaires confirmés.
2. **Accès et hébergements** : transports, stationnement, hôtels et éventuelles navettes ; distinguer recommandations et chambres effectivement réservées.
3. **Questions pratiques** : tenue, présence des enfants, accessibilité et personne à contacter.

Ces sections peuvent rester statiques et fonctionner avec l’hébergement prévu.

## Étape 3 — Réponses des invités (optionnelle)

Décider d’abord si les réponses doivent arriver par téléphone, par un formulaire externe ou par un formulaire intégré. Un formulaire intégré demandera un traitement serveur ou un service de formulaires, ainsi qu’un espace de consultation réservé aux organisateurs.

Champs à envisager : nom/foyer, présence, nombre d’invités autorisés, repas, besoins alimentaires et éventuelle présence au brunch. Définir la date limite et la manière de modifier une réponse. Éviter les comptes invités si un lien personnel suffit. Ne pas placer de réponses, coordonnées privées ou clés d’accès dans ce dépôt public.

## Étape 4 — Après le mariage (optionnelle)

Remerciements et lien vers un album photo partagé. Définir l’accès à l’album avant publication.

## Déploiement test → production

Les sous-domaines `hugoli-mariage.frammery.com` et `hugoli-mariage-test.frammery.com` sont créés et redirigent vers les dossiers portant les mêmes noms.

Le pipeline GitHub Actions est préparé : déploiement automatique de `main` sur le site de test, puis promotion manuelle d’une archive testée vers la production. Voir [la configuration et la procédure](DEPLOYMENT.md). Le premier transfert réel reste à vérifier après configuration du secret SFTP et des certificats HTTPS ; les paramètres publics de connexion sont déjà renseignés.
