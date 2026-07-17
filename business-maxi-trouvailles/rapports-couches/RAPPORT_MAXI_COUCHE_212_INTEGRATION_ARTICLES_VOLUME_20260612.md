# Rapport couche 212 - Integration articles volume HOLD

Date locale: 2026-06-12 Europe/Paris

## Objectif

Faire avancer la branche integration articles en ajoutant de la matiere catalogue dropshipping exploitable, sans publication et sans preuve inventee.

## Couche appliquee

- Ajout de 12 nouvelles idees produits dans `integrate_dropshipping_article_candidates.mjs`.
- Application locale dans `data/quick-products.json`: 12 fiches ajoutees, total quick-products passe de 81 a 93.
- Total candidats `HOLD_INTEGRATION_ARTICLES`: 36.
- Tous les nouveaux produits sont en `draft`, stock catalogue `0`, fournisseur/SKU/prix fournisseur/stock fournisseur vides, image de categorie temporaire, `imageValidation` en HOLD et `sourceVerification` en HOLD.
- Backup automatique cree avant ecriture catalogue: `backups/quick-products-before-integration-articles-20260612-101424/quick-products.json.bak`.

## Produits ajoutes

- Porte savon drainant silicone.
- Brosse bouteille flexible.
- Organisateur sac a main feutre.
- Pelle litiere chat avec support.
- Coussinets meubles anti rayures lot.
- Range epices adhesif cuisine.
- Support tablette lit canape.
- Trousse toilette suspendue voyage.
- Bouchons evier silicone lot.
- Organisateur telecommande canape.
- Sangle valise ajustable voyage.
- Peigne demelage animaux double face.

## Garde-fous

- Aucune publication.
- Aucun paiement, achat, commande fournisseur, deploiement ou message reel.
- Aucun telechargement ou generation d'image.
- Aucun lien fournisseur ni image distante ajoutee dans les fiches.
- Les 12 fiches restent HOLD tant que fournisseur exact, SKU, prix reel, stock, delai France/Europe, droits image, WebP exacts et validation Mouss ne sont pas prouves.

## Validations

- `node --check scripts/automation/integrate_dropshipping_article_candidates.mjs`: OK.
- `npm run catalog:integrate-article-candidates`: OK, dry-run 36 candidats, 12 a ajouter.
- `npm run catalog:apply-article-candidates`: OK, 12 ajouts en draft/HOLD.
- `npm run catalog:audit-integration-articles`: OK, 36 candidats, 0 echec.
- `npm run catalog:integration-sourcing-packets`: OK, 5 packets terrain prioritaires.
- `npm run catalog:audit-integration-sourcing-packets`: OK, HOLD preuves manquantes, 15 WebP attendus, 0 valide.
- `npm run catalog:integration-execution-board`: OK, 36 candidats, 5 packets, 15 WebP attendus.
- `npm run catalog:integration-sourcing-session`: OK, 5 produits, 55 champs de preuve, 15 images attendues.
- `npm run catalog:audit-integration-sourcing-session`: OK, session synchronisee.
- `npm run catalog:integration-next-proofs-workpack`: OK, 5 preuves suivantes a remplir.
- `npm run catalog:audit-integration-next-proofs-workpack`: OK, HOLD, 35 blocages business attendus.
- `npm run catalog:audit-all-partner-gates`: OK, 73 partenaires, 0 publie, 73 draft/HOLD.
- `npm run catalog:audit-checkout-eligibility`: OK, 0 produit achetable.
- `npm run catalog:audit-public-dropshipping-surface`: OK, 0 produit visible/achetable.
- `npm run catalog:audit-seo-hold-visibility`: OK, 103 produits non indexables cote HOLD.
- `npm run catalog:audit-generated-artifact-leaks`: OK, 63 dossiers, 304 fichiers, 0 fuite.
- `npm run catalog:daily-execution-board`: OK.
- `npm run catalog:audit-daily-execution-board`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm run build`: OK.

## Prochaine couche conseillee

Prioriser les 5 packets sourcing integration: remplir seulement des preuves terrain reelles, deposer les 15 WebP exacts attendus, puis relancer les audits avant toute revue Mouss. Les 36 candidats integration restent en HOLD.
