# Déploiement : test, puis production

## Fonctionnement quotidien

1. Une modification de `main` lance **Déployer en test** : vérifications, tests, préparation d’une version et transfert SFTP vers `/hugoli-mariage-test`.
2. Le pipeline vérifie les fichiers réellement servis en HTTPS, puis conserve une archive immuable pendant 90 jours. Le résumé du workflow indique le numéro d’exécution à retenir.
3. Valider visuellement [le site de test](https://hugoli-mariage-test.frammery.com/).
4. Dans GitHub → **Actions → Publier en production → Run workflow**, garder la branche `main`, renseigner ce numéro dans `test_run_id`, puis lancer le workflow.
5. La production récupère **l’archive exacte de cette exécution**, vérifie son origine et ses empreintes, puis la transfère vers `/hugoli-mariage`. Elle ne reconstruit pas le dernier état de `main`.

Une simple modification de `main` ne publie jamais en production. Les pull requests lancent uniquement les vérifications, sans identifiants SFTP. Les environnements GitHub `test` et `production` sont référencés par les workflows et apparaissent dans le suivi des déploiements. Aucune règle d’approbation payante ou supplémentaire n’est nécessaire : la publication en production est déjà manuelle.

## Configuration initiale GitHub

Dans le dépôt [HugoFram/hugoliwedding](https://github.com/HugoFram/hugoliwedding), ouvrir **Settings → Secrets and variables → Actions**.

### Onglet Secrets : un repository secret

| Nom | Valeur |
| --- | --- |
| `STRATO_SFTP_PASSWORD` | Mot de passe du compte SFTP, à saisir directement dans GitHub |

Le serveur, l’utilisateur et le port sont déjà renseignés dans `.github/strato.json`. La clé publique SSH récupérée auprès de ce serveur est épinglée dans `.github/strato_known_hosts`. **Seul le secret du mot de passe est donc nécessaire pour la connexion.**

### Onglet Variables : remplacements optionnels

| Nom | Valeur |
| --- | --- |
| `STRATO_SFTP_HOST` | `51955246.ssh.w1.strato.hosting` |
| `STRATO_SFTP_USER` | Par défaut `stu78284945`, l’identifiant SFTP affiché dans STRATO, pas le libellé en italique |
| `STRATO_SSH_KNOWN_HOSTS` | Pour remplacer la clé publique SSH déjà renseignée, une ou plusieurs lignes OpenSSH `known_hosts`, comme ci-dessous |

Le port est 22. La racine du compte SFTP doit donner accès aux dossiers `/hugoli-mariage-test` et `/hugoli-mariage` déjà créés. Les scripts refusent toute autre destination, y compris `/`.

Le secret et les variables optionnelles peuvent aussi être définis séparément dans les environnements GitHub `test` et `production` si des comptes SFTP distincts sont utilisés plus tard. Les valeurs de l’environnement prennent alors le pas sur celles du dépôt.

### Clé publique du serveur

Le pipeline exige une clé d’hôte connue et ne désactive pas la vérification SSH. Il s’agit de la clé **publique du serveur**, pas d’une clé privée ou du mot de passe.

Pour vérifier ou actualiser la clé, depuis PowerShell, récupérer la clé et afficher son empreinte. Le client OpenSSH livré avec Git for Windows est utilisé ici, le `ssh-keyscan` Windows présent sur cette machine étant incompatible avec la négociation de ce serveur :

```powershell
$hugoliHostKeys = Join-Path $env:TEMP 'hugoli-known-hosts'
& 'C:\Program Files\Git\usr\bin\ssh-keyscan.exe' -T 10 -t ed25519 -p 22 51955246.ssh.w1.strato.hosting | Set-Content -LiteralPath $hugoliHostKeys -Encoding ascii
ssh-keygen -lf $hugoliHostKeys
Get-Content -LiteralPath $hugoliHostKeys
```

L’épinglage initial repose sur la clé présentée par ce nom de serveur. Si une empreinte a déjà été validée dans un client SFTP ou confirmée par STRATO, la comparer avec celle du fichier fourni. Une ligne `known_hosts` ressemble à `51955246.ssh.w1.strato.hosting ssh-ed25519 AAAA…` ; il ne faut pas la remplacer par la seule empreinte `SHA256:…`. En cas de changement de clé confirmé par STRATO, actualiser le fichier ou la variable optionnelle.

## Configuration initiale STRATO

Les sous-domaines et redirections internes sont déjà créés :

| Environnement | URL | Dossier vu depuis le compte SFTP |
| --- | --- | --- |
| Test | `https://hugoli-mariage-test.frammery.com/` | `/hugoli-mariage-test` |
| Production | `https://hugoli-mariage.frammery.com/` | `/hugoli-mariage` |

Activer un certificat HTTPS valide pour chacun des deux noms et la redirection HTTP → HTTPS. Les vérifications du pipeline échouent si HTTPS ne fonctionne pas ou si l’adresse redirige ailleurs. Au moment de la préparation du pipeline, les deux adresses présentaient un échec de négociation TLS : leur fonctionnement devra être vérifié après activation des certificats.

## Premier déploiement

1. Enregistrer le secret `STRATO_SFTP_PASSWORD` et vérifier les certificats. Les paramètres publics de connexion sont déjà renseignés.
2. Ouvrir [Actions → Déployer en test](https://github.com/HugoFram/hugoliwedding/actions/workflows/deploy-test.yml).
3. Choisir **Run workflow**, branche `main`. Cela permet de relancer sans modifier le code une fois la configuration prête.
4. Attendre le succès de toutes les étapes. Le résumé fournit le numéro d’exécution de test, aussi présent dans son URL `…/actions/runs/123456789`.
5. Valider la page de test, puis ouvrir [Publier en production](https://github.com/HugoFram/hugoliwedding/actions/workflows/deploy-production.yml) et saisir ce numéro.

Si la configuration manque lors du premier push, le workflow s’arrête avant la connexion SFTP avec le nom du paramètre manquant. Ajouter la configuration puis lancer une nouvelle exécution.

## Organisation des versions et reprise

Chaque tentative déploie ses ressources dans `releases/<commit>-<exécution>-<tentative>/`. Le HTML référence ces chemins propres à la version. Le fichier `.htaccess` est inclus pour servir les modules JavaScript correctement. Les ressources sont transférées d’abord ; le HTML est téléversé sous un nom temporaire puis renommé vers `index.html` en dernier. Le serveur SFTP doit permettre ce renommage avec remplacement, ce qui sera vérifié lors des premiers déploiements.

Il n’y a aucune suppression distante. Les autres dossiers de l’espace web ne sont pas synchronisés ni nettoyés. Les anciens dossiers de ressources restent en place pour les visiteurs ayant encore une ancienne page ouverte et pour permettre un retour à une version précédente. Un échec de transfert avant le basculement du HTML laisse la précédente page d’accueil en place ; l’opération n’est pas une transaction de l’ensemble du serveur, notamment pour `.htaccess`.

Pour revenir à une version précédente, relancer **Publier en production** avec le numéro d’une ancienne exécution de test réussie dont l’archive n’a pas expiré. Le pipeline ne revient pas automatiquement à l’ancienne version si une vérification HTTPS échoue après le transfert : inspecter l’erreur, puis republier la version souhaitée. Les archives expirent après 90 jours, les fichiers déjà hébergés restent présents. Au-delà, relancer un déploiement de test à partir du code souhaité avant de le promouvoir.

Les déploiements simultanés d’un même environnement sont sérialisés. GitHub peut remplacer une exécution encore en attente par une plus récente ; il n’interrompt pas celle qui transfère déjà les fichiers.

## Références

- [GitHub — lancer un workflow manuellement](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub — conserver et partager des artefacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [GitHub — gérer la concurrence](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [STRATO — connexion SFTP](https://www.strato.fr/faq/hebergement/comment-utiliser-votre-acces-sftpssh/)
- [STRATO — SSL](https://www.strato.fr/faq/nom-domaine/comment-utiliser-strato-ssl/)
