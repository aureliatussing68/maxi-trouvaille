# Rapport couche 296 - Export CSV validation lots actifs

## Objectif
- Ajouter un export CSV compact pour les 3 lots actifs preuve/rayon.
- Faciliter la relecture interne des statuts ACTIF/SUIVANT/ATTENTE.
- Garder tous les lots en brouillon/HOLD tant que les preuves exactes et la validation Mouss ne sont pas completes.

## Integration
- Ajout de `escapeDraftCsvCell`.
- Ajout de `buildDraftActiveProofCategoryValidationCsv`.
- Ajout d'un `useMemo` `activeProofCategoryValidationCsv`.
- Ajout du bloc pliable `Export CSV validation lots actifs` dans le resume de file active.
- Le CSV contient: position, statut, preuve, rayon, prets apres preuve, brouillons, blocages, priorite, premier brouillon, garde HOLD.

## Garde-fous
- Export lecture seule uniquement.
- Aucun produit n'est publie ou rendu achetable.
- Aucun fournisseur, AliExpress, Temu ou mention supplier n'est expose cote client.
- Aucun paiement, achat, commande, connexion compte, message reel, suppression definitive, API payante ou deploiement production.

## Verifications
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-admin-page-guards` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run build` OK.
- Verification navigateur mobile admin sur `127.0.0.1:3121/admin/dropshipping` OK:
  - selection du lot `Droits image / Enfant`;
  - bloc `Export CSV validation lots actifs` visible et ouvert;
  - CSV contient l'en-tete `position;statut;preuve;rayon`;
  - CSV contient `1/3 ATTENTE Droits image / Beaute`, `2/3 ACTIF Droits image / Enfant`, `3/3 SUIVANT Droits image / Mode`;
  - garde HOLD present dans chaque ligne;
  - aucune erreur console;
  - aucun debordement horizontal mobile.

## Preuve visuelle
- Capture: `tmp-next-couche-296-mobile.png`.

## Suite conseillee
- Ajouter un champ "dernier produit traite" local pour chaque lot actif, sans publication ni sortie de HOLD.
