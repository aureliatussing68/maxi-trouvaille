# Rapport Maxi Trouvailles - Couche 020 - Reset filtres brouillons

## Objectif

Ajouter un retour rapide à la liste complète des brouillons partenaires dans l'admin dropshipping, sans mutation de données.

## Fichiers modifies

- `src/components/DropshippingAdminPanel.tsx`

## Sauvegarde creee

- `backups/couche020_20260528_212453`

## Changements faits

- Ajout d'un bouton `Réinitialiser` dans le panneau de filtres passifs.
- Le bouton remet à zéro la recherche, le filtre de gate, le filtre fournisseur et le filtre de priorité.
- Le bouton est désactivé quand aucun filtre n'est actif.
- Aucun changement de données, d'import, de publication ou de commande.

## Tests executes

- `npm run typecheck` : OK
- `npm run lint` : OK
- `npm run build` : OK

## Garde-fous respectes

- Aucune donnée produit modifiée.
- Aucune publication automatique.
- Aucune commande fournisseur.
- Aucun serveur lancé.
- Aucun port, Docker, OpenWebUI, Jarvis, Mimouss ou runtime vocal touché.
- Aucun déploiement et aucune API payante.

## Risques / restes a faire

- Le bouton agit uniquement sur l'état local React.
- Prochaine amélioration utile: ajouter une exportation passive/lecture seule de la liste filtrée pour préparer une revue manuelle hors publication.

## Prochaine couche conseillee

Couche 021: export passif de revue des brouillons filtrés, sans écriture produit ni publication.
