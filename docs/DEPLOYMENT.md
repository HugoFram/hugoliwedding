# Déploiement : Raspberry Pi, test d’abord

Le test est installé sur le Raspberry Pi existant. L’OS et les services sont conservés. Les workflows n’utilisent plus SFTP STRATO ; les anciens scripts et paramètres restent disponibles pour référence.

L’aperçu local est **http://192.168.1.183:2585/**, accessible depuis le réseau de la maison uniquement. Aucune redirection du port 2585 sur le routeur n’est nécessaire.

Le test public est disponible sur **https://hugoli-mariage-test.frammery.com/**. Le DNS pointe vers le Pi ; les ports publics 80 et 443 sont redirigés vers les mêmes ports internes. HTTP redirige vers HTTPS, en conservant les validations ACME sur HTTP. Le certificat Let’s Encrypt a été délivré et son renouvellement automatique a été testé par une simulation réussie.

**La production est active sur https://hugoli-mariage.frammery.com/.** La première version publiée est celle du test validé : exécution `39144787381`, commit `aaf425ae78c5e927f1d991d005413ab078afcd46`, tentative `1`. Un changement de `main` ne publie jamais en production.

## Fonctionnement quotidien

1. Une modification de `main` lance [Déployer en test](https://github.com/HugoFram/hugoliwedding/actions/workflows/deploy-test.yml).
2. GitHub vérifie le JavaScript, exécute les tests Node et Python, construit le site et conserve l’archive pendant 90 jours.
3. Le workflow publie les fichiers préparés dans la branche `site-test`, avec un manifeste et les empreintes SHA-256. Il utilise le jeton temporaire GitHub Actions ; aucun nouveau secret n’est nécessaire.
4. Le Pi consulte cette branche publique toutes les 30 secondes environ. Son compte dédié valide les chemins et les empreintes, installe les ressources puis remplace atomiquement `index.html` en dernier. Aucun script du dépôt n’est exécuté sur le Pi.
5. Le workflow attend le déploiement et compare chaque fichier servi en HTTPS avec la version attendue, certificat et type MIME JavaScript compris.

Les déploiements GitHub sont sérialisés et l’agent prend un verrou local. Le Pi doit pouvoir sortir vers GitHub en HTTPS. Aucun accès SSH depuis Internet, runner GitHub sur le Pi ou identifiant SFTP STRATO n’est utilisé. Un dépôt devenu privé nécessiterait un accès GitHub en lecture seule sur le Pi.

## Vérifier une version

Le fichier `/_deployment.json` du site contient le commit source, l’exécution GitHub, sa tentative et la date d’installation. Le HTML contient aussi l’identifiant de version. Consulter la page et le résumé GitHub avant de valider.

Sur le Pi :

```sh
systemctl status hugoli-test-pull.timer
journalctl -u hugoli-test-pull.service -n 30 --no-pager
curl http://127.0.0.1:2585/_deployment.json
```

Une erreur réseau ou de validation avant le basculement de l’index laisse la page précédente en place. Le minuteur réessaie ensuite. Les ressources des anciennes versions sont conservées pour les pages encore ouvertes ; aucun nettoyage automatique n’est effectué.

## Arrêter ou reprendre les déploiements

```sh
sudo systemctl stop hugoli-test-pull.timer
sudo systemctl start hugoli-test-pull.timer
```

L’arrêt du minuteur conserve le site servi. Pour une vérification immédiate : `sudo systemctl start hugoli-test-pull.service`.

## Revenir à une version installée

Arrêter le minuteur et attendre la fin d’une éventuelle exécution (`systemctl is-active hugoli-test-pull.service`). Choisir un identifiant sous `/var/www/hugoli/test/versions/`, puis exécuter dans SSH :

```sh
sudo -u hugoli-deploy python3 - <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, '/opt/hugoli-deploy')
from pull import atomic_write
root = Path('/var/www/hugoli/test')
release = 'REMPLACER_PAR_UN_IDENTIFIANT_DE_VERSION_INSTALLEE'
atomic_write(root / 'public/index.html', (root / 'versions' / release / 'index.html').read_bytes())
status = root / 'public/_deployment.json'
if status.exists():
    status.unlink()
PY
```

Le statut est supprimé pour ne pas annoncer une version différente de la page restaurée. Les ressources restent présentes. Laisser le minuteur arrêté pendant le diagnostic ; une nouvelle publication sur `main` permettra de reprendre avec une version corrigée. Si le minuteur reprend sans nouvelle publication, l’agent conserve la page restaurée tant que le commit de publication n’a pas changé.

## Publier une version validée en production

1. Attendre le succès d’une exécution de **Déployer en test**, puis valider le site visuellement. Retenir le numéro d’exécution dans son URL GitHub.
2. Ouvrir [Publier en production](https://github.com/HugoFram/hugoliwedding/actions/workflows/deploy-production.yml), puis **Run workflow** sur la branche `main`.
3. Renseigner `test_run_id` avec ce numéro. Le workflow vérifie que le test provient de ce dépôt, sur `main`, et qu’il a réussi.
4. GitHub télécharge l’archive `hugoli-site-<tentative>` de cette exécution, vérifie son identité et ses empreintes, puis la publie dans `site-production`. **Aucune reconstruction du site n’est effectuée.**
5. Le Pi récupère cette branche avec un compte distinct, sans droits d’écriture sur le test. Le workflow attend puis vérifie chaque fichier public en HTTPS.

Les futurs changements du test ne modifient pas la production. Les promotions de production sont sérialisées. Pour revenir à une version précédente, relancer ce workflow avec le numéro d’un ancien test réussi dont l’archive est encore disponible (90 jours).

La première publication a été autorisée par Hugo dans le chat et réalisée en créant `site-production` sur le commit de publication validé `496ead36e7f294084077924eca229852d39ac248`, après les mêmes vérifications d’origine et d’empreintes. La récupération automatique par le Pi et les fichiers HTTPS ont été contrôlés. Les publications suivantes utilisent le workflow manuel ci-dessus.

## Diagnostic et retour arrière en production

Les commandes de diagnostic et d’arrêt du minuteur sont les mêmes que pour le test, avec `hugoli-production-pull`. Le compte est `hugoli-production`, la racine `/var/www/hugoli/production`, et le cache Git `/var/lib/hugoli-production-deploy`.

Pour une restauration locale urgente, arrêter le minuteur de production, attendre la fin du service, puis adapter la procédure Python ci-dessus avec ce compte et cette racine. Arrêter le minuteur du test ne bloque pas celui de production, et inversement. Une restauration via le workflow manuel est préférable lorsque l’archive est disponible.

Voir [RASPBERRY.md](RASPBERRY.md) pour l’installation et les sauvegardes. [STRATO.md](STRATO.md) décrit l’ancien hébergement SFTP.
