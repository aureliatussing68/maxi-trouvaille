# Rapport Maxi Trouvailles - Couche 192 - Audit artefacts generes sensibles

Date: 2026-06-12
Statut: OK, lecture seule

## Objectif

Ajouter un audit reutilisable pour verifier les artefacts generes du jour sans confondre les champs vides a remplir avec de vraies fuites. Le besoin vient du pipeline sourcing: des noms de champs comme `exactProductUrl` sont normaux dans les templates, mais une URL externe reelle, une marketplace interdite ou une valeur de cle doit etre bloquee.

## Fichiers touches

- `scripts/automation/audit_generated_artifact_leaks.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/audit-artefacts-generes-sensibles-20260612/*`
- Sauvegardes: `business-maxi-trouvailles/sauvegardes/20260612_couche_192_audit_artefacts_sensibles/*`

## Resultat

- Nouvelle commande: `npm run catalog:audit-generated-artifact-leaks`
- Dossiers scannes: 22
- Fichiers scannes: 112
- Alertes trouvees: 0
- Les noms de champs vides a remplir restent autorises.
- Les URLs externes reelles, marketplaces interdites et valeurs de cle restent bloquantes.

## Actions sensibles

- Catalogue modifie: non
- Produit publie: non
- Image telechargee ou copiee: non
- Commande fournisseur: non
- Paiement: non
- Message externe: non
- Requete externe: non

## Validations executees

- `node --check scripts/automation/audit_generated_artifact_leaks.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
- `git diff --check -- package.json business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `npm run catalog:audit-generated-artifact-leaks`
- `npm run catalog:audit-public-dropshipping-surface`
- `npm run catalog:audit-checkout-eligibility`
- `npm run catalog:test-public-image-contract`
- `npm run catalog:audit-integration-next-proofs-workpack`
- `npm run lint`
- `npm run typecheck`

## Preuves de verrouillage

- Surface publique dropshipping: 0 visible, 0 achetable, 61 fiches bloquees hors public.
- Checkout: 0 produit attendu achetable, 0 echec.
- Prochaines preuves sourcing: 5 preuves HOLD, 0 prete, 35 blocages business attendus.

## Prochain pas recommande

Relancer `npm run catalog:audit-generated-artifact-leaks` apres chaque grosse generation de tableaux sourcing/images, puis continuer le remplissage manuel du CSV `A_REMPLIR_PREUVES_SOURCING_INTEGRATION_20260612.csv` sans publier tant que les audits restent HOLD.
