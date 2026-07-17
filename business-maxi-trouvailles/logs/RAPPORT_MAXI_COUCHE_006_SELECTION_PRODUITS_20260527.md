# Rapport Maxi - Couche 006 - Selection produits

Objectif: preparer une file de produits fournisseurs a valider par categorie, sans achat ni publication.

Candidats generes: 100

Sorties:
- C:\Users\sinek\Desktop\maxi-trouvaille\business-maxi-trouvailles\produits-a-valider\selection_couche_006_20260527.json
- C:\Users\sinek\Desktop\maxi-trouvaille\business-maxi-trouvailles\produits-a-valider\selection_couche_006_20260527.md

Garde-fous:
- Aucun secret affiche.
- Aucune commande fournisseur.
- Aucune publication TikTok ou reseau social.
- Chaque visuel/source/delai reste a verifier avant mise en ligne publique.

Verification:
- node --check scripts/automation/generate_maxi_partner_candidates.mjs: OK
- npm run typecheck: OK
- npm run lint: OK
- npm run build: OK
