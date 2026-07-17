# Rapport Maxi couche 351 - Vitrines nouveautes et promotions

## Objectif
- Transformer `/nouveautes` et `/promotions` en vraies vitrines publiques mobiles.
- Garder une presentation coherente avec les parcours deja poses sur accueil, boutique, rayons et produits partenaires.
- Ne publier aucun produit incomplet et ne rendre aucun article douteux achetable.

## Integration locale
- `src/components/PartnerCampaignLanding.tsx`
  - Nouveau composant serveur commun pour les vitrines nouveautes/promotions.
  - Affiche une page publique avec statut mobile, parcours express, paiement Maxi Trouvaille, suivi colis, rayon prioritaire et selection validee si disponible.
- `src/app/nouveautes/page.tsx`
  - Remplacement de la redirection par une page statique `Nouveautes produits partenaires`.
- `src/app/promotions/page.tsx`
  - Remplacement de la redirection par une page statique `Promotions produits partenaires`.
- `next.config.ts`
  - Retrait uniquement des redirects permanents `/nouveautes` et `/promotions` afin que les pages publiques soient accessibles.
  - Les autres alias publics restent inchanges.
- `scripts/automation/audit_public_demo_copy.mjs`
  - Ajout du nouveau composant public dans la liste auditee.

## Sauvegarde
- `business-maxi-trouvailles/backups/couche-351-vitrines-nouveautes-promotions-20260618/nouveautes-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-351-vitrines-nouveautes-promotions-20260618/promotions-page.tsx.bak`
- `business-maxi-trouvailles/backups/couche-351-vitrines-nouveautes-promotions-20260618/next.config.ts.bak`

## Verification
- `npx eslint next.config.ts src/app/nouveautes/page.tsx src/app/promotions/page.tsx src/components/PartnerCampaignLanding.tsx scripts/automation/audit_public_demo_copy.mjs --no-warn-ignored` OK.
- `npm run catalog:audit-public-demo-copy` OK.
- `npm run catalog:audit-public-catalog-source-guards` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK.
- `npm run catalog:audit-checkout-eligibility` OK.
- `npm run catalog:audit-seo-hold-visibility` OK.
- `npm run catalog:audit-public-visual-ambiguity` OK.
- `npm run catalog:audit-generated-artifact-leaks` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK.
- Verification HTTP directe sans cache navigateur:
  - `http://127.0.0.1:3275/nouveautes` retourne 200 avec titre `Nouveautes produits partenaires | Maxi Trouvaille`;
  - `http://127.0.0.1:3275/promotions` retourne 200 avec titre `Promotions produits partenaires | Maxi Trouvaille`.
- Verification navigateur mobile 390x844 sur `http://localhost:3275` OK:
  - `/nouveautes` reste sur `/nouveautes`;
  - `/promotions` reste sur `/promotions`;
  - textes attendus visibles: vitrine mobile, parcours express mobile, paiement Maxi Trouvaille, suivi colis;
  - aucune fuite visible: AliExpress, Temu, supplier, seller, marketplace, fournisseur, dropshipping, HOLD, fiche douteuse, fiche fragile;
  - aucun debordement horizontal;
  - aucun controle principal sous 34 px de hauteur;
  - aucune erreur console pertinente.
- Captures:
  - `business-maxi-trouvailles/rapports-couches/couche-351-nouveautes-mobile.png`
  - `business-maxi-trouvailles/rapports-couches/couche-351-promotions-mobile.png`

## Note de cache
- Le navigateur avait garde l'ancien redirect permanent en cache sur `127.0.0.1`.
- La verification HTTP directe et le test mobile via `localhost` confirment que le serveur sert bien les nouvelles pages.

## Garde-fous
- Aucun achat, paiement, commande fournisseur, connexion compte, message reel, suppression definitive, video pub, API payante, publication production ou deploiement.
- Aucun changement catalogue, prix, stock ou image produit.
- Aucune exposition client de source fournisseur.
- Serveur temporaire local coupe apres verification.

## Prochain pas conseille
- Renforcer ensuite le maillage interne du header/footer vers ces pages si Mouss veut les montrer directement, sans reintroduire de redirection.
