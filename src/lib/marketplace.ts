export type UserRole = "admin" | "seller" | "customer";

export type ProductSource = "internal" | "seller_listing";

export type ListingStatus = "draft" | "pending_review" | "approved" | "rejected";

export type MarketplaceActor = {
  id: string;
  role: UserRole;
  displayName: string;
};

export type SellerListingMeta = {
  sellerId: string;
  status: ListingStatus;
  commissionRate: number;
};

export const marketplaceRoles: Record<UserRole, string> = {
  admin: "Administrateur",
  seller: "Vendeur",
  customer: "Client",
};

// Future marketplace:
// - "internal" designates products sold directly by Maxi Trouvaille.
// - "seller_listing" will designate listings submitted by external sellers.
// - seller_listing items must stay pending_review until an admin approves them.
// - commissionRate is planned for a later Stripe Connect or marketplace payment flow.
export const marketplaceRoadmap = {
  defaultCommissionRate: 0.1,
  moderationRequired: true,
  roles: ["admin", "seller", "customer"] as UserRole[],
};
