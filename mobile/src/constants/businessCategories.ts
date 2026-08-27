export type BusinessCategory = {
  slug: string;
  name: string;
};

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { slug: "retail", name: "Retail & Shop" },
  { slug: "grocery", name: "Grocery & Supermarket" },
  { slug: "fashion", name: "Fashion & Clothing" },
  { slug: "electronics", name: "Electronics & Phones" },
  { slug: "restaurant", name: "Restaurant & Food" },
  { slug: "cafe", name: "Cafe & Bakery" },
  { slug: "bar-lounge", name: "Bar, Lounge & Nightlife" },
  { slug: "beauty", name: "Beauty, Salon & Spa" },
  { slug: "health", name: "Health, Clinic & Pharmacy" },
  { slug: "fitness", name: "Gym & Fitness" },
  { slug: "education", name: "Education & Training" },
  { slug: "professional", name: "Professional Services" },
  { slug: "legal-finance", name: "Legal, Accounting & Finance" },
  { slug: "technology", name: "Technology & IT" },
  { slug: "construction", name: "Construction & Real Estate" },
  { slug: "automotive", name: "Automotive & Auto Repair" },
  { slug: "logistics", name: "Logistics & Transportation" },
  { slug: "agriculture", name: "Agriculture & Farming" },
  { slug: "manufacturing", name: "Manufacturing" },
  { slug: "wholesale", name: "Wholesale & Distribution" },
  { slug: "hospitality", name: "Hotel & Hospitality" },
  { slug: "events", name: "Events, Photo & Video" },
  { slug: "entertainment", name: "Entertainment & Arts" },
  { slug: "media", name: "Media & Advertising" },
  { slug: "home-services", name: "Home & Household Services" },
  { slug: "nonprofit", name: "Non-Profit & NGO" },
  { slug: "service", name: "General Services" },
  { slug: "other", name: "Other" },
];

export function businessCategoryLabel(slug: string): string {
  return BUSINESS_CATEGORIES.find((item) => item.slug === slug)?.name || slug;
}
