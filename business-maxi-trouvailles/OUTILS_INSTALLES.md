# Outils installes / verifies

## Disponibles localement

- Node.js / npm : OK.
- Python 3.12 : OK.
- Git : OK.
- VS Code : OK.
- ffmpeg : OK.
- Ollama : present, mais etat serveur a verifier.
- Docker CLI : present. Open WebUI a ete remis sur le conteneur local `open-webui` en `127.0.0.1:3000->8080`.
- Sharp : present via dependances Next.
- Pillow, MoviePy, Numpy, OpenCV : OK cote Python.
- Playwright : ajoute au projet pour les scripts navigateur existants.

## Manquants ou optionnels

- ImageMagick : non installe.
- rembg : non installe.
- requests / BeautifulSoup / pandas : non installes dans le Python global audite.
- Puppeteer : non installe.

## Choix actuel

Le pipeline business n'a pas besoin de scraper automatiquement pour demarrer. Il travaille d'abord en brouillon local, avec validation humaine. Les integrations API payantes sont preparees mais inactives.

## Audit npm

- `npm audit fix` a corrige la partie non-forcee.
- Il reste des alertes `next/postcss` qui demandent `npm audit fix --force` et donc une mise a jour Next hors plage declaree. A valider avant application.
