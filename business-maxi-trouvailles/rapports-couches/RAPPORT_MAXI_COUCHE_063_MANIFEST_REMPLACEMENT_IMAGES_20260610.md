# Maxi Trouvailles - Rapport couche 063

Date locale: 2026-06-10
Couche: manifeste remplacement images sprint
Statut: HOLD / GO technique

## Objectif

Preparer un manifeste client-safe pour decider quoi faire des 14 images du sprint GO humain avant toute publication.

Cette couche ne telecharge aucune image, ne genere aucune image produit, ne modifie aucun produit et ne publie rien. Elle transforme le blocage de la couche 062 en plan de decision exploitable: photo propre, droits fournisseur documentes, image licencee exacte, remplacement produit ou maintien en HOLD.

## Sauvegarde

- `backups/couche-063-manifest-remplacement-images-20260610_043643/package.json`
- `backups/couche-063-manifest-remplacement-images-20260610_043643/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Fichiers ajoutes ou modifies

- `scripts/automation/prepare_sprint_image_replacement_manifest.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/MANIFEST_REMPLACEMENT_IMAGES_SPRINT_20260610.json`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/MANIFEST_REMPLACEMENT_IMAGES_SPRINT_20260610.md`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/MANIFEST_REMPLACEMENT_IMAGES_SPRINT_20260610.csv`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_20260610.json`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/fiches-remplacement/01-pochette-organisateur-cables-double-couche-voyage.md`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/fiches-remplacement/02-support-pc-portable-pliant-aluminium-ajustable.md`
- `business-maxi-trouvailles/tableaux-action/manifest-remplacement-images-sprint-20260610/fiches-remplacement/03-filet-rangement-coffre-voiture-a-sangles-fixes.md`

## Resultat

- Produits controles: 3
- Images a traiter: 14
- Images fournisseur actuelles: 14
- Decisions de remplacement requises: 14
- Statut produit: `HOLD_REPLACEMENT_DECISION_REQUIRED`
- Decision par defaut: `keep_hold`
- Action appliquee au catalogue: aucune
- Images generees: aucune

Regle importante ajoutee: une image generee est interdite comme photo principale ou galerie produit exacte. Elle peut seulement servir a du visuel marketing non contractuel, separe du catalogue produit, si elle ne promet pas une variante exacte.

## Commande ajoutee

```powershell
npm run catalog:sprint-image-replacement-manifest
```

## Validations executees

- `node --check scripts/automation/prepare_sprint_image_replacement_manifest.mjs` OK
- `npm run catalog:sprint-image-replacement-manifest` OK, 3 produits, 14 images, 14 decisions requises
- `npm run catalog:audit-sprint-image-gates` OK, 3 bloquees, 0 echec dur
- `npm run catalog:sprint-image-local-plan` OK, 14 WebP manquants
- `npm run catalog:sprint-image-proof-board` OK, 14 images fournisseur detectees
- `npm run catalog:fast-go-shortlist` OK
- `npm run catalog:audit-fast-evidence-forms` OK, 5 HOLD
- `npm run catalog:business-next-actions` OK, 15 actions
- `npm run catalog:audit-all-partner-gates` OK, 37 HOLD, 0 publie
- `npm run catalog:audit-checkout-eligibility` OK
- `npm run catalog:test-checkout-guards` OK, 11/11
- `npm run catalog:audit-surprise-hold` OK
- `npm run catalog:audit-partners` OK
- `npm run catalog:audit-images` OK
- `npm run catalog:audit-partner-gates` OK
- `npm run typecheck` OK
- `npm run lint` OK

## Garde-fous confirmes

- Aucun telechargement d'image fournisseur.
- Aucune generation d'image produit exacte.
- Aucune ecriture catalogue.
- Aucune publication automatique.
- Aucun paiement.
- Aucune commande fournisseur.
- Aucun compte externe connecte.
- Les produits surprises et palettes restent non vendables.

## Limites

- Le manifeste ne prouve pas les droits images; il prepare les champs a remplir et garde tout en HOLD.
- Les 14 fichiers WebP locaux n'existent pas encore.
- Les variantes exactes et les preuves visuelles restent a valider humainement.
- Les produits ne doivent pas etre publies tant qu'une decision image reelle et documentee n'est pas complete.

## Prochaine couche recommandee

Ajouter un audit des decisions remplies dans `A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_20260610.json` pour refuser automatiquement les modes invalides, les champs vides, les images generees en galerie produit et tout passage GO sans preuve locale.
