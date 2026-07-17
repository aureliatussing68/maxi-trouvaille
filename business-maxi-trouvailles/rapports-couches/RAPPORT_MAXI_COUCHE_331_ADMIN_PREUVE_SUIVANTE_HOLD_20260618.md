# Rapport Maxi Couche 331 - Admin preuve suivante HOLD

Date: 2026-06-18 08:59 Europe/Paris

## Objectif

Ajouter un mini index admin "preuve suivante a faire" dans `/admin/decision-hold` pour grouper les fiches partenaires HOLD par prochaine action concrete, sans lever le HOLD et sans ajouter de publication automatique.

## Sauvegarde

- `business-maxi-trouvailles/backups/couche-331-admin-preuve-suivante-20260618/admin-decision-hold-page.tsx.bak`

## Integration realisee

- Ajout du filtre `action` dans `/admin/decision-hold`.
- Ajout de 6 actions admin: image/droits, partenaire/SKU, prix/stock/marge, livraison/suivi, validation Mouss, revue humaine.
- Ajout d'une section mobile "Preuve suivante a faire" avec compteurs cliquables.
- Ajout d'un badge "Prochaine preuve" sur chaque fiche de decision.
- Ajout de `preuve_suivante` dans l'export CSV filtre.
- Conservation des filtres existants `lane`, `zone` et `q` dans les liens.

## Garde-fous

- Aucun produit HOLD publie.
- Aucun bouton d'achat ajoute.
- Aucun paiement.
- Aucune commande partenaire.
- Aucun achat reel.
- Aucun message reel.
- Aucun deploiement.
- Aucune connexion compte.
- Aucun terme AliExpress, Temu, supplier/fournisseur visible dans la verification navigateur.

## Verifications

- Documentation Next lue: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.
- Skill navigateur lue: `browser:control-in-app-browser`.
- `npx eslint src/app/admin/decision-hold/page.tsx` OK.
- `npm run typecheck` OK.
- `npm run catalog:audit-admin-page-guards` OK.
- `npm run catalog:audit-admin-publication-ui-guard` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit dropshipping visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-generated-artifact-leaks` OK.
- `npm run lint` OK.
- `npm run build` OK.

## Verification mobile navigateur

- Serveur local lance sur `localhost:3256` avec `ADMIN_MODE=true`, puis arrete.
- Route testee: `/admin/decision-hold?action=image-droits&lane=hold`.
- Viewport mobile: 390x844.
- H1 present: "Decision compacte avant sortie de HOLD".
- Section "Preuve suivante a faire" presente.
- Carte "Prouver image et droits" presente avec 91 fiches.
- 30 fiches visibles affichent "Prochaine preuve".
- Liens preuves et edition presents cote admin.
- Aucun terme AliExpress, Temu, supplier/fournisseur visible.
- Aucun overflow horizontal.
- Logs navigateur warning/error: 0.
- Captures:
  - `tmp-next-couche-331-admin-preuve-suivante-mobile.png`
  - `tmp-next-couche-331-admin-preuve-suivante-mobile-action.png`

## Suite conseillee

- Ajouter un tri admin par score de rentabilite/priorite sur la meme page, toujours sans sortie HOLD automatique.
- Continuer la consolidation publique mobile rayon par rayon.
