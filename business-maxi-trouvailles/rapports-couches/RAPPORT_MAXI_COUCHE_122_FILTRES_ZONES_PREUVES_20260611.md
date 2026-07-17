# Maxi Trouvailles - Couche 122 - Filtres zones de preuves

Date locale: 2026-06-11 12:57 +02:00

## Objectif

Accelerer le travail terrain sur les fiches dropshipping HOLD en filtrant l'atelier `Preuves partenaires` par type de preuve manquante: image, fournisseur, marge, livraison ou validation Mouss.

## Changements

- `src/app/admin/preuves-partenaires/page.tsx`
  - Ajout du parametre URL `zone`.
  - Ajout des options `Images / droits`, `Fournisseur / SKU`, `Prix / stock / marge`, `Livraison / suivi`, `Validation Mouss`.
  - Application du filtre zone aux actions, fiches rapides, audits, ancres HOLD, exports CSV, top verification et lot terrain.
  - Ajout des boutons `Filtres rapides preuves` qui conservent la recherche et le statut actifs.
  - Correction de remount des selects sur navigation client via les boutons rapides.

- `scripts/automation/audit_admin_publication_ui_guard.mjs`
  - L'audit verifie la presence du filtre `zone`, des boutons rapides et du matching par zone de preuve.

- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
  - Memo de chantier mis a jour pour documenter le filtre par zone.

## Produits

- Produit ajoute: aucun.
- Produit modifie: aucun.
- Produit publie: aucun.
- Commande fournisseur: aucune.
- Paiement: aucun.
- Statut catalogue: les produits partenaires restent en brouillon/HOLD.

## Validations

- `node --check scripts/automation/audit_admin_publication_ui_guard.mjs`: OK.
- `npm run catalog:audit-admin-publication-ui-guard`: OK, 11 checks, 0 echec.
- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm run catalog:daily-execution-board`: OK, 42 actions, 37 partenaires HOLD, 0 publie.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 dropshipping visible, 37 brouillons bloques.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu.
- `npm run build`: OK.
- Navigateur Edge local `http://127.0.0.1:3043/admin/preuves-partenaires?status=hold&zone=image`: OK.
  - Boutons rapides visibles.
  - Select `zone` synchronise sur `image`, `margin` et `delivery`.
  - Liens rapides conservent `status=hold`.
  - CSV filtre avec nom `maxi-preuves-partenaires-hold-image-toutes.csv`.
  - Pas d'erreur console.
  - Pas de debordement horizontal desktop/mobile.
- `git diff --check`: OK.
- Scan sensible: OK, uniquement la phrase de garde-fou deja connue dans la note d'automatisation.

## Preuves

- Capture desktop: `business-maxi-trouvailles/rapports-couches/couche-122-filtres-zones-preuves-desktop.png`
- Capture mobile: `business-maxi-trouvailles/rapports-couches/couche-122-filtres-zones-preuves-mobile.png`
- Controle navigateur: `business-maxi-trouvailles/rapports-couches/couche-122-browser-check.json`

## Statut

HOLD strict conserve. Cette couche ameliore uniquement la vitesse de tri des preuves manquantes; aucune fiche n'est rendue vendable.

## Prochain pas recommande

Ajouter un compteur par bouton rapide pour savoir combien de fiches sont concernees par `Images`, `Marge`, `Livraison`, etc. avant meme de cliquer.
