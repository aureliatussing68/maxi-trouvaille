# Rapport Maxi Trouvailles - Couche 034 - Garde-fou import images

## Objectif

Eviter qu'un futur import AliExpress republie automatiquement des produits avec des images de categorie generiques.

## Fichier modifie

- `scripts/automation/import_aliexpress_partner_products.mjs`

## Sauvegarde creee

- `backups/couche034_guard_import_images_20260605_033718/import_aliexpress_partner_products.mjs`

## Changements faits

- Detection des images commencant par `/uploads/category-images/`.
- Les produits importes avec ce type d'image passent automatiquement en `draft`.
- Ajout d'un statut `imageValidation.status = hold`.
- Ajout d'un message interne demandant une photo fournisseur exacte avant remise en `published`.

## Tests executes

- `node --check scripts/automation/import_aliexpress_partner_products.mjs` : OK
- `npm run typecheck` : OK
- `npm run lint` : OK

## Garde-fous respectes

- Aucune commande fournisseur.
- Aucun paiement.
- Aucune publication reelle.
- Aucun envoi mail.
- Aucune connexion compte.
- Aucun secret affiche.
- Aucun fichier Jarvis ou Roblox touche.

## Prochaine couche conseillee

Couche 035 : reprendre un produit en HOLD photo, choisir une annonce fournisseur precise avec livraison courte verifiable, importer des images coherentes, enrichir la fiche, puis remettre en ligne seulement si la correspondance produit/photo est claire.
