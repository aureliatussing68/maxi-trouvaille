// Squelette de chargement : on montre tout de suite la structure de la page
// (en-tête, bloc héros, grille de cartes) au lieu d'un écran plein page avec
// le logo qui masque tout pendant plusieurs secondes.
export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Chargement de la page">
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
