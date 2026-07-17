# Rapport couche 087 - Triage preuves partenaires

Date: 2026-06-10
Statut: HOLD catalogue, GO technique local

## Objectif

Ajouter dans `/admin/preuves-partenaires` un triage clair des produits partenaires selon le travail a faire: preuve rapide, recontrole complet, remplacer/retirer et pret revue HOLD.

Cette couche ne modifie aucun produit, ne publie rien, ne commande rien et ne touche pas aux paiements.

## Sauvegarde

Sauvegarde avant modification:

`backups/couche-087-segmentation-preuves-partenaires-20260610_1836`

Fichier sauvegarde:

- `src/app/admin/preuves-partenaires/page.tsx`

## Fichiers touches

Modifie:

- `src/app/admin/preuves-partenaires/page.tsx`

## Fonctionnel ajoute

Nouveau bloc:

`Triage preuves partenaires`

Il separe:

- `Preuve rapide`: 5 formulaires courts a completer
- `Recontrole complet`: 6 fiches a reprendre en profondeur
- `Remplacer / retirer`: 4 decisions statiques a trancher
- `Pret revue HOLD`: 0 fiche prete actuellement

Chaque carte affiche:

- compteur
- statut HOLD/OK
- prochaine action
- exemples de produits
- lien vers la bonne zone de la page

Ancres ajoutees:

- `#file-business`
- `#fiches-rapides`

## Garde-fous conserves

- Aucun paiement
- Aucune commande fournisseur
- Aucune publication
- Aucune modification catalogue
- Aucun message client ou fournisseur
- Validation Mouss obligatoire avant toute sortie de HOLD

## Validations executees

- `npm run catalog:audit-photo-checklist`: OK
- `npm run typecheck`: OK
- `npm run lint`: OK apres correction `react/no-unescaped-entities`
- `npm run build`: OK
- HTTP local:
  - `http://localhost:3010/admin/preuves-partenaires`: 200
  - `http://localhost:3010/admin/pilotage`: 200
- Browser desktop:
  - bloc `Triage preuves partenaires` visible: OK
  - `Preuve rapide` avec compteur 5 visible: OK
  - `Recontrole complet` avec compteur 6 visible: OK
  - `Remplacer / retirer` avec compteur 4 visible: OK
  - `Pret revue HOLD` avec compteur 0 visible: OK
  - exemples produits visibles: OK
  - ancres internes presentes: OK
  - overflow horizontal: 0
  - console errors: 0
- Browser mobile 390x844:
  - 4 dossiers de triage visibles: OK
  - HOLD visible: OK
  - overflow horizontal: 0
  - console errors: 0

## Scan securite

Scan anti-secret sur les fichiers touches et ce rapport: OK.

## Prochaine couche recommandee

Ajouter un export local lisible `A_REMPLIR_PREUVES_PARTENAIRES_NOW.md` qui liste uniquement les 5 formulaires rapides, avec les champs manquants a remplir manuellement avant revue Mouss.
