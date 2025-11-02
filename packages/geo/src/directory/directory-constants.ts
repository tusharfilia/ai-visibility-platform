/**
 * Directory Constants
 * Defines directory domains, types, and NAP field mappings
 */

export type DirectoryType = 'gbp' | 'bing_places' | 'apple_business' | 'g2' | 'capterra' | 'trustpilot' | 'yelp';

export interface DirectoryConfig {
  type: DirectoryType;
  name: string;
  domain: string;
  napFields: {
    name: string[];
    address: string[];
    phone: string[];
  };
}

export const DIRECTORY_CONFIGS: Record<DirectoryType, DirectoryConfig> = {
  gbp: {
    type: 'gbp',
    name: 'Google Business Profile',
    domain: 'google.com/maps',
    napFields: {
      name: ['name', 'business_name'],
      address: ['address', 'street_address', 'location'],
      phone: ['phone', 'phone_number', 'telephone'],
    },
  },
  bing_places: {
    type: 'bing_places',
    name: 'Bing Places',
    domain: 'bing.com/maps',
    napFields: {
      name: ['name', 'business_name'],
      address: ['address', 'street_address', 'location'],
      phone: ['phone', 'phone_number', 'telephone'],
    },
  },
  apple_business: {
    type: 'apple_business',
    name: 'Apple Business Connect',
    domain: 'apple.com/maps',
    napFields: {
      name: ['name', 'business_name'],
      address: ['address', 'street_address', 'location'],
      phone: ['phone', 'phone_number', 'telephone'],
    },
  },
  g2: {
    type: 'g2',
    name: 'G2',
    domain: 'g2.com',
    napFields: {
      name: ['name', 'company_name'],
      address: ['address', 'headquarters'],
      phone: ['phone'],
    },
  },
  capterra: {
    type: 'capterra',
    name: 'Capterra',
    domain: 'capterra.com',
    napFields: {
      name: ['name', 'vendor_name'],
      address: ['address'],
      phone: ['phone'],
    },
  },
  trustpilot: {
    type: 'trustpilot',
    name: 'Trustpilot',
    domain: 'trustpilot.com',
    napFields: {
      name: ['name', 'company_name'],
      address: ['address'],
      phone: ['phone'],
    },
  },
  yelp: {
    type: 'yelp',
    name: 'Yelp',
    domain: 'yelp.com',
    napFields: {
      name: ['name', 'business_name'],
      address: ['address', 'location'],
      phone: ['phone', 'phone_number'],
    },
  },
};

export const ALL_DIRECTORY_TYPES: DirectoryType[] = Object.keys(DIRECTORY_CONFIGS) as DirectoryType[];


