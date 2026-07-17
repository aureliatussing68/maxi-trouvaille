# Rapport Maxi - Couche 043 - Import preuves vers brouillons

Date: 2026-06-09

## Objectif

Ajouter le maillon entre le backlog de produits candidats et l'integration directe dans Maxi Trouvaille: un importeur strict qui refuse toute fiche sans preuves completes.

## Ce qui a ete fait

- Ajout du script `scripts/automation/import_partner_drafts_from_evidence.mjs`.
- Ajout de la commande `npm run catalog:import-evidence-drafts`.
- Mise a jour du runbook `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`.
- Dry-run sur le template de 30 produits prioritaires cree en couche 042.

## Comportement de securite

- Mode par defaut: dry-run, aucune ecriture catalogue.
- Mode `--apply`: cree une sauvegarde de `data/quick-products.json` avant toute ecriture.
- Import uniquement en `draft`/HOLD.
- Refuse un produit si une preuve manque: URL exacte, variante, images exactes, fournisseur, SKU, prix, stock, delai France/Europe, preuve livraison, droits images.
- Refuse les doublons probables deja presents dans le catalogue.
- Ne publie jamais, ne commande jamais, ne paie jamais.

## Resultat du dry-run

- Entrees analysees: 30.
- Pretes a importer: 0.
- Bloquees: 30.
- Produits importes: 0.

Blocage attendu: le template de preuves est encore vide, donc l'importeur refuse toutes les fiches.

## Fichiers generes

- `business-maxi-trouvailles/produits-a-valider/brouillons-directs/import_evidence_dry_run_20260609.json`
- `business-maxi-trouvailles/produits-a-valider/brouillons-directs/import_evidence_dry_run_20260609.md`

## Tests executes

- `node --check scripts/automation/import_partner_drafts_from_evidence.mjs`: OK.
- `npm run catalog:import-evidence-drafts`: OK, dry-run, 0 import.
- `npm run catalog:audit-partners`: OK, 33 produits partenaires, 0 echec image/gate.
- `npm run catalog:partner-summary`: OK, 33 produits partenaires en `draft`.
- `npm run catalog:verification-queue`: OK, 0 produit pret a publier.
- Scan secrets sur les nouveaux fichiers: OK, aucun motif sensible detecte.

## Prochaine couche conseillee

Collecter les preuves exactes pour 3 a 5 produits du lot prioritaire, puis relancer:

```powershell
npm run catalog:import-evidence-drafts
```

Quand le dry-run indique des produits prets, utiliser seulement alors:

```powershell
node scripts/automation/import_partner_drafts_from_evidence.mjs --apply
```

Les produits seront ajoutes en brouillon/HOLD, pas en publication.
