# Rapport Maxi Trouvailles - Couche 016 - File priorite brouillons

## Objectif

Ajouter une file de priorite passive pour aider Mouss a reprendre les brouillons partenaires les plus urgents en premier.

## Fichiers modifies

- `src/components/DropshippingAdminPanel.tsx`

## Sauvegarde creee

- `backups/couche016_20260528_182834`

## Changements faits

- Ajout d'un score local de priorite par brouillon.
- Priorisation des brouillons avec gate absent, gate incomplet, lien fournisseur absent, prix fournisseur manquant ou delai manquant.
- Ajout d'une section "File de priorite passive" dans l'admin dropshipping.
- Selection directe d'un brouillon prioritaire vers le panneau de details cree en couche 015.
- Aucun changement de donnees, aucune publication, aucune commande fournisseur.

## Tests executes

- `npm run typecheck` : OK
- `npm run lint` : OK
- `npm run build` : OK

## Risques / restes a faire

- Le score de priorite est volontairement simple et local au composant.
- Prochaine couche utile: ajouter des filtres admin passifs pour afficher seulement les brouillons avec gate absent, lien fournisseur absent ou gate complet.

## Prochaine couche conseillee

Couche 017: filtres passifs brouillons partenaires dans l'admin dropshipping.
