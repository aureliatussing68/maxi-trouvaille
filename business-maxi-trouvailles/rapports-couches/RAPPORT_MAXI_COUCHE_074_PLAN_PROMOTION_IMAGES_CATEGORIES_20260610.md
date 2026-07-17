# Rapport couche 074 - Plan promotion images categories

Date: 2026-06-10

## Objectif

Ajouter une passerelle de controle entre le depot manuel des WebP categories et une future copie publique. Cette couche prepare un plan de promotion/revue humaine, sans copier d'image dans `public/uploads/category-images` et sans modifier le catalogue.

## Sauvegarde

Sauvegarde avant modification:

- `backups/couche-074-plan-promotion-images-categories-20260610_075523/package.json`
- `backups/couche-074-plan-promotion-images-categories-20260610_075523/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Fichiers ajoutes ou modifies

- `scripts/automation/prepare_category_image_promotion_plan.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/plan-promotion-images-categories-20260610/PLAN_PROMOTION_IMAGES_CATEGORIES_20260610.json`
- `business-maxi-trouvailles/tableaux-action/plan-promotion-images-categories-20260610/PLAN_PROMOTION_IMAGES_CATEGORIES_20260610.md`
- `business-maxi-trouvailles/tableaux-action/plan-promotion-images-categories-20260610/PLAN_PROMOTION_IMAGES_CATEGORIES_20260610.csv`

## Commande ajoutee

```powershell
npm run catalog:category-image-promotion-plan
```

La commande lit le dernier `MANIFEST_DEPOT_IMAGES_CATEGORIES_*.json`, controle les WebP deposes, verifie signature/dimensions/ratio/poids, classe chaque categorie et produit un plan futur non execute.

## Resultat

- Categories controlees: 5
- Mecaniquement pretes pour revue humaine: 0
- Bloquees avant revue humaine: 5
- Cause actuelle: `MISSING_WEBP_IN_DROP_FOLDER`
- Copie vers `public/uploads/category-images`: 0
- Modification catalogue: 0
- Publication: 0

Categories suivies:

1. `dropshipping-high-tech.webp`
2. `dropshipping-accessoires.webp`
3. `dropshipping-auto-moto.webp`
4. `dropshipping-maison.webp`
5. `dropshipping-cuisine.webp`

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
node --check scripts\automation\prepare_category_image_promotion_plan.mjs
npm run catalog:audit-category-images
npm run catalog:category-image-uniqueness-sprint
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
npm run catalog:audit-images
npm run catalog:audit-partner-gates
npm run catalog:audit-all-partner-gates
npm run catalog:audit-checkout-eligibility
npm run catalog:test-checkout-guards
npm run catalog:audit-surprise-hold
npm run catalog:photo-sprint-du-jour
npm run catalog:photo-drop-kit
npm run catalog:audit-sprint-image-human-review
npm run catalog:business-next-actions
npm run typecheck
npm run lint
```

Resultat:

- plan promotion categories OK;
- audit categories OK;
- kit depot categories OK;
- gates partenaires OK;
- checkout guards OK;
- colis surprises/palettes toujours non vendables;
- sprint photos produits toujours en HOLD;
- typecheck OK;
- lint OK.

## Limites

Les 5 WebP categories ne sont pas encore presents dans le depot. La couche bloque donc volontairement la promotion publique. Aucun visuel n'a ete invente, telecharge, copie ou publie.

## Prochain pas recommande

Deposer les 5 WebP exacts dans:

`business-maxi-trouvailles/depots-images-categories/depot-images-categories-20260610/categories/`

Puis relancer:

```powershell
npm run catalog:category-image-drop-kit
npm run catalog:category-image-promotion-plan
```

Si les fichiers passent en `READY_FOR_HUMAN_VISUAL_REVIEW_HOLD`, faire une revue mobile/desktop et obtenir validation Mouss avant toute copie publique.

Statut final: HOLD propre, plan promotion pret.
