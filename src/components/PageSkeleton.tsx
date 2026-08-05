/**
 * Squelette de chargement : on montre tout de suite la structure de la page
 * (en-tête, bloc héros, grille de cartes) au lieu d'un écran plein page avec
 * le logo qui masque tout pendant plusieurs secondes.
 *
 * ---------------------------------------------------------------------------
 *  REGLE A NE PAS OUBLIER — pourquoi ce squelette n'est plus a la racine
 * ---------------------------------------------------------------------------
 * Ce fichier etait `src/app/loading.tsx`, donc actif sur TOUTES les pages du
 * site. Consequence mesuree le 05/08/2026 : une adresse inexistante comme
 * /produit/nimporte-quoi repondait 200 au lieu de 404.
 *
 * Le mecanisme : un `loading.tsx` place a la racine enveloppe toutes les pages
 * dans une frontiere de suspension. Next.js commence alors a envoyer la reponse
 * (le squelette) AVANT que la page ait fini de decider s'il y a quelque chose a
 * afficher. Quand la page appelle ensuite notFound(), les en-tetes sont deja
 * parties avec un code 200 : le visiteur voit bien la page « introuvable »,
 * mais Google, lui, enregistre une page valide. C'est ce qu'on appelle un
 * « soft 404 », et c'est ce qui faisait rester dans l'index les fiches qu'on
 * venait justement d'archiver.
 *
 * D'ou la regle : un `loading.tsx` ne se pose QUE sur un segment terminal, qui
 * n'a aucune route enfant susceptible d'appeler notFound() ou redirect().
 * Aujourd'hui : /boutique et /produits-partenaires, et c'est tout.
 * `scripts/automation/audit_loading_boundaries.mjs` verifie cette regle.
 *
 * Ne remets pas ce fichier en `src/app/loading.tsx` : le confort d'affichage
 * gagne ne vaut pas la perte du bon code HTTP sur 389 adresses de fiches.
 */
export default function PageSkeleton() {
  return (
    <div
      className="container-page py-8"
      aria-busy="true"
      aria-label="Chargement de la page"
    >
      {/* En-tête (titre + sous-titre) */}
      <div className="animate-pulse">
        <div className="h-4 w-40 rounded-md bg-line" />
        <div className="mt-3 h-8 w-72 max-w-full rounded-md bg-line" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-md bg-line/70" />
      </div>

      {/* Bloc héros */}
      <div className="mt-8 animate-pulse rounded-lg border border-line bg-[#f6f1e8]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <div className="h-4 w-32 rounded-md bg-line" />
            <div className="mt-4 h-7 w-full max-w-md rounded-md bg-line" />
            <div className="mt-3 h-7 w-2/3 rounded-md bg-line" />
            <div className="mt-5 h-4 w-full max-w-sm rounded-md bg-line/70" />
            <div className="mt-6 flex gap-3">
              <div className="h-12 w-40 rounded-md bg-line" />
              <div className="h-12 w-40 rounded-md bg-line/70" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-square rounded-lg bg-line/80" />
            <div className="aspect-square rounded-lg bg-line/60" />
            <div className="aspect-square rounded-lg bg-line/60" />
            <div className="aspect-square rounded-lg bg-line/80" />
          </div>
        </div>
      </div>

      {/* Grille de 8 cartes produits */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse overflow-hidden rounded-lg border border-line bg-paper shadow-sm"
          >
            <div className="aspect-square w-full bg-line/70" />
            <div className="grid gap-3 p-4">
              <div className="h-4 w-3/4 rounded-md bg-line" />
              <div className="h-4 w-1/2 rounded-md bg-line/70" />
              <div className="h-6 w-24 rounded-md bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
