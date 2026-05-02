import { AdminReviewsPanel } from "@/components/AdminReviewsPanel";
import { isAdminModeEnabled } from "@/lib/admin";
import { getAllReviewsForAdmin } from "@/lib/product-reviews";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin avis",
};

export default async function AdminReviewsPage() {
  if (!isAdminModeEnabled()) {
    return (
      <section className="container-page py-12">
        <div className="max-w-2xl rounded-lg border border-line bg-paper p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-rose">Admin desactive</p>
          <h1 className="mt-3 text-3xl font-black">Avis indisponibles</h1>
          <p className="mt-4 text-muted">
            Activez `ADMIN_MODE=true` dans `.env.local`, puis redemarrez le serveur
            local pour moderer les avis.
          </p>
        </div>
      </section>
    );
  }

  const reviews = await getAllReviewsForAdmin();

  return (
    <section className="container-page py-10">
      <div className="mb-7">
        <p className="text-sm font-black uppercase text-teal">Moderation</p>
        <h1 className="mt-2 text-3xl font-black">Avis clients</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Les nouveaux avis restent en attente. Validez uniquement les avis
          utiles et masquez ou supprimez les contenus abusifs.
        </p>
      </div>
      <AdminReviewsPanel initialReviews={reviews} />
    </section>
  );
}
