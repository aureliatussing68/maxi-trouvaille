# Rapport couche 075 - Roadmap globale images categories

Date: 2026-06-10

## Objectif

Etendre le pilotage des images categories a tout le site, pas seulement aux 5 visuels prioritaires. Cette couche classe chaque categorie: image OK, image a differencier, categorie cachee/a venir, ou revue partagee.

Aucune image n'a ete generee, telechargee, copiee ou publiee.

## Sauvegarde

Sauvegarde avant modification:

- `backups/couche-075-roadmap-images-categories-20260610_081213/package.json`
- `backups/couche-075-roadmap-images-categories-20260610_081213/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Fichiers ajoutes ou modifies

- `scripts/automation/prepare_category_image_roadmap.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/roadmap-images-categories-20260610/ROADMAP_IMAGES_CATEGORIES_20260610.json`
- `business-maxi-trouvailles/tableaux-action/roadmap-images-categories-20260610/ROADMAP_IMAGES_CATEGORIES_20260610.md`
- `business-maxi-trouvailles/tableaux-action/roadmap-images-categories-20260610/ROADMAP_IMAGES_CATEGORIES_20260610.csv`
- `business-maxi-trouvailles/tableaux-action/roadmap-images-categories-20260610/briefs-production/`

## Commande ajoutee

```powershell
npm run catalog:category-image-roadmap
```

La commande lit l'audit categories, le sprint d'unicite et le plan de promotion. Elle produit une roadmap globale et des briefs de production pour les categories qui demandent une action.

## Resultat

- Categories auditees: 45
- Categories visibles: 38
- Categories cachees: 7
- Categories avec WebP local valide: 45
- Images uniques locales valides: 31
- Categories OK a conserver: 18
- Categories a produire/revoir: 27

Repartition:

- `P0`: 0
- `P1`: 5 images prioritaires a deposer/produire
- `P2`: 4 variantes dropshipping a creer ensuite
- `P3`: 11 images partagees a surveiller ou conserver comme canon principal
- `P4`: 7 categories cachees/a venir a ne pas mettre en avant
- `OK`: 18 categories a conserver

Correction business importante: `Promotions` est classe en `P3 KEEP_DEDICATED_VISIBLE_ASSET_REVIEW_HIDDEN_COPY`, car son fichier visible est deja dedie; seul le partage avec une categorie cachee doit etre surveille.

## Preuves de securite

La sortie JSON confirme:

- `readOnly: true`
- `noPublicUploadsWrite: true`
- `noImageGeneration: true`
- `noImageDownload: true`
- `noImageReplacement: true`
- `noCatalogWrite: true`
- `noPublication: true`
- `noPayment: true`
- `noSupplierOrder: true`
- `manualValidationRequired: true`

## Validations executees

```powershell
node --check scripts\automation\prepare_category_image_roadmap.mjs
npm run catalog:audit-category-images
npm run catalog:category-image-uniqueness-sprint
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:category-image-roadmap
npm run catalog:audit-images
npm run catalog:audit-partner-gates
npm run catalog:audit-all-partner-gates
npm run catalog:audit-checkout-eligibility
npm run catalog:test-checkout-guards
npm run catalog:audit-surprise-hold
npm run catalog:business-next-actions
npm run typecheck
npm run lint
```

Resultat:

- roadmap categories OK;
- audit categories OK;
- kit depot et plan promotion categories OK;
- gates partenaires OK;
- checkout guards OK;
- colis surprises/palettes toujours non vendables;
- typecheck OK;
- lint OK.

## Limites

La roadmap ne remplace pas les images et ne cree aucun visuel. Les 5 fichiers prioritaires restent absents dans le depot, donc le passage en revue humaine reste bloque.

## Prochain pas recommande

Produire ou deposer d'abord les 5 WebP `P1`:

1. `dropshipping-high-tech.webp`
2. `dropshipping-accessoires.webp`
3. `dropshipping-auto-moto.webp`
4. `dropshipping-maison.webp`
5. `dropshipping-cuisine.webp`

Puis relancer:

```powershell
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:category-image-roadmap
```

Statut final: HOLD propre, roadmap globale prete.
