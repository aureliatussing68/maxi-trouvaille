# Rapport Maxi couche 317 - Synthese inter-lots checklist Mouss

## Objectif
- Ajouter une synthese inter-lots au dossier final revue Mouss.
- Voir rapidement quels lots marques `Dossier pret Mouss` sont complets ou encore incomplets.
- Garder la synthese locale: aucun changement catalogue, aucune publication, aucun retrait HOLD.

## Integration
- Ajout du type `DraftMoussFinalLotRow`.
- Ajout du calcul `activeProofCategoryMoussFinalLotRows` groupe par lot.
- Ajout des compteurs: lots, lots complets, lots incomplets, cases cochees.
- Ajout d'une preview inter-lots avec statut `Complet local` ou `incomplet(s)`.
- Ajout de l'export `Export synthese inter-lots Mouss`.
- Ajout de l'export `Export CSV synthese inter-lots Mouss`.
- Les exports indiquent seulement la suite locale Mouss et `HOLD maintenu`; aucune action sensible.

## Verifications
- `npm run typecheck` OK.
- `npx eslint src/components/DropshippingAdminPanel.tsx` OK.
- `npm run lint` OK.
- `npm run build` OK.
- `npm run catalog:audit-public-dropshipping-surface` OK: 0 produit visible/achetable, 91 brouillons bloques.
- `npm run catalog:audit-public-catalog-source-guards` OK: 0 fuite publique.
- `npm run catalog:audit-checkout-eligibility` OK: 0 produit eligible checkout, 0 echec.
- `npm run catalog:audit-seo-hold-visibility` OK: 121 produits non publics, 0 echec.
- `npm run catalog:audit-admin-publication-ui-guard` OK: 11 controles, 0 echec.
- `npm run catalog:audit-admin-page-guards` OK: 14 pages, 0 echec.

## Verification mobile
- Dev local ouvert sur `http://localhost:3142/admin/dropshipping`.
- Viewport mobile 390x844.
- File activee via le couple prioritaire.
- Premier candidat passe en `Dossier pret Mouss`.
- Deux cases finales cochees: image exacte et source partenaire.
- Carte `Synthese inter-lots checklist` visible.
- Exports `Export synthese inter-lots Mouss` et `Export CSV synthese inter-lots Mouss` ouverts et verifies.
- Export texte verifie: `Synthese inter-lots checklist finale Mouss`, lots incomplets, action de traitement.
- Export CSV verifie: `dossiers_prets`, `cases_totales`, `finir checklist finale avant revue humaine`, `HOLD maintenu`.
- Aucune fuite `AliExpress`, `Temu`, `supplier`, `URL fournisseur` dans les exports inter-lots.
- Largeur mobile stable: html/body `375/375`, pas de debord horizontal.
- Console navigateur: 0 erreur.
- Capture: `tmp-next-couche-317-mobile.png`.
- Serveur local 3142 stoppe apres verification.

## Suite conseillee
- Ajouter une vue de priorisation des lots incomplets: quel lot finit le plus vite avec le moins de cases restantes.
- Continuer a conserver tous les produits en HOLD tant que les preuves exactes et la validation Mouss ne sont pas completes.
