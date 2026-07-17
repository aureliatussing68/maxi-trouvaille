# Rapport couche 263 - Redirections anti ancien positionnement

Date locale: 2026-06-13 13:40 Europe/Paris

## Objectif

Eviter qu'un visiteur tombe sur les anciennes categories colis/palettes pendant la demonstration mobile. La surface publique doit rester centree produits partenaires, nouveautes, promotions, paiement Maxi Trouvaille, suivi colis et service client.

## Changements integres

- Ajout de redirections legacy:
  - `/categories/colis-surprise-palettes` -> `/categories/produits-partenaires`
  - `/categories/palettes-destockage` -> `/categories/promotions-partenaires`
  - `/categories/colis-mysteres` -> `/categories/nouveautes-partenaires`
  - `/categories/colis-au-poids` -> `/categories/promotions-partenaires`
  - `/categories/lots-bonnes-affaires` -> `/categories/promotions-partenaires`
  - `/categories/colis-surprise` -> `/categories/nouveautes-partenaires`
- `robots.txt`: blocage des anciennes URLs de categories colis/palettes.
- Page categorie vide: phrase image rendue plus positive, avec publication uniquement apres photo exacte validee.

## Garde-fous confirmes

- Aucun produit publie.
- Aucun paiement active.
- Aucun achat fournisseur.
- Aucun deploiement.
- Aucun message envoye.
- Anciennes routes colis/palettes non visibles comme pages publiques autonomes.

## Verifications

- `npm run catalog:audit-public-demo-copy`: OK, 0 finding.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible/achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-public-visual-ambiguity`: OK, 0 failure.
- `npm run catalog:audit-seo-hold-visibility`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.
- Verification navigateur mobile 390x844:
  - anciennes URLs colis/palettes redirigees vers produits partenaires, nouveautes ou promotions;
  - aucun texte visible colis/palettes, fournisseur, AliExpress, hors vente, avant vente ou mise en vente;
  - aucun overflow horizontal;
  - aucune image cassee;
  - console navigateur: 0 erreur.

## Notes

Cette couche reduit le risque de confusion si Mouss ou un invite ouvre une ancienne URL. La boutique garde un discours unique: produits partenaires valides, publication prudente, paiement Maxi Trouvaille et suivi colis.
