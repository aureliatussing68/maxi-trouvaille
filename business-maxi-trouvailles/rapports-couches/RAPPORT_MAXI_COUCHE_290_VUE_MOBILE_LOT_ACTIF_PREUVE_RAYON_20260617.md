# Rapport Maxi couche 290 - Vue mobile lot actif preuve/rayon

## Objectif

Rendre la file active preuve/rayon plus exploitable sur telephone dans l'admin dropshipping, sans publier ni deverrouiller de produit HOLD.

## Integration locale

- Ajout d'une vue compacte mobile dans le panneau "File active" apres selection d'un couple preuve/rayon.
- La vue affiche le lot actif, le nombre de brouillons, les brouillons prets apres preuve, les blocages restants, le premier brouillon a reprendre, son score, son statut HOLD et les prochaines preuves a traiter.
- Ajout d'un lien direct "Reprendre ce brouillon" vers la fiche admin du premier brouillon du lot actif.
- Ajout d'un rappel visible: les coches locales ne publient rien et ne remplacent pas les preuves exactes.

## Garde-fous

- Aucun produit HOLD n'est rendu vendable.
- Aucune commande fournisseur, aucun paiement, aucun achat, aucune connexion compte, aucun deploiement et aucune publication production.
- Aucune exposition client de source fournisseur, AliExpress, Temu ou supplier.

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
- Verification navigateur mobile sur `http://127.0.0.1:3115/admin/dropshipping` OK: vue mobile lot actif visible, lien de reprise present, checklist execution conservee, 3 cartes file visibles, 1 badge actif, aucune erreur console, aucun debordement horizontal.

## Capture

- `tmp-next-couche-290-mobile.png`

## Suite conseillee

Ajouter une ancre ou un auto-scroll doux vers la vue mobile du lot actif apres selection d'une carte, pour accelerer encore la reprise sur telephone.
