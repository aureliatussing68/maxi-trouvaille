# Maxi Trouvaille

Boutique e-commerce Next.js pour vendre des colis perdus, lots, bonnes affaires
et produits multi-categories. Le site est prepare pour demarrer en boutique
classique, puis evoluer plus tard vers une marketplace avec vendeurs externes.

## Stack choisie

- Next.js App Router + TypeScript
- Tailwind CSS
- Panier local persistant avec React Context
- Stripe Checkout cote serveur, en mode test uniquement
- Catalogue modifiable dans `src/lib/catalog.ts`
- Preparation marketplace dans `src/lib/marketplace.ts`
- PWA installable depuis le navigateur avec manifest, icones et service worker

## Lancer le site en local

```bash
npm install
npm run dev
```

Ouvrir ensuite :

```text
http://localhost:3000
```

## Configurer Stripe test

Creer un fichier `.env.local` a partir de `.env.example` :

```bash
copy .env.example .env.local
```

Puis remplacer les valeurs par vos cles Stripe de test :

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
ADMIN_MODE=true
```

Le code refuse volontairement les cles `sk_live_` pour eviter tout paiement reel
pendant cette phase.

Pour cacher les boutons d'administration et bloquer les routes d'edition rapide,
passer `ADMIN_MODE=false`, puis redemarrer le serveur local.

## Commandes utiles

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Preparation production

Le fichier `.env.production.example` liste les variables a creer chez
l'hebergeur. Le domaine cible est `https://maxitrouvaille.fr`.

La procedure domaine/DNS est documentee dans `docs/deploiement-domaine.md`.

## Tester la PWA

En local, ouvrir `http://localhost:3000` ou `http://127.0.0.1:3000` dans un
navigateur compatible, puis utiliser l'option du navigateur pour ajouter le site
a l'ecran d'accueil. La configuration mobile est decrite dans
`docs/pwa-mobile-roadmap.md`.

## Modifier les produits

Ajouter ou modifier les produits dans :

```text
src/lib/catalog.ts
```

Chaque produit contient un champ `source` :

- `internal` : produit vendu directement par Maxi Trouvaille
- `seller_listing` : future annonce vendeur marketplace

Les annonces vendeurs ne sont pas payables pour le moment. Elles sont prevues
dans le modele, mais le flux marketplace complet sera developpe plus tard.
