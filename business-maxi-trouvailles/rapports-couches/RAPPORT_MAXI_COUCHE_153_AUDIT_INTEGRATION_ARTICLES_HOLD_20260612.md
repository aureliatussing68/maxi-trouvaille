# Rapport Maxi couche 153 - Audit integration articles HOLD

Date: 2026-06-12

## Objectif

Ajouter un garde-fou dedie a la branche `Integration articles`, afin de pouvoir ajouter du volume en brouillon/HOLD sans risque de mauvaise image, fournisseur expose, prix fournisseur invente ou fiche rendue vendable trop tot.

## Fichiers touches

- `scripts/automation/audit_integration_article_candidates.mjs`
- `package.json`
- `business-maxi-trouvailles/AUTOMATION_COUCHE_PAR_COUCHE_MAXI.md`
- `business-maxi-trouvailles/tableaux-action/audit-integration-articles/20260612/AUDIT_INTEGRATION_ARTICLES_20260612.json`
- `business-maxi-trouvailles/tableaux-action/audit-integration-articles/20260612/AUDIT_INTEGRATION_ARTICLES_20260612.md`
- `business-maxi-trouvailles/tableaux-action/audit-integration-articles/20260612/AUDIT_INTEGRATION_ARTICLES_20260612.csv`

## Sauvegarde

- `backups/integration-articles-audit-couche-153-20260612-003419`

## Ce que le nouvel audit controle

- Les fiches integration restent en `draft`.
- Le stock catalogue reste a 0 tant que HOLD.
- Les images restent des placeholders locaux de categorie, jamais des images distantes ou fournisseur.
- `imageValidation` et `sourceVerification` restent en HOLD.
- Fournisseur exact, SKU, prix fournisseur reel, stock fournisseur et marge validee restent absents tant que les preuves manquent.
- Aucun lien fournisseur interdit ni chaine sensible ne part dans les artefacts generes.

## Resultat audit integration

- Candidats integration trouves: 12.
- Prets pour sourcing manuel: 12.
- Echecs garde-fou: 0.
- Statut: `OK_HOLD`.

Top sourcing manuel:

| Produit | Score | Marge cible | Action |
|---|---:|---:|---|
| Organisateur tiroir cuisine extensible | 89 | 11.70 EUR (59%) | Verifier contact matiere, dimensions exactes, quantite vendue et droits image. |
| Sacs compression voyage lot | 89 | 10.50 EUR (66%) | Chercher fournisseur Europe/France avec lot exact, photos propres et livraison suivie. |
| Gourde chien voyage anti fuite | 86 | 10.80 EUR (64%) | Verifier matiere, usage animal, photos exactes et delai court. |
| Lampe LED placard rechargeable | 86 | 10.40 EUR (62%) | Verifier dimensions, usage reel, photos exactes et delai France/Europe. |
| Boite rangement cables bureau | 85 | 8.70 EUR (67%) | Chercher fournisseur Europe/France avec lot exact, photos propres et livraison suivie. |

## Validations lancees

- `npm run catalog:audit-integration-articles` OK: 12 candidats, 0 echec.
- `npm run catalog:audit-quick-product-hold` OK: 69 quick-products, 69 draft, 0 publie.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 visible, 0 achetable, 0 echec.
- `npm run catalog:audit-public-visual-ambiguity` OK: 0 echec.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit achetable attendu, 0 echec.
- `npm run lint` OK.
- `npm run typecheck` OK.
- `npm run build` OK.
- Scan anti-fuite sur artefacts audit integration OK.

## Statut

GO technique local.

HOLD business maintenu: les 12 fiches restent uniquement une file de sourcing manuel et ne sont ni publiees, ni achetables, ni commandees.

## Prochain pas recommande

Traiter le top 3 du CSV `AUDIT_INTEGRATION_ARTICLES_20260612.csv`: chercher fournisseur France/Europe exact, remplir preuves, deposer WebP exacts, puis relancer les audits images/publication avant revue humaine Mouss.
