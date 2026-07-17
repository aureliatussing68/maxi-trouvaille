# Pipeline Dropshipping

## Mode actuel

Le mode actuel est volontairement semi-automatique :
- recherche ou generation de candidats,
- scoring business,
- verification securite,
- creation de fiche brouillon,
- creation de scripts publicitaires,
- attente de validation humaine.

## Etape 1 - Recherche produit

Commande cible :

```text
Jarvis, cherche-moi 10 produits gagnants
```

Sortie attendue :
- nom produit,
- prix fournisseur estime,
- prix conseille,
- prix barre indicatif,
- marge estimee,
- delai livraison,
- fournisseur/source,
- lien source si disponible,
- niveau de risque,
- idee pub.

Les produits sont stockes dans `produits-a-valider/`.

## Etape 2 - Validation

Aucune fiche n'est envoyee au site sans validation. Les produits sensibles sont bloques :
- contrefacon,
- marques protegees,
- produits dangereux,
- alimentation / complements / cosmetiques sans documents,
- batterie non certifiee,
- produits enfants/jouets sans conformite,
- promesses medicales,
- armes, surveillance intrusive, produits illegaux.

## Etape 3 - Fiche produit

La fiche genere :
- titre,
- description courte,
- description longue,
- benefices,
- caracteristiques,
- prix promo,
- prix barre,
- tags SEO,
- categorie,
- slug,
- meta title,
- meta description,
- livraison,
- retour/SAV.

Les fiches restent dans `fiches-produits/` tant que Mouss n'a pas valide.

## Etape 4 - Publicites

Commande cible :

```text
Jarvis, prepare 3 pubs pour ce produit
```

Sorties :
- script TikTok,
- script Instagram/Reels,
- script Snapchat/Story,
- accroches,
- textes ecran,
- hashtags,
- images SVG de brouillon,
- manifest JSON.

Export dans `exports-publicites/`.

## Etape 5 - Publication

Non active par defaut.

Publication possible plus tard seulement apres :
- validation fiche produit,
- verification prix/marge,
- verification livraison/retours,
- verification fournisseur,
- verification legalite,
- validation humaine finale.
