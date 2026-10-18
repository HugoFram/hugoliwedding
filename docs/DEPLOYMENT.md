# Déploiement : Raspberry Pi, test d’abord

Le test est installé sur le Raspberry Pi existant. L’OS et les services sont conservés. Les workflows n’utilisent plus SFTP STRATO ; les anciens scripts et paramètres restent disponibles pour référence.

L’aperçu local est **http://192.168.1.183:2585/**, accessible depuis le réseau de la maison uniquement. Aucune redirection du port 2585 sur le routeur n’est nécessaire.

L’URL publique prévue est **https://hugoli-mariage-test.frammery.com/**. Il reste à confirmer les ports internes du routeur, modifier le DNS de test et activer Let’s Encrypt. Tant que ces étapes sont incomplètes, le contrôle HTTPS final du workflow peut échouer alors que la version est déjà installée et consultable en local.

**La production Raspberry Pi est désactivée jusqu’à validation du test.** Son workflow manuel s’arrête avec un message explicite. Un changement de `main` ne publie jamais en production.

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

## Production après validation

La prochaine étape sera une promotion manuelle des **mêmes fichiers validés en test**, vers une racine et une branche séparées. La production ne devra pas reconstruire le dernier état de `main`. Cette étape, son certificat et son DNS seront mis en place après validation par Hugo.

Voir [RASPBERRY.md](RASPBERRY.md) pour l’installation et les sauvegardes. [STRATO.md](STRATO.md) décrit l’ancien hébergement SFTP.
