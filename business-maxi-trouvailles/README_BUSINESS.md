# Maxi Trouvailles Business IA

Ce dossier contient le pipeline business pilote pour travailler avec Jarvis sans publier automatiquement.

Objectif :
- chercher des idees produits rentables,
- filtrer les risques,
- preparer une fiche produit en brouillon,
- preparer des pubs TikTok / Instagram / Snapchat,
- garder une validation humaine avant toute publication, achat fournisseur ou paiement.

Regle d'or :
1. Jarvis propose.
2. Mouss valide.
3. Jarvis prepare.
4. Mouss valide.
5. Publication seulement apres validation explicite.

Commandes locales utiles :

```bash
npm run business:status
npm run business:search
npm run business:demo
npm run business:product
npm run business:ads
```

Les sorties sont stockees dans :
- `produits-a-valider/`
- `fiches-produits/`
- `exports-publicites/`
- `logs/`

Le pipeline ne modifie pas `data/quick-products.json` et ne publie rien sur Maxi Trouvailles.
