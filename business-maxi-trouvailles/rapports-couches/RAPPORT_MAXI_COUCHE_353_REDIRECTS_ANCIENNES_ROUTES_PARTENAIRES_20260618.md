# Rapport Maxi couche 353 - Redirects anciennes routes partenaires

## Objectif
- Eviter qu'une ancienne URL publique sensible rende encore une page autonome.
- Garder les anciennes adresses fonctionnelles, mais les envoyer vers les vitrines partenaires propres.
- Ne modifier aucun produit, prix, stock, image ou statut de publication.

## Integration locale
- `next.config.ts`
  - Ajout du redirect permanent `/dropshipping` vers `/produits-partenaires`.
  - Ajout du redirect permanent `/conditions-dropshipping` vers `/conditions-produits-partenaires`.
  - Les redirects sont appliques avant le filesystem Next.js.
- `src/app/dropshipping/page.tsx`
  - Remplacement de l'ancienne page publique par un alias serveur simple vers `/produits-partenaires`.
  - Ce fallback garde la route propre si le rendu de page est atteint hors configuration.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-353-ancienne-route-dropshipping-20260618/next.config.ts.bak`
- `business-maxi-trouvailles/backups/couche-353-ancienne-route-dropshipping-20260618/dropshipping-page.tsx.bak`

## Verification
- `npx eslint next.config.ts src/app/dropshipping/page.tsx --no-warn-ignored` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-generated-artifact-leaks` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK, 49 pages generees.

## Verification HTTP locale
- Serveur local temporaire sur `localhost:3277`, coupe apres controle.
- `curl -I http://localhost:3277/dropshipping`
  - `HTTP/1.1 308 Permanent Redirect`
  - `location: /produits-partenaires`
- `curl -I http://localhost:3277/conditions-dropshipping`
  - `HTTP/1.1 308 Permanent Redirect`
  - `location: /conditions-produits-partenaires`

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock, image ou donnees commande.
- Les anciennes URLs restent supportees sans exposer une page publique supplementaire.
