import type { MarketplaceListing } from "../api/marketplace";

/** Build a searchable blob of listing + seller/contact/location fields. */
export function listingSearchText(item: MarketplaceListing): string {
  const contact = item.contact || {};
  return [
    item.title,
    item.description,
    item.category,
    item.unit,
    item.listing_kind,
    item.pricing_model,
    item.duration_note,
    item.service_location,
    item.service_area,
    item.availability_note,
    item.seller_name,
    contact.name,
    contact.phone,
    contact.email,
    contact.whatsapp,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Match when every word in the query appears somewhere in the listing fields
 * (title, shop name, location, phone, email, category, etc.).
 */
export function listingMatchesQuery(item: MarketplaceListing, query: string): boolean {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = listingSearchText(item);
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => haystack.includes(token));
}
