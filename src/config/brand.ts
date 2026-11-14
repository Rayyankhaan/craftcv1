export interface BrandConfig {
  name: string;
  tagline: string;
  supportEmail: string;
  currencySymbol: string;
  currencyCode: string;
  defaultPremiumPriceInr: number;
}

export const BRAND_CONFIG: BrandConfig = {
  name: import.meta.env.VITE_BRAND_NAME || 'CraftCV',
  tagline: 'Career intelligence and precision resume engineering.',
  supportEmail: 'support@craftcv.in',
  currencySymbol: '₹',
  currencyCode: 'INR',
  defaultPremiumPriceInr: 99,
};
