# Rapport Maxi couche 226 - Volume integration articles HOLD

Date locale: 2026-06-12 12:12 Europe/Paris

## Objectif

Augmenter le volume de brouillons dropshipping exploitables sans creer de mauvaise fiche produit: ajout uniquement en `draft`/HOLD, sans fournisseur exact, sans SKU, sans image exacte et sans publication.

## Couche livree

- 18 nouveaux candidats integration articles ajoutes dans `data/quick-products.json`.
- Total catalogue rapide: 93 -> 111 produits.
- Total candidats integration: 54.
- Audit integration: 54/54 prets pour sourcing manuel HOLD, 0 echec garde-fou.
- Packets sourcing regeneres: 10 produits, 110 champs de preuve, 30 WebP attendus.
- Top 3 regenere et toujours bloque: 15 preuves manquantes, 9 images manquantes, 24 blocages business.

## Nouveaux candidats

- Boite a the compartiments bambou
- Porte cles mural adhesif
- Tapis repas chat silicone
- Support casque bureau adhesif
- Organisateur frigo transparent
- Brosse ventilation voiture
- Pochette cable voyage electronique
- Support ordinateur portable pliable
- Mini balai table ramasse miettes
- Boite rangement medicaments vide
- Sac filet linge delicat lot
- Cache multiprise boite rangement cables
- Grattoir vitroceramique cuisine
- Organisateur coffre voiture pliable
- Porte brosse a dents adhesif
- Trousse premiers soins vide voyage
- Gant brossage animaux silicone
- Support eponges evier ventouse

Tous restent en `draft`/HOLD avec image de categorie temporaire, stock 0, fournisseur exact absent, SKU absent, prix fournisseur reel absent, droits image absents et validation Mouss obligatoire.

## Sauvegardes

- Sauvegarde manuelle: `business-maxi-trouvailles/sauvegardes/20260612_couche_226_volume_integration_hold/`
- Sauvegarde automatique avant ecriture catalogue: `backups/quick-products-before-integration-articles-20260612-120758/quick-products.json.bak`

## Tests executes

- `node --check scripts/automation/integrate_dropshipping_article_candidates.mjs`
- `npm run catalog:integrate-article-candidates`
- `npm run catalog:apply-article-candidates`
- `npm run catalog:audit-integration-articles`
- `npm run catalog:audit-public-dropshipping-surface`
- `npm run catalog:audit-checkout-eligibility`
- `npm run catalog:audit-seo-hold-visibility`
- `npm run catalog:integration-sourcing-packets`
- `npm run catalog:audit-integration-sourcing-packets`
- `npm run catalog:integration-execution-board`
- `npm run catalog:integration-sourcing-session`
- `npm run catalog:audit-integration-sourcing-session`
- `npm run catalog:integration-sourcing-priority-board`
- `npm run catalog:audit-integration-sourcing-priority-board`
- Top 3 complet: sourcing, preuves paralleles, WebP, depot, session, gate business, plan deblocage et audits.
- `npm run catalog:audit-generated-artifact-leaks`
- `npm run catalog:daily-execution-board`
- `npm run catalog:audit-daily-execution-board`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Resultats: OK. Surface publique: 0 produit dropshipping visible, 0 achetable. Checkout: 0 produit achetable attendu. SEO HOLD: OK. Anti-fuite: 450 fichiers scannes, 0 alerte.

## Prochain pas

Continuer le sourcing manuel sur les 10 packets prioritaires et surtout le top 3: collecter preuves fournisseur exactes, SKU, variante, prix reel, stock, delai France/Europe, droits image, puis deposer les WebP exacts avant revue Mouss.
