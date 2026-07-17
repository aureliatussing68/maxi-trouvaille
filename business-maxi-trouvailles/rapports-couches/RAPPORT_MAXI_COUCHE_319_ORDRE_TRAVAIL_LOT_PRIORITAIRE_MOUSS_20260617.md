# Rapport Maxi Trouvaille - Couche 319

## Objectif

Transformer la priorite des lots incomplets en ordre de travail exploitable par Mouss: quoi finir en premier, quelles cases restent a cocher, et quelle fiche reprendre, sans modifier le catalogue ni retirer le HOLD.

## Integration locale

- Ajout du type `DraftMoussFinalLotWorkOrderRow`.
- Ajout du calcul du prochain ordre de travail a partir du lot incomplet le plus rapide.
- Tri des fiches du lot prioritaire par nombre de cases restantes.
- Ajout d'une carte `Ordre de travail lot prioritaire` dans le dossier final Mouss.
- Affichage de la fiche a traiter maintenant, du lien admin local, des cases restantes et des cases a cocher.
- Ajout de deux exports internes:
  - `Export ordre de travail Mouss`;
  - `Export CSV ordre de travail Mouss`.
- Garde-fous conserves: aucune publication, aucune commande, aucun paiement, aucun retrait HOLD automatique.

## Verifications

- `npx eslint src/components/DropshippingAdminPanel.tsx` OK.
- `npm run typecheck` OK.
- `npm run lint` OK.
- `npm run build` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit dropshipping visible, 0 achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards` OK: 0 fuite publique detectee.
- `npm run catalog:audit-checkout-eligibility` OK: 121 produits controles, 0 produit achetable attendu, 0 echec.
- `npm run catalog:audit-seo-hold-visibility` OK: 0 produit public, 121 non publics, 0 echec.
- `npm run catalog:audit-admin-publication-ui-guard` OK: 11 controles, 0 echec.
- `npm run catalog:audit-admin-page-guards` OK: 14 pages, 0 echec.

## Verification mobile

- Serveur local lance sur `http://localhost:3144`, puis arrete apres verification.
- Vue mobile 390x844 sur `/admin/dropshipping`.
- Parcours verifie: filtre couple actif, decision `Dossier pret Mouss`, cases image exacte et source partenaire cochees localement.
- Bloc `Ordre de travail lot prioritaire` visible avec `A traiter maintenant`, fiche a finir, cases restantes et lien admin local.
- Exports `Export ordre de travail Mouss` et `Export CSV ordre de travail Mouss` ouverts et valides.
- Export texte verifie: ordre prioritaire, cases a completer, interdits, HOLD maintenu.
- Export CSV verifie: `cases_a_completer`, action locale, HOLD maintenu.
- Anti-fuite OK: aucun `AliExpress`, `Temu`, `supplier` ou `URL fournisseur` dans les exports ajoutes.
- Layout mobile OK: `body` 375 px, `html` 375 px, viewport 390 px, aucun overflow horizontal.
- Console OK: 0 erreur reelle.
- Capture: `tmp-next-couche-319-mobile.png`.

## Suite conseillee

Ajouter une vue `pret pour revue humaine` qui regroupe seulement les fiches dont l'ordre de travail est complet, toujours en HOLD, afin de preparer une validation Mouss propre et non automatique.
