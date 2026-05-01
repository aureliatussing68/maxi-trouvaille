# Evolution mobile Maxi Trouvaille

## Phase 1 - PWA installable

- Manifest web avec nom, icones, theme, mode standalone et URL de demarrage.
- Icones mobile Android, iOS et maskable dans `public/icons`.
- Service worker leger dans `public/sw.js`.
- Page hors ligne dans `src/app/offline/page.tsx`.
- Ecran de chargement global dans `src/app/loading.tsx`.
- Enregistrement du service worker via `src/components/ServiceWorkerRegister.tsx`.

Le service worker ne met pas en cache les routes `/api` afin de garder l'ajout
rapide, le stock et Stripe en temps reel.

## Phase 2 - PWA avancee

- Ajouter une invite installee personnalisee quand le navigateur expose
  `beforeinstallprompt`.
- Ajouter un mode hors ligne plus riche pour les pages catalogue deja vues.
- Preparer les notifications push pour les commandes et les annonces vendeurs.
- Auditer Lighthouse mobile avant mise en production.

## Phase 3 - Application Android/iOS

- Utiliser la PWA comme socle produit.
- Evaluer Capacitor si l'objectif est d'encapsuler le site existant.
- Evaluer React Native seulement si les besoins deviennent vraiment natifs
  (scanner code-barres, notifications poussees avancees, camera, geolocalisation).
- Garder les modeles `internal`, `seller_listing` et les roles
  `admin`, `seller`, `customer` comme contrat commun web et mobile.
