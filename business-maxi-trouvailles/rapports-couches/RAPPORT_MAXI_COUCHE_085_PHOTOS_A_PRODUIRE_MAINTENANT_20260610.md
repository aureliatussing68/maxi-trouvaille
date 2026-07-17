# Rapport couche 085 - Photos a produire maintenant

Date: 2026-06-10
Statut: HOLD catalogue, GO technique local

## Objectif

Rendre l'atelier photos produits plus actionnable en regroupant en haut de page les fichiers WebP manquants a produire maintenant.

Cette couche ne copie aucune image, ne telecharge rien, ne genere aucune image, ne modifie pas le catalogue et ne publie rien.

## Sauvegarde

Sauvegarde avant modification:

`backups/couche-085-photos-a-produire-maintenant-20260610_1804`

Fichier sauvegarde:

- `src/app/admin/photos-produits/page.tsx`

## Fichiers touches

Modifie:

- `src/app/admin/photos-produits/page.tsx`

## Fonctionnel ajoute

Nouveau bloc dans `/admin/photos-produits`:

`A produire maintenant`

Le bloc liste les taches image dont le fichier local est absent ou dont la signature WebP n'est pas valide.

Etat courant:

- 8 fichiers WebP a deposer
- 2 produits concernes
- noms de fichiers exacts visibles
- cadrage attendu visible
- chemins de depot visibles
- statut HOLD visible
- lien vers la checklist imprimable disponible

Produits concernes:

- Pochette organisateur cables double couche voyage
- Support PC portable pliant aluminium ajustable

## Garde-fous conserves

- Aucune copie dans `public/uploads`
- Aucun telechargement image
- Aucune generation image
- Aucune modification catalogue
- Aucune publication
- Aucun paiement
- Aucune commande fournisseur
- Validation Mouss obligatoire avant toute sortie de HOLD

## Validations executees

- `npm run catalog:audit-photo-checklist`: OK
- `npm run typecheck`: OK
- `npm run lint`: OK apres correction `react/no-unescaped-entities`
- `npm run build`: OK
- HTTP local:
  - `http://localhost:3010/admin/photos-produits`: 200
  - `http://localhost:3010/admin/photos-produits/checklist`: 200
- Browser desktop:
  - page photos produits chargee: OK
  - noms WebP exacts visibles: OK
  - lien checklist visible: OK
  - HOLD visible: OK
  - overflow horizontal: 0
  - console errors: 0
- Browser mobile 390x844:
  - bloc `A produire maintenant` visible: OK
  - 8 fichiers WebP a deposer visible: OK
  - noms WebP exacts visibles: OK
  - lien checklist visible: OK
  - overflow horizontal: 0
  - console errors: 0

## Scan securite

Scan anti-secret sur les fichiers touches et ce rapport: OK.

## Prochaine couche recommandee

Ajouter une micro-synthese business dans `/admin/pilotage` qui distingue clairement: produits bloquants par preuves fournisseur, photos produits a produire, images categories a deposer et garde-fous checkout OK.
