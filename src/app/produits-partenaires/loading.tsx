// /produits-partenaires est un segment terminal : aucune route enfant ne peut
// appeler notFound(). Le squelette peut donc y rester sans casser les codes
// HTTP. Voir l'explication complete en tete de src/components/PageSkeleton.tsx.
export { default } from "@/components/PageSkeleton";
