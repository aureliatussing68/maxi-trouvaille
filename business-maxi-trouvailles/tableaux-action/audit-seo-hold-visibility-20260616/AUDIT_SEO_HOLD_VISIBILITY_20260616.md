# Maxi Trouvailles - Audit SEO produits HOLD

Date locale: 2026-06-16 00:11 Europe/Paris
Statut: OK_HOLD_PRODUCTS_NOT_INDEXABLE

## Synthese

- Produits totaux controles: 121
- Produits publics attendus: 0
- Produits non publics/HOLD: 121
- Slugs publies mais blindes en route publique: 4
- Fiches publiees bloquees par readiness: 0
- Echecs SEO: 0
- Publication: aucune.
- Paiement/commande fournisseur: aucun.

## Verrous controles

| Controle | Statut | Blocage si KO |
|---|---|---|
| catalog_public_filter_uses_readiness_gate | OK | Le filtre public du catalogue doit garder le verrou readiness dropshipping strict. |
| catalog_server_public_lookup_reuses_is_public_product | OK | Le lookup public par slug doit repasser par isPublicProduct avant de servir une fiche. |
| product_route_uses_public_lookup | OK | La page produit publique doit utiliser getPublicCatalogProductBySlug(slug). |
| admin_preview_noindex | OK | Le mode adminPreview doit rester en noindex/nofollow. |
| static_params_filter_public_products | OK | generateStaticParams ne doit pas preparer les produits brouillons/HOLD. |
| dynamic_params_disabled_for_unlisted_products | OK | Les slugs produit non generes doivent retourner une vraie 404 HTTP. |
| product_route_not_force_dynamic | OK | La route produit ne doit pas forcer le rendu dynamique pendant le focus HOLD SEO. |
| sitemap_uses_public_products | OK | Le sitemap doit partir de getPublicProducts(), pas de tous les produits. |
| robots_blocks_admin_preview | OK | robots.txt doit bloquer admin, api admin et adminPreview. |

## Produits non publics gardes hors SEO

| Source | Slug | Statut | Categorie | Dropshipping | Route 404/noindex | Blockers readiness |
|---|---|---|---|---|---|---|
| src/lib/catalog.ts | palette-mystere-destockage | published | palettes-destockage | non | oui | dropshipping_disabled |
| src/lib/catalog.ts | colis-surprise-10-kg | published | colis-au-poids | non | oui | dropshipping_disabled |
| src/lib/catalog.ts | colis-mystere-premium | published | colis-mysteres | non | oui | dropshipping_disabled |
| src/lib/catalog.ts | lot-special-marche | published | lots-bonnes-affaires | non | oui | dropshipping_disabled |
| src/lib/catalog.ts | pack-revendeur | draft | espace-revendeur | non | non | dropshipping_disabled |
| src/lib/catalog.ts | mini-imprimante-thermique-bluetooth | draft | dropshipping-high-tech | oui | non | supplier_url_exact_missing, supplier_sku_missing, exact_images_not_verified, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready |
| src/lib/catalog.ts | organisateur-cables-voyage-tech | draft | dropshipping-accessoires | oui | non | supplier_url_exact_missing, supplier_sku_missing, exact_images_not_verified, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready |
| src/lib/catalog.ts | projecteur-galaxie-led-ambiance | draft | dropshipping-maison | oui | non | supplier_url_exact_missing, supplier_sku_missing, exact_images_not_verified, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready |
| src/lib/catalog.ts | mini-aspirateur-voiture-sans-fil | draft | dropshipping-auto-moto | oui | non | supplier_url_exact_missing, supplier_sku_missing, exact_images_not_verified, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready |
| src/lib/catalog.ts | pack-decouverte-test | draft | high-tech | non | non | dropshipping_disabled |
| data/quick-products.json | peigne-poils-chat-autonettoyant-pet-hold | draft | dropshipping-animaux | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | gamelle-macaron-chat-chien-anti-choc | draft | dropshipping-animaux | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | sac-banane-sport-etanche-randonnee | draft | dropshipping-accessoires | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | corde-paracorde-camping-randonnee-5-15-30m | draft | dropshipping-accessoires | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | lampe-velo-usb-rechargeable-affichage-batterie | draft | dropshipping-high-tech | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | ruban-double-face-puissant-maison-promo | draft | dropshipping-maison | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | nano-tape-double-face-salle-de-bain-cuisine | draft | dropshipping-maison | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | support-eponge-evier-inox-auto-adhesif | draft | dropshipping-cuisine | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | set-coupe-ongles-manucure-portable-promo | draft | dropshipping-beaute | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | tondeuse-t9-barbe-cheveux-promo | draft | dropshipping-beaute | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | support-telephone-magnetique-voiture-promo | draft | dropshipping-auto-moto | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | brosse-massage-cuir-chevelu-silicone-best-seller | draft | dropshipping-beaute | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | spray-huile-cuisine-reutilisable-best-seller | draft | dropshipping-cuisine | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | papier-cuisson-air-fryer-promo-lot | draft | dropshipping-cuisine | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | support-mural-balai-serpillere-4-crochets | draft | dropshipping-maison | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | sac-lavage-chaussures-machine-best-seller | draft | dropshipping-maison | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | trousse-maquillage-voyage-transparente-best-seller | draft | dropshipping-mode | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | sac-voyage-pliable-cabine-leger | draft | dropshipping-mode | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | machine-bulles-automatique-enfant-exterieur | draft | dropshipping-enfant | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |
| data/quick-products.json | avion-mousse-lanceur-enfant-jeu-exterieur | draft | dropshipping-enfant | oui | non | delivery_estimate_not_ready, image_rights_not_ready, source_price_not_ready, source_delivery_not_ready, validation_gate_not_ready, internal_sourcing_hold |

## Sources

- src\lib\catalog-server.ts
- src\app\produit\[slug]\page.tsx
- src\app\sitemap.ts
- src\app\robots.ts
- src\lib\catalog.ts
- data\quick-products.json

