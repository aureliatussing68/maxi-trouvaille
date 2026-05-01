export default function Loading() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 py-16">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="grid size-20 place-items-center rounded-2xl border border-line bg-brand text-2xl font-black shadow-sm">
          MT
        </div>
        <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-teal">
          Maxi Trouvaille
        </p>
        <p className="mt-2 text-base font-semibold text-foreground">
          Chargement des bonnes affaires...
        </p>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}
