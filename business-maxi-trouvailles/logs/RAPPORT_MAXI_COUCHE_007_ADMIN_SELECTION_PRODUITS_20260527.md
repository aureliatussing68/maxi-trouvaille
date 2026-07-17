# Rapport Maxi - Couche 007 - Admin selection produits

Date: 2026-05-27

Objectif: rendre la file de 100 produits candidats consultable dans le site admin, sans publication publique.

Fait:
- Nouvelle page admin: /admin/selection-produits
- Lecture du fichier de selection couche 006.
- Affichage par categorie avec 100 cartes candidates.
- Sources de tendance affichees en tete.
- Liens "Recherche fournisseur" prepares pour validation manuelle.
- Lien ajoute depuis /admin/dropshipping vers la selection.

Garde-fous:
- Page verrouillee si ADMIN_MODE n'est pas actif.
- Aucune commande fournisseur.
- Aucune publication publique de produit.
- Aucun secret affiche.

Verification:
- npm run typecheck: OK
- npm run lint: OK
- npm run build: OK
- Verification locale Edge: 100 cartes candidates, 105 liens de recherche/sources, page non verrouillee en local admin.
- Deploiement production Vercel: OK
- Alias live https://maxitrouvaille.fr: OK
- Verification live /admin/selection-produits: page verrouillee car ADMIN_MODE production n'est pas actif, ce qui protege l'outil admin.

Capture:
- business-maxi-trouvailles/logs/screenshots/admin-selection-produits-couche-007-20260527.png
