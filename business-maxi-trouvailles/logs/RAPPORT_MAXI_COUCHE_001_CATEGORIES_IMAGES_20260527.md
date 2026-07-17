# Couche 001 - Categories visuelles

Date: 2026-05-27

Objectif: remettre les grandes cartes categories illustrees comme frontend public principal.

Fait:
- `CategoryGrid` utilise les images par defaut en public.
- Un mode `variant="simple"` conserve l'ancien rendu leger a icones pour fallback/admin.
- `npm run dev` lance Next en webpack pour eviter le crash Turbopack local lie aux symlinks `.sandbox_home`.
- Port Maxi separe: `http://127.0.0.1:3001`.

Regressions:
- `npm run typecheck`: OK
- `npm run lint`: OK
- `npm run build`: OK
- `/categories`: HTTP 200, images detectees

Notes:
- Jarvis/OpenWebUI n'a pas ete touche.
- Les secrets `.env` n'ont pas ete affiches.
