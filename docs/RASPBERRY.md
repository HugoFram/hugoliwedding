# Hébergement sur le Raspberry Pi existant

Installation du test le 18 octobre 2026, via SSH sur `pi@192.168.1.183`. L’OS Raspbian 10, Apache 2.4.38, Python 3.7 et les services existants sont conservés. Aucun paquet installé, mise à niveau ou redémarrage du Pi.

## Composants ajoutés

| Élément | Emplacement |
| --- | --- |
| Page et ressources de test | `/var/www/hugoli/test/public` |
| Index et manifestes des versions | `/var/www/hugoli/test/versions` |
| Agent Python, propriété de root | `/opt/hugoli-deploy/pull.py` |
| Paramètres, propriété de root | `/etc/hugoli-deploy/test.json` |
| Cache Git et état du compte dédié | `/var/lib/hugoli-deploy` |
| HTTP test et aperçu LAN | `/etc/apache2/sites-available/hugoli-test-http.conf` |
| Hôte HTTP par défaut préservé | `/etc/apache2/sites-available/000-hugoli-preserve-http.conf` |
| Validation ACME réservée | `/var/www/hugoli/acme/.well-known/acme-challenge` |
| Minuteur et service | `/etc/systemd/system/hugoli-test-pull.{timer,service}` |

Le compte système `hugoli-deploy` n’a ni shell interactif ni accès sudo. Il écrit dans ses nouveaux dossiers. Le service systemd ajoute `NoNewPrivileges`, `ProtectHome` et `ProtectSystem=strict`, avec deux chemins d’écriture autorisés. Apache peut lire les fichiers sans droits d’écriture ouverts à tous. Les `.htaccess` sont ignorés ; le type MIME `.mjs` et les règles d’accès sont dans la configuration Apache détenue par root.

L’agent vérifie le dépôt et la destination, refuse la production, les chemins sortants, les liens dans les archives et les empreintes incorrectes. Il n’exécute aucun fichier publié par GitHub. Il conserve les anciennes ressources et bascule l’index en dernier.

## Préservation des applications existantes

Apache héberge plusieurs applications sur des ports distincts. Ses ports 80 et 443 répondaient initialement en HTTP, sans hôte virtuel explicite. Un hôte par défaut sur le port 80 conserve la racine `/var/www/html`, avant l’hôte nommé du test. Le port 443 n’a pas été modifié.

L’installateur sauvegarde `/etc/apache2`, relève les réponses des anciens sites et les PID principaux des services, contrôle la syntaxe, effectue un rechargement gracieux d’Apache puis compare les relevés. Il désactive ses deux nouveaux hôtes si la comparaison échoue. Les autres services ne sont pas redémarrés. Les configurations et certificats des anciens sites ne sont pas modifiés.

Sauvegarde de l’activation réussie : `/var/backups/hugoli-test-20261018-180747/` (Apache, relevé JSON et UFW), accessible à root seulement. Une règle UFW dédiée autorise le port d’aperçu 2585 depuis `192.168.1.0/24`, en conservant les règles existantes.

Les sources sont dans `deploy/raspberry/`. `install-test.sh` attend une archive initiale contenant `manifest.json` et `site/`, créée par `scripts/release.mjs`. L’exécuter comme root depuis une copie de ce dossier sur le Pi. Ne pas l’utiliser sur un autre serveur sans vérifier les hypothèses réseau et Apache.

## DNS et HTTPS : étapes restantes

Le domaine reste enregistré chez STRATO. Modifier **uniquement le test** : A `hugoli-mariage-test.frammery.com` vers `31.164.116.82`, l’IP publique relevée le 18 octobre 2026, et retirer un éventuel AAAA de ce seul nom s’il n’est pas routé vers le Pi. Si l’IP publique change, mettre à jour cette entrée.

Les ports Internet 80 et 443 sont déjà redirigés vers le Pi selon Hugo. Les ports internes exacts restent à confirmer : ils déterminent sur quels hôtes Apache ajouter le nouveau nom sans détourner les anciens sites.

Après vérification HTTP depuis Internet, obtenir avec le Certbot existant un certificat **uniquement pour le test**, en mode `webroot`. Ajouter un hôte TLS nommé dans un fichier dédié, vérifier le certificat depuis Internet et tester le renouvellement. Éviter le plugin installateur Apache qui pourrait réécrire les anciens hôtes. Les anciens certificats à renouvellement manuel restent hors du périmètre.

Le test local est **http://192.168.1.183:2585/**. La production attend sa validation.
