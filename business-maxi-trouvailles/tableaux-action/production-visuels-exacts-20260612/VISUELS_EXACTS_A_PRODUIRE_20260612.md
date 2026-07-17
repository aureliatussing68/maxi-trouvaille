# Maxi Trouvailles - Production visuels exacts

Date locale: 2026-06-12 10:10 Europe/Paris
Statut: HOLD_VISUELS_EXACTS_A_PRODUIRE

## Synthese

- Total visuels a produire/deposer: 17
- Photos produits exactes: 8
- Images categories dropshipping: 9
- Copie publique: aucune
- Publication: aucune
- Paiement/commande fournisseur: aucun

## Ordre de travail unique

| Priorite | Urgence | File | Cible | Fichier attendu | Statut depot | Action |
|---:|---|---|---|---|---|---|
| 1 | P0 | photo_produit_exacte | Pochette organisateur câbles double couche voyage | 01-pochette-organisateur-cables-double-couche-voyage-main.webp | missing | Deposer le WebP exact avec ce nom. |
| 2 | P0 | photo_produit_exacte | Pochette organisateur câbles double couche voyage | 02-pochette-organisateur-cables-double-couche-voyage-detail.webp | missing | Deposer le WebP exact avec ce nom. |
| 3 | P0 | photo_produit_exacte | Pochette organisateur câbles double couche voyage | 03-pochette-organisateur-cables-double-couche-voyage-usage.webp | missing | Deposer le WebP exact avec ce nom. |
| 4 | P0 | photo_produit_exacte | Pochette organisateur câbles double couche voyage | 04-pochette-organisateur-cables-double-couche-voyage-dimensions.webp | missing | Deposer le WebP exact avec ce nom. |
| 5 | P0 | photo_produit_exacte | Support PC portable pliant aluminium ajustable | 01-support-pc-portable-pliant-aluminium-ajustable-main.webp | missing | Deposer le WebP exact avec ce nom. |
| 6 | P0 | photo_produit_exacte | Support PC portable pliant aluminium ajustable | 02-support-pc-portable-pliant-aluminium-ajustable-detail.webp | missing | Deposer le WebP exact avec ce nom. |
| 7 | P0 | photo_produit_exacte | Support PC portable pliant aluminium ajustable | 03-support-pc-portable-pliant-aluminium-ajustable-usage.webp | missing | Deposer le WebP exact avec ce nom. |
| 8 | P0 | photo_produit_exacte | Support PC portable pliant aluminium ajustable | 04-support-pc-portable-pliant-aluminium-ajustable-dimensions.webp | missing | Deposer le WebP exact avec ce nom. |
| 9 | P1 | image_categorie_dropshipping | High-tech | dropshipping-high-tech.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 10 | P1 | image_categorie_dropshipping | Accessoires | dropshipping-accessoires.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 11 | P1 | image_categorie_dropshipping | Auto / Moto | dropshipping-auto-moto.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 12 | P1 | image_categorie_dropshipping | Maison | dropshipping-maison.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 13 | P1 | image_categorie_dropshipping | Cuisine | dropshipping-cuisine.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 14 | P2 | image_categorie_dropshipping | Beauté | dropshipping-beaute.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 15 | P2 | image_categorie_dropshipping | Animaux | dropshipping-animaux.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 16 | P2 | image_categorie_dropshipping | Mode | dropshipping-mode.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |
| 17 | P2 | image_categorie_dropshipping | Enfant | dropshipping-enfant.webp | missing | deposer ou corriger le WebP exact dans le dossier depot |

## Regles

- Produire ou deposer uniquement des WebP exacts avec les noms indiques.
- Ne rien copier dans `public/uploads` sans revue humaine et validation Mouss.
- Garder les fiches et categories en HOLD tant que les fichiers restent absents.
- Relancer les audits photo et categorie apres depot.

## Commandes apres depot

```powershell
npm run catalog:photo-drop-kit
npm run catalog:audit-photo-checklist
npm run catalog:category-image-intake-status
npm run catalog:category-image-promotion-plan
npm run catalog:daily-execution-board
```

## Sources

- Ordre photos produits: business-maxi-trouvailles\depots-photos\depot-photos-sprint-20260612\ORDRE_TRAVAIL_PHOTOS_MANQUANTES_20260612.json
- Suivi images categories: business-maxi-trouvailles\tableaux-action\suivi-depots-images-categories-20260612\SUIVI_DEPOTS_IMAGES_CATEGORIES_20260612.json

