# Rapport couche 268 - Catalogue HOLD et runway demo

Date locale: 2026-06-13 14:13 Europe/Paris

## Objectif

Continuer en grosse couche cote catalogue, sans publier ni rendre achetable de fiche douteuse: regrouper les brouillons integration, le top 3 prioritaire, le lot actif et les lots suivants dans des packs terrain audites.

## Changements integres

- Integration articles:
  - lot du jour regenere en lecture seule;
  - 54 candidats deja presents, 0 ajout force dans `data/quick-products.json`.
- Audit HOLD:
  - 54 candidats integration controles;
  - 54 prets pour sourcing manuel;
  - 0 echec garde-fou.
- Packs terrain top 10:
  - 10 packets sourcing;
  - 110 champs de preuves a remplir;
  - 30 WebP exacts attendus;
  - execution board, session terrain et priority board regeneres.
- Top 3 prioritaire:
  - 3 produits isoles;
  - 15 preuves critiques;
  - 9 WebP exacts attendus;
  - business gate bloque volontairement en HOLD avec 24 bloqueurs.
- Prochaine vague:
  - 12 produits en 3 lots;
  - lot actif `lot-01`: 4 produits, 20 preuves, 12 WebP, 32 entrees terrain;
  - lots suivants: 8 produits, 40 preuves, 24 WebP, 64 entrees terrain;
  - packs de saisie, preuves internes, depots WebP, contrats WebP et board revue Mouss regeneres.

## Produits les mieux scores pour sourcing manuel

- Housse protection canape animal: score 92, prix cible 24.90 EUR, marge cible 13.70 EUR.
- Cache multiprise boite rangement cables: score 91, prix cible 18.90 EUR, marge cible 11.30 EUR.
- Trousse toilette suspendue voyage: score 91, prix cible 17.90 EUR, marge cible 11.70 EUR.
- Etagere douche angle adhesive: score 90, prix cible 19.90 EUR, marge cible 12.30 EUR.
- Boite a the compartiments bambou: score 89, prix cible 18.90 EUR, marge cible 11.70 EUR.

## Garde-fous confirmes

- Aucun produit publie.
- Aucun produit rendu achetable.
- Aucun paiement active.
- Aucun achat fournisseur.
- Aucun message client envoye.
- Aucun telechargement image.
- Aucun WebP copie en public.
- Aucun deploiement.
- Aucun fournisseur/AliExpress visible client.

## Verifications

- `npm run catalog:integrate-article-candidates`: OK, 54 candidats, 0 ajout, 54 deja presents.
- `npm run catalog:audit-integration-articles`: OK, 54/54 en HOLD sourcing, 0 echec.
- Pipeline sourcing integration top 10 -> top 3 -> prochaine vague: OK.
- `npm run catalog:audit-integration-top3-business-gate`: OK structurel, statut attendu `HOLD_TOP3_BUSINESS_GATE_BLOCKED`, 24 bloqueurs business.
- `npm run catalog:audit-integration-next-wave-active-batch-field-completion-gate`: OK structurel, statut attendu `HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_BLOCKED`, 32 entrees bloquees.
- `npm run catalog:audit-integration-next-wave-pending-batches-field-entry-pack`: OK, 64 entrees lots suivants, 0 echec, 0 fuite sensible.
- `npm run catalog:audit-generated-artifact-leaks`: OK, 340 fichiers scannes, 0 finding.
- `npm run catalog:audit-public-demo-copy`: OK, 0 finding.
- `npm run catalog:audit-public-catalog-source-guards`: OK, 0 finding.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 visible/achetable, 91 brouillons dropshipping bloques.
- `npm run catalog:audit-public-visual-ambiguity`: OK, 0 failure.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable attendu.
- `npm run catalog:audit-seo-hold-visibility`: OK, 121 produits non publics non indexables.
- `npm run catalog:audit-public-image-pipeline-coherence`: OK, 0 echec.

## Notes

Cette couche n'a pas relance build/browser car elle n'a pas modifie les fichiers applicatifs ni la surface publique. Le dernier build/browser mobile complet reste celui de la couche 267. La suite logique est de continuer a integrer visuellement ce qui est deja sur pour la demo, tout en gardant ce pipeline catalogue pret pour remplissage manuel des preuves.
