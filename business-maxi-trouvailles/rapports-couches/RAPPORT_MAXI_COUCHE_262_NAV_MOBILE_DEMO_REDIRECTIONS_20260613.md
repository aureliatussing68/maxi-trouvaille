# Rapport couche 262 - Navigation mobile demo et redirections propres

Date locale: 2026-06-13 13:36 Europe/Paris

## Objectif

Rendre la navigation de demonstration plus directe sur telephone, avec acces rapide a la boutique, aux produits partenaires, aux nouveautes, aux promotions, au paiement, au suivi colis et au contact.

## Changements integres

- Header: ajout du lien `Paiement` dans la navigation desktop et mobile.
- Page categories: texte public lisse pour parler de publication et de visuels exacts, sans formule "mise en vente" ni fiche ouverte.
- Routes legacy `/dropshipping` et `/conditions-dropshipping`: verification qu'elles redirigent vers `/produits-partenaires` et `/conditions-produits-partenaires`.

## Garde-fous confirmes

- Aucun produit publie.
- Aucun paiement active.
- Aucun achat fournisseur.
- Aucun deploiement.
- Aucune suppression definitive.
- Les anciennes routes dropshipping ne s'affichent pas au client: elles redirigent vers le vocabulaire produits partenaires.

## Verifications

- Scan public formulations sensibles: OK, 0 match.
- Scan public fuite fournisseur/AliExpress hors composants admin: OK, 0 match.
- `npm run catalog:audit-public-demo-copy`: OK, 0 finding.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible/achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur mobile 390x844:
  - Menu ouvert: `Accueil`, `Partenaires`, `Nouveautes`, `Promos`, `Boutique`, `Paiement`, `Suivi`, `Contact` visibles.
  - `/categories`: aucun overflow, aucune image cassee, aucun texte interdit.
  - `/dropshipping`: redirection confirmee vers `/produits-partenaires`.
  - `/conditions-dropshipping`: redirection confirmee vers `/conditions-produits-partenaires`.
  - Console navigateur: 0 erreur.

## Notes

Cette couche ameliore surtout le moment ou Mouss montre le site sur telephone: les raccourcis essentiels sont immediats et les anciennes entrees dropshipping ne polluent pas la demonstration.
