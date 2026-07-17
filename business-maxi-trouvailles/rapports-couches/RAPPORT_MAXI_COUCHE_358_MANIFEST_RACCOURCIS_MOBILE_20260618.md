# Rapport Maxi couche 358 - Manifest raccourcis mobile

## Objectif
- Aligner l'application mobile/PWA avec la navigation publique deja validee.
- Rendre les raccourcis installes coherents avec la demo telephone: Boutique, Partenaires, Nouveautes, Promotions, Suivi colis.
- Eviter tout raccourci direct vers panier, paiement, admin, API ou anciennes routes sensibles.

## Integration locale
- `src/app/manifest.ts`
  - Ajout du raccourci `Boutique` vers `/boutique`.
  - Conservation du raccourci `Produits partenaires` vers `/produits-partenaires`.
  - Ajout du raccourci `Nouveautes` vers `/nouveautes`.
  - Ajout du raccourci `Promotions` vers `/promotions`.
  - Conservation du raccourci `Suivi colis` vers `/suivi-colis`.
- `scripts/automation/audit_mobile_manifest_shortcuts.mjs`
  - Nouvel audit lecture seule du manifest mobile.
  - Controle des 5 raccourcis publics requis.
  - Blocage des URLs sensibles en raccourci PWA: admin, API, panier, paiement, anciennes routes dropshipping/programme.
  - Controle des mots sensibles cote client dans le manifest.
  - Sorties JSON, Markdown et CSV dans `business-maxi-trouvailles/tableaux-action/audit-manifest-mobile-20260618/`.
- `package.json`
  - Ajout de `catalog:audit-mobile-manifest`.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-358-manifest-raccourcis-mobile-20260618/manifest.ts.bak`
- `business-maxi-trouvailles/backups/couche-358-manifest-raccourcis-mobile-20260618/package.json.bak`

## Verification
- `npx eslint src/app/manifest.ts scripts/automation/audit_mobile_manifest_shortcuts.mjs --no-warn-ignored` OK.
- `npm run catalog:audit-mobile-manifest` OK: 5 raccourcis requis, 5 URLs detectees, 0 alerte.
- `npm run catalog:audit-public-demo-copy` OK: 55 fichiers surveilles, 0 alerte.
- `npm run catalog:audit-public-route-aliases` OK: 15 alias detectes, 0 alerte.
- `npm run catalog:audit-public-catalog-source-guards` OK: 19 composants publics, 10 routes publiques, 0 alerte.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit partenaire visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu, 0 echec.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics, 0 echec SEO/HOLD.
- `npm run catalog:audit-generated-artifact-leaks` OK: 14 fichiers scannes, 0 fuite sensible.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK, 49 pages generees.

## Verification HTTP locale
- Serveur local temporaire `next start` sur `127.0.0.1:3281`, coupe apres controle; port 3281 libere.
- `GET /manifest.webmanifest` OK.
- Raccourcis presents:
  - `/boutique`
  - `/produits-partenaires`
  - `/nouveautes`
  - `/promotions`
  - `/suivi-colis`
- Aucun raccourci interdit detecte vers admin, API, panier, paiement ou anciennes routes.
- `display: standalone` et `orientation: portrait-primary` confirmes.

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock, image ou donnees commande.
- Le manifest reste centre sur produits partenaires, paiement Maxi Trouvaille, suivi colis et service client sans exposer de source externe.
