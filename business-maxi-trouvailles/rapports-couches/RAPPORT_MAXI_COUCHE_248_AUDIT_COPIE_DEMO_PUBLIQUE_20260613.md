# Rapport couche 248 - Audit copie demo publique

Date locale: 2026-06-13 11:07 Europe/Paris

## Objectif

Ajouter un garde durable pour la demonstration 20h: empecher la reintroduction de mots client trop internes ou risqués dans les textes publics.

## Changements integres localement

- `scripts/automation/audit_public_demo_copy.mjs`: nouvel audit lecture seule des textes publics.
- `package.json`: ajout de la commande `catalog:audit-public-demo-copy`.
- `src/app/boutique/page.tsx`: en-tete boutique renforcé avec mention directe du paiement Maxi Trouvaille et du suivi colis.

## Ce que controle l'audit

- Bloque les textes publics contenant `fournisseur`, `AliExpress`, `supplier`, `seller`, `marketplace`, `API Mondial`, `sans API`.
- Bloque le jargon client `HOLD`, `dropshipping` et les formulations anxiogenes du type fiche fragile/douteuse dans les zones de copie rendue.
- Verifie que les pages demo principales restent centrees sur produits partenaires et paiement Maxi Trouvaille.
- Ignore les identifiants techniques/URLs legacy quand ils ne sont pas du texte client.

## Tests

- `npm run catalog:audit-public-demo-copy`: OK, 24 fichiers surveilles, 0 alerte
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm run build`: OK
- `npm run catalog:audit-public-catalog-source-guards`: OK
- `npm run catalog:audit-public-visual-ambiguity`: OK
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible, 0 achetable, 91 brouillons bloques
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit attendu achetable

## Garde-fous

Aucun paiement, aucune commande fournisseur, aucun achat, aucun message reel, aucune API payante, aucune publication produit et aucun deploiement production dans cette couche.
