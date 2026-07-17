# Rapport Maxi - Couche 042 - Brouillons directs

Date: 2026-06-09

## Objectif

Mettre en place une couche lourde mais sure pour preparer beaucoup de produits en brouillon, sans injecter de fiches approximatives dans le catalogue public.

## Ce qui a ete fait

- Ajout du script `scripts/automation/prepare_partner_draft_backlog.mjs`.
- Ajout de la commande `npm run catalog:prepare-draft-backlog`.
- Mise a jour du runbook `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`.
- Generation d'une file de 100 brouillons candidats depuis la selection rapatriee.
- Creation d'un lot prioritaire de 30 produits a verifier en premier.
- Detection de 10 doublons probables, mis en revue au lieu de remonter dans le lot immediat.

## Fichiers produits

- `business-maxi-trouvailles/produits-a-valider/brouillons-directs/backlog_brouillons_directs_20260609.json`
- `business-maxi-trouvailles/produits-a-valider/brouillons-directs/backlog_brouillons_directs_20260609.md`
- `business-maxi-trouvailles/produits-a-valider/brouillons-directs/evidence_template_brouillons_directs_20260609.json`

## Statut catalogue

- Ecriture dans `data/quick-products.json`: non.
- Publication produit: non.
- Commande fournisseur: non.
- Paiement fournisseur: non.
- Produits partenaires actuels: 33.
- Produits partenaires publics: 0.
- Produits partenaires en `draft`/HOLD: 33.

## Pourquoi ce blocage est volontaire

Mouss a demande des photos identiques au produit vendu. La couche prepare donc les brouillons, mais bloque l'integration catalogue tant que ces preuves ne sont pas remplies:

- URL produit fournisseur exacte;
- variante exacte;
- images exactes de la variante;
- prix fournisseur reel;
- stock fournisseur;
- delai France/Europe;
- preuve d'utilisation propre des images;
- validation humaine.

## Tests executes

- `npm run catalog:prepare-draft-backlog`: OK, 100 candidats, 30 prioritaires.
- `node --check scripts/automation/prepare_partner_draft_backlog.mjs`: OK.
- `npm run catalog:audit-images`: OK, 33 produits, 0 echec.
- `npm run catalog:audit-partner-gates`: OK, 33 brouillons HOLD, 0 produit publie.
- `npm run catalog:verification-queue`: OK, 0 produit pret a publier.
- `npm run catalog:partner-summary`: OK, 33 produits partenaires en `draft`.
- `npm run catalog:audit-partners`: OK.
- Scan secrets sur les nouveaux fichiers: OK, aucun motif sensible detecte.

## Prochaine couche conseillee

Traiter le lot prioritaire de 30 produits:

1. ouvrir les liens fournisseur;
2. verifier livraison rapide France/Europe;
3. recuperer uniquement les images exactes de la bonne variante;
4. remplir `evidence_template_brouillons_directs_20260609.json`;
5. importer seulement les fiches completes en `draft`/HOLD.
