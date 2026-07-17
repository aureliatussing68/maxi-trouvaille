# Rapport Maxi Trouvaille - Couche 091 - Focus dropshipping public

Date: 2026-06-11
Statut: GO local, HOLD publication produits

## Objectif

Basculer le site public Maxi Trouvaille en focus dropshipping uniquement, sans supprimer le travail existant, et eviter que les produits personnels ou les fiches avec images non prouvees restent visibles cote client.

## Sauvegarde

Sauvegarde locale avant modifications:

- `backups/couche-091-focus-dropshipping-public-20260611_0515`

## Changements appliques

- Mode public force sur le dropshipping dans `src/lib/catalog.ts`.
- Categories publiques limitees aux rayons dropshipping: Produits partenaires, Nouveautes, Promotions, Maison, Cuisine, Beaute, High-tech, Accessoires, Auto / Moto, Animaux, Enfant, Mode.
- Produits publics limites aux produits `dropshipping.enabled === true`.
- Comme les 37 produits partenaires sont encore en HOLD/brouillon, la boutique affiche un etat de validation au lieu de vendre des fiches non prouvees.
- Navigation, accueil, boutique, categories, page produits partenaires, footer, barre de confiance, manifeste et SEO alignes avec le focus dropshipping.
- Les anciens produits personnels restent dans les donnees mais ne ressortent plus en boutique publique.
- Protection ajoutee sur les fiches produit directes: un produit suspendu n'apparait plus via son URL publique normale.
- Apercu admin conserve avec `?adminPreview=1` quand `ADMIN_MODE=true`.
- Qualite image categorie ramenee a `quality={75}` pour supprimer les warnings Next.js 16.
- Automation 5 minutes recentree sur le chantier dropshipping strict.

## Fichiers principaux touches

- `src/lib/catalog.ts`
- `src/components/CategoryGrid.tsx`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/TrustBar.tsx`
- `src/components/HeroCarousel.tsx`
- `src/components/ShopProductExplorer.tsx`
- `src/components/ProductEditForm.tsx`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/loading.tsx`
- `src/app/page.tsx`
- `src/app/boutique/page.tsx`
- `src/app/categories/page.tsx`
- `src/app/categories/[slug]/page.tsx`
- `src/app/produits-partenaires/page.tsx`
- `src/app/produit/[slug]/page.tsx`
- `src/app/admin/produits/[slug]/modifier/page.tsx`

## Validations executees

- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK, 49 routes generees
- `npm run catalog:test-checkout-guards`: OK, 11/11
- `npm run catalog:audit-all-partner-gates`: OK, 37 produits partenaires, 0 publie, 37 HOLD/brouillon
- `npm run catalog:hold-public-unverified-images`: OK, aucun nouveau produit public a bloquer
- Verification navigateur Edge/Playwright:
  - accueil desktop: OK
  - boutique mobile: OK
  - categories mobile: OK
  - produits partenaires desktop: OK
  - URL produit suspendue publique: affiche `Page introuvable`, sans le produit
  - 0 warning console final
  - 0 fuite AliExpress/Alibaba/Temu visible cote client
  - 0 ancien produit personnel visible
  - 0 lien produit public tant que le dropshipping reste HOLD
  - 0 debordement horizontal mobile

## Limites notees

- Le serveur dev Next.js affiche `Page introuvable` pour une fiche suspendue, mais le statut HTTP observe reste 200 en local a cause du streaming/dev server. Le contenu client est bien neutralise et le produit n'est plus expose.
- Aucun produit dropshipping n'a ete publie: c'est volontaire tant que fournisseur exact, SKU, stock, delai, prix reel et images exactes ne sont pas valides humainement.
- Aucun paiement, aucune commande fournisseur, aucun compte externe, aucune API payante et aucun deploiement n'ont ete executes.

## Prochaine couche recommandee

Travailler la file produits dropshipping en mode qualite: selectionner 5 a 10 produits prioritaires, remplir preuves fournisseur, SKU, prix, stock, delai France/Europe et images exactes, puis ne publier que les fiches qui passent toutes les gates.
