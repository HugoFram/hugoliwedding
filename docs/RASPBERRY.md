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
| HTTPS du test | `/etc/apache2/sites-available/hugoli-test-https.conf` |
| Hook de renouvellement dédié | `/etc/letsencrypt/renewal-hooks/deploy/hugoli-test-cert-deploy` |
| Hôte HTTP par défaut préservé | `/etc/apache2/sites-available/000-hugoli-preserve-http.conf` |
| Validation ACME réservée | `/var/www/hugoli/acme/.well-known/acme-challenge` |
| Minuteur et service | `/etc/systemd/system/hugoli-test-pull.{timer,service}` |

Le compte système `hugoli-deploy` n’a ni shell interactif ni accès sudo. Il écrit dans ses nouveaux dossiers. Le service systemd ajoute `NoNewPrivileges`, `ProtectHome` et `ProtectSystem=strict`, avec deux chemins d’écriture autorisés. Apache peut lire les fichiers sans droits d’écriture ouverts à tous. Les `.htaccess` sont ignorés ; le type MIME `.mjs` et les règles d’accès sont dans la configuration Apache détenue par root.

L’agent vérifie le dépôt et la destination, refuse la production, les chemins sortants, les liens dans les archives et les empreintes incorrectes. Il n’exécute aucun fichier publié par GitHub. Il conserve les anciennes ressources et bascule l’index en dernier.

## Préservation des applications existantes

Apache héberge plusieurs applications sur des ports distincts. Ses ports 80 et 443 répondaient initialement en HTTP, sans hôte virtuel explicite. Un hôte par défaut sur le port 80 conserve la racine `/var/www/html`, avant l’hôte nommé du test. Le port 443 sert désormais le test en TLS, à la place de son index HTTP générique. C’est le seul changement attendu dans les contrôles des anciens ports. Les applications sur leurs ports dédiés sont conservées. La redirection vers HTTPS concerne uniquement le nom public de test sur le port 80 ; l’aperçu LAN reste en HTTP.

L’installateur sauvegarde `/etc/apache2`, relève les réponses des anciens sites et les PID principaux des services, contrôle la syntaxe, effectue un rechargement gracieux d’Apache puis compare les relevés. Il désactive ses deux nouveaux hôtes si la comparaison échoue. Les autres services ne sont pas redémarrés. Les configurations et certificats des anciens sites ne sont pas modifiés.

Sauvegarde de l’activation réussie : `/var/backups/hugoli-test-20261018-180747/` (Apache, relevé JSON et UFW), accessible à root seulement. Une règle UFW dédiée autorise le port d’aperçu 2585 depuis `192.168.1.0/24`, en conservant les règles existantes.

Les sources sont dans `deploy/raspberry/`. `install-test.sh` attend une archive initiale contenant `manifest.json` et `site/`, créée par `scripts/release.mjs`. L’exécuter comme root depuis une copie de ce dossier sur le Pi. Ne pas l’utiliser sur un autre serveur sans vérifier les hypothèses réseau et Apache.

## DNS et HTTPS activés

Le domaine reste enregistré chez STRATO. Le sous-domaine de test possède un enregistrement A vers `31.164.116.82`, sans AAAA, vérifié le 18 octobre 2026. Si cette IP publique change, mettre à jour l’entrée. Les ports Internet 80 et 443 vont vers les mêmes ports du Pi. Les autres redirections du routeur sont conservées.

Le certificat Let’s Encrypt a été obtenu avec le Certbot existant en mode `webroot`, pour **le sous-domaine de test uniquement**. Il expire le 16 janvier 2027. Le minuteur Certbot existant, actif deux fois par jour, prend en charge les renouvellements. Le hook ajouté ne recharge Apache que pour ce certificat, après contrôle de syntaxe ; il ignore les anciens certificats. La simulation ci-dessous a réussi :

```sh
sudo certbot renew --cert-name hugoli-mariage-test.frammery.com --dry-run --non-interactive
```

Le certificat et sa clé restent sous `/etc/letsencrypt/live/hugoli-mariage-test.frammery.com/`. Aucune clé privée n’est stockée dans GitHub. Les configurations et certificats des anciens sites n’ont pas été remplacés.

La sauvegarde avant activation HTTPS est `/var/backups/hugoli-test-https-20261018-182026/`. Les réponses des anciennes applications et les PID principaux des services ont été comparés avant et après rechargement gracieux. Le passage du port 443 de HTTP à TLS est une différence attendue et explicite.

Les sources comprennent `enable-test-https.sh`, à utiliser après obtention du certificat. L’installateur HTTP initial refuse désormais de s’exécuter si HTTPS est déjà actif, pour ne pas retirer la redirection. Pour désactiver seulement le nouveau HTTPS, retirer le lien `/etc/apache2/sites-enabled/hugoli-test-https.conf`, restaurer la configuration HTTP du test depuis cette sauvegarde, contrôler la syntaxe et effectuer un rechargement gracieux. Le certificat et les versions du site peuvent rester en place.

Le test public est **https://hugoli-mariage-test.frammery.com/** et l’aperçu local reste **http://192.168.1.183:2585/**. La production attend sa validation.
