# Maxi Trouvailles - Rapport couche 061

Date locale: 2026-06-10
Couche: plan local images sprint partenaires
Statut: HOLD / GO technique

## Objectif

Preparer le plan de rapatriement ou remplacement local des images pour les 3 produits du sprint GO humain, sans telecharger d'image fournisseur et sans modifier le catalogue.

Cette couche transforme les 14 images fournisseur detectees en emplacements cibles WebP propres, avec ordre galerie, noms stables, alt SEO et statut de fichier manquant.

## Sauvegarde

- `backups/couche-061-plan-local-images-sprint-20260610_034044/package.json`
- `backups/couche-061-plan-local-images-sprint-20260610_034044/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`

## Fichiers ajoutes ou modifies

- `scripts/automation/prepare_sprint_image_localization_plan.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/plan-local-images-sprint-20260610/PLAN_LOCAL_IMAGES_SPRINT_20260610.json`
- `business-maxi-trouvailles/tableaux-action/plan-local-images-sprint-20260610/PLAN_LOCAL_IMAGES_SPRINT_20260610.md`
- `business-maxi-trouvailles/tableaux-action/plan-local-images-sprint-20260610/PLAN_LOCAL_IMAGES_SPRINT_20260610.csv`
- `business-maxi-trouvailles/tableaux-action/plan-local-images-sprint-20260610/MANIFEST_IMAGES_LOCALES_A_REMPLIR_20260610.json`
- `business-maxi-trouvailles/tableaux-action/plan-local-images-sprint-20260610/fiches-localisation/*.md`

## Produits planifies

1. Pochette organisateur cables double couche voyage
2. Support PC portable pliant aluminium ajustable
3. Filet rangement coffre voiture a sangles fixes

## Resultat

- 3 produits planifies.
- 14 images cibles WebP preparees.
- 14 fichiers locaux manquants.
- 0 telechargement effectue.
- 0 modification catalogue.
- Statut des 3 produits: `HOLD_LOCAL_IMAGES_MISSING`.

Chaque image a maintenant:

- un chemin public cible;
- un chemin disque cible;
- un role galerie (`main`, `detail`, `usage`, `dimensions`, etc.);
- un alt SEO;
- un statut `missing_local_file_hold`.

## Commande ajoutee

```powershell
npm run catalog:sprint-image-local-plan
```

## Validations executees

- `node --check scripts/automation/prepare_sprint_image_localization_plan.mjs` OK
- `npm run catalog:sprint-image-local-plan` OK, 14 images cibles, 14 manquantes
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

- Aucune publication automatique.
- Aucun paiement.
- Aucune commande fournisseur.
- Aucun deploiement.
- Aucun compte externe connecte.
- Aucune image fournisseur telechargee ou reutilisee sans decision droits images.
- Les produits surprises et palettes restent non vendables.

## Limites

- Les fichiers WebP cibles n'existent pas encore.
- Le catalogue ne doit pas etre modifie avant presence des fichiers, verification variante, decision droits images et validation Mouss.
- Cette couche prepare le plan; elle ne remplace pas les images.

## Prochaine couche recommandee

Creer un audit strict qui refusera tout passage en revue humaine si une fiche sprint pointe encore vers `ae01.alicdn.com` ou si un chemin cible local WebP manque.
