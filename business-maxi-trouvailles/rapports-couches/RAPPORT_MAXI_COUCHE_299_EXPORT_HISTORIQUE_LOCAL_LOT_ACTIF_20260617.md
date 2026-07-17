# Rapport couche 299 - Export historique local lot actif

## Objectif
- Ajouter un export texte court de l'historique local du lot actif.
- Faciliter la reprise manuelle depuis l'admin mobile.
- Conserver le principe: session locale uniquement, aucun changement catalogue, aucun retrait du HOLD.

## Integration
- Ajout de `buildDraftActiveProofCategoryHistoryText`.
- Ajout du `useMemo` `activeProofCategoryHistoryText`.
- Ajout du bloc pliable `Export historique local` sous l'historique local du lot.
- Export en textarea lecture seule avec lot actif, produits marques, slug, garde-fou HOLD et validation Mouss.
- Correction de la stabilite React de `activeProofCategoryHandledHistory` avec `useMemo`.

## Garde-fous
- Export lecture seule uniquement.
- Aucun produit n'est publie ou rendu achetable.
- Aucun changement catalogue n'est ecrit.
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
- Verification navigateur mobile admin sur `127.0.0.1:3124/admin/dropshipping` OK:
  - selection du lot `Droits image / Enfant`;
  - marquage local de `Protege coins silicone enfant`;
  - bloc `Export historique local` ouvert;
  - export contient `Historique local lot actif`;
  - export contient `Lot: Droits image / Enfant`;
  - export contient le slug `protege-coins-silicone-enfant-partenaire-hold`;
  - export rappelle `historique session uniquement`, `aucune persistance catalogue` et `conserver HOLD`;
  - aucune erreur console;
  - aucun debordement horizontal mobile.

## Preuve visuelle
- Capture: `tmp-next-couche-299-mobile.png`.

## Suite conseillee
- Ajouter un bouton local de purge de l'historique du lot actif, sans ecriture catalogue.
