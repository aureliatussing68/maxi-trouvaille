# Audit existant - 2026-05-21

## Jarvis

Ce qui marche :
- interface locale et commandes vocales,
- controle PC / fenetres / multi-ecrans,
- commandes Maxi de base,
- logs et sauvegardes,
- Open WebUI bridge avec fallback IA.

Incomplet :
- Docker/Open WebUI non joignable par CLI pendant cet audit,
- pas encore de pipeline business complet,
- publication reseaux a garder manuelle.

## Maxi Trouvailles

Ce qui marche :
- Next.js buildable,
- admin ajout rapide,
- API produits,
- Stripe en mode test prevu,
- panier,
- pages legales/livraison,
- dropshipping orders,
- calcul marge fournisseur,
- scripts TikTok locaux.

Incomplet :
- recherche produit gagnant non automatisee,
- import AliExpress/API non connecte,
- fiches IA hors analyse photo non centralisees,
- pubs multi-plateformes non orchestrees,
- statut produit business "test/gagnant" absent du pipeline principal.

## Risques

- L'import rapide cree des produits publies par defaut.
- Next/PostCSS signalent des vulnerabilites npm a traiter apres validation.
- Les connecteurs AliExpress/DSers/AutoDS sont seulement prevus par variables d'environnement.
- Les scripts TikTok doivent rester en validation manuelle.
