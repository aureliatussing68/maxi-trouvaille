# Rapport couche 294 - Export resume file active preuve/rayon

## Objectif
- Ajouter un export compact de la file active preuve/rayon dans l'admin dropshipping.
- Permettre de copier vite l'etat des 3 lots sans ouvrir le grand export complet.
- Garder le pilotage dropshipping en HOLD/brouillon tant que les preuves exactes ne sont pas completes et validees par Mouss.

## Integration
- Ajout de `buildDraftActiveProofCategorySummaryText` pour produire un resume texte court: position active, lot actif, lots ACTIF/SUIVANT/ATTENTE, volumes prets, blocages et premier produit.
- Ajout d'un `useMemo` dedie a l'export compact de la file active.
- Ajout d'un bloc pliable `Export resume file active` sous les cartes de resume mobile, avec textarea lecture seule sur 7 lignes.

## Garde-fous
- Aucun produit n'est publie.
- Les lots restent explicitement en brouillon/HOLD tant que l'image exacte, le fournisseur, le SKU, le prix, le stock, le delai France/Europe, les droits image et la validation Mouss ne sont pas prouves.
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
- Verification navigateur mobile admin sur `127.0.0.1:3119/admin/dropshipping` OK:
  - selection du lot `Droits image / Enfant`;
  - export compact ouvert;
  - export contient `Position active: 2/3`, `[ACTIF] Droits image / Enfant`, `[SUIVANT] Droits image / Mode`, `[ATTENTE] Droits image / Beaute`;
  - garde HOLD presente;
  - aucune erreur console;
  - aucun debordement horizontal mobile.

## Preuve visuelle
- Capture: `tmp-next-couche-294-mobile.png`.

## Suite conseillee
- Ajouter une barre de progression visuelle des 3 lots actifs ou un export CSV de validation des lots actifs.
