# Maxi Trouvailles - Test fixtures contrat image publique

Date locale: 2026-06-12 08:18 Europe/Paris

## Resultat

- Statut: OK
- Scenarios: 10
- Echecs: 0
- Fuites sensibles detectees: 0

## Scenarios

| Statut | Scenario | Image fixture | Resultat public | Blockers image |
|---|---|---|---|---|
| OK | partner_webp_exact_is_public_ready | partner-webp | public | aucun |
| OK | quick_product_webp_exact_is_public_ready | quick-webp | public | aucun |
| OK | remote_image_blocks_public | remote-redacted | HOLD | image_remote_not_local, image_not_in_exact_product_depot, image_not_webp |
| OK | supplier_cdn_image_blocks_public | supplier-cdn-redacted | HOLD | image_remote_not_local, supplier_cdn_image, image_not_in_exact_product_depot |
| OK | category_image_blocks_product_public | category-webp | HOLD | image_not_exact_product_photo, image_not_in_exact_product_depot |
| OK | generated_product_image_blocks_public | generated-webp | HOLD | image_not_exact_product_photo, image_not_in_exact_product_depot |
| OK | placeholder_image_blocks_public | placeholder-webp | HOLD | placeholder_or_hold_image |
| OK | non_webp_product_image_blocks_public | partner-jpg | HOLD | image_not_webp |
| OK | gallery_category_image_blocks_public_even_if_main_is_exact | gallery-mixed | HOLD | image_not_exact_product_photo, image_not_in_exact_product_depot |
| OK | image_validation_hold_blocks_public_even_with_local_webp | validation-hold | HOLD | aucun |

## Garde-fous

- Fixtures en memoire uniquement.
- Aucun produit reel lu ou modifie.
- Aucune image telechargee.
- Aucun paiement.
- Aucune commande fournisseur.
- Aucune publication.
- Les URLs distantes de fixture ne sont pas exportees.

