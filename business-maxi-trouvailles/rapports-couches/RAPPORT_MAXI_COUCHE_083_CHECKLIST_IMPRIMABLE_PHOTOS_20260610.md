# Rapport couche 083 - Checklist imprimable photos produits

Date: 2026-06-10
Statut: HOLD catalogue, GO technique local

## Objectif

Ajouter une version lisible et imprimable du sprint photos produits pour accelerer la validation humaine des images exactes avant toute copie publique.

Cette couche reste strictement interne: aucune image n'est telechargee, generee, copiee dans `public/uploads`, publiee ou rattachee aux fiches produits.

## Sauvegarde

Sauvegarde avant modification:

`backups/couche-083-checklist-photos-print-20260610_1729`

Fichier sauvegarde:

- `src/app/admin/photos-produits/page.tsx`

## Fichiers touches

Ajoute:

- `src/app/admin/photos-produits/checklist/page.tsx`

Modifie:

- `src/app/admin/photos-produits/page.tsx`

## Fonctionnel ajoute

Nouvelle route admin:

`/admin/photos-produits/checklist`

La page lit le dernier manifest de depot photo et affiche une checklist propre par produit et par image:

- nom WebP exact attendu
- role image: principale, detail, usage, dimensions
- cadrage ou preuve attendue
- chemin de depot local
- URL publique future, non encore activee
- statut HOLD
- cases de validation: WebP exact, signature valide, produit exact, variante confirmee, droits image, aucun accessoire trompeur, validation Mouss

Etat courant affiche:

- 2 produits
- 8 photos attendues
- 0 WebP valide present
- 8 photos a produire ou valider

Produits suivis:

- Pochette organisateur cables double couche voyage
- Support PC portable pliant aluminium ajustable

L'atelier `/admin/photos-produits` contient maintenant un raccourci direct `Checklist`.

## Garde-fous conserves

- Aucune commande fournisseur
- Aucun paiement
- Aucune publication
- Aucune copie dans les uploads publics
- Aucun telechargement ou generation image
- Aucun message client ou fournisseur
- Validation Mouss obligatoire avant toute sortie de HOLD

## Validations executees

- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK
- HTTP local:
  - `http://localhost:3010/admin/photos-produits/checklist`: 200
  - `http://localhost:3010/admin/photos-produits`: 200
- Browser desktop:
  - route checklist chargee: OK
  - H1 visible: OK
  - les 2 produits visibles: OK
  - les noms WebP exacts visibles: OK
  - les cases de validation visibles: OK
  - HOLD visible: OK
  - lien retour atelier photos visible: OK
  - lien depuis `/admin/photos-produits` vers checklist visible: OK
  - overflow horizontal: 0
  - console errors: 0
- Browser mobile 390x844:
  - route checklist chargee: OK
  - les 2 produits et criteres de validation visibles: OK
  - overflow horizontal: 0
  - console errors: 0

## Scan securite

Scan anti-secret sur les fichiers touches et ce rapport: OK.

## Prochaine couche recommandee

Ajouter une couche d'audit automatique de la checklist printable contre le manifest: compter les images attendues, detecter les chemins manquants, puis remonter un statut clair dans le cockpit pilotage.
