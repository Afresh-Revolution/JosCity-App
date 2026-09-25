const STORE_REVIEW_EMAILS = [
  "play.personal@joscity.com",
  "play.business@joscity.com",
  "play.agent@joscity.com",
];

export function isStoreReviewEmail(email: string | null | undefined): boolean {
  return STORE_REVIEW_EMAILS.includes(String(email || "").trim().toLowerCase());
}
