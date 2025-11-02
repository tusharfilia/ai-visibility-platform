export interface TierLimits {
  FREE: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
  INSIGHTS: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
  COPILOT: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
}

export const WORKSPACE_TIER_LIMITS: TierLimits = {
  FREE: {
    requestsPerHour: 100,
    scansPerDay: 10,
    members: 3,
    storageGB: 1
  },
  INSIGHTS: {
    requestsPerHour: 500,
    scansPerDay: 100,
    members: 10,
    storageGB: 10
  },
  COPILOT: {
    requestsPerHour: 2000,
    scansPerDay: 1000,
    members: 50,
    storageGB: 100
  }
};

export interface RateLimitInfo {
  tier: keyof TierLimits;
  limits: TierLimits[keyof TierLimits];
  currentUsage: {
    requestsThisHour: number;
    scansToday: number;
    memberCount: number;
    storageUsedGB: number;
  };
  remaining: {
    requestsThisHour: number;
    scansToday: number;
    members: number;
    storageGB: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Calculate remaining limits for workspace
 */
export function calculateRemainingLimits(
  tier: keyof TierLimits,
  currentUsage: RateLimitInfo['currentUsage']
): RateLimitInfo['remaining'] {
  const limits = WORKSPACE_TIER_LIMITS[tier];
  
  return {
    requestsThisHour: Math.max(0, limits.requestsPerHour - currentUsage.requestsThisHour),
    scansToday: Math.max(0, limits.scansPerDay - currentUsage.scansToday),
    members: Math.max(0, limits.members - currentUsage.memberCount),
    storageGB: Math.max(0, limits.storageGB - currentUsage.storageUsedGB)
  };
}

/**
 * Check if action is allowed based on limits
 */
export function isActionAllowed(
  tier: keyof TierLimits,
  action: 'scan' | 'member' | 'storage',
  currentUsage: RateLimitInfo['currentUsage'],
  count: number = 1
): RateLimitResult {
  const limits = WORKSPACE_TIER_LIMITS[tier];
  
  switch (action) {
    case 'scan':
      if (currentUsage.scansToday + count > limits.scansPerDay) {
        return {
          allowed: false,
          reason: `Daily scan limit exceeded (${limits.scansPerDay})`
        };
      }
      break;

    case 'member':
      if (currentUsage.memberCount + count > limits.members) {
        return {
          allowed: false,
          reason: `Member limit exceeded (${limits.members})`
        };
      }
      break;

    case 'storage':
      if (currentUsage.storageUsedGB + count > limits.storageGB) {
        return {
          allowed: false,
          reason: `Storage limit exceeded (${limits.storageGB}GB)`
        };
      }
      break;
  }

  return { allowed: true };
}

/**
 * Get tier upgrade recommendations
 */
export function getUpgradeRecommendations(
  tier: keyof TierLimits,
  currentUsage: RateLimitInfo['currentUsage']
): string[] {
  const recommendations: string[] = [];
  const limits = WORKSPACE_TIER_LIMITS[tier];
  
  // Check if approaching limits
  const usagePercentages = {
    scans: (currentUsage.scansToday / limits.scansPerDay) * 100,
    members: (currentUsage.memberCount / limits.members) * 100,
    storage: (currentUsage.storageUsedGB / limits.storageGB) * 100
  };

  if (usagePercentages.scans > 80) {
    recommendations.push('Consider upgrading to increase daily scan limits');
  }

  if (usagePercentages.members > 80) {
    recommendations.push('Consider upgrading to add more team members');
  }

  if (usagePercentages.storage > 80) {
    recommendations.push('Consider upgrading to increase storage capacity');
  }

  return recommendations;
}

/**
 * Get tier comparison data
 */
export function getTierComparison(): Array<{
  tier: keyof TierLimits;
  limits: TierLimits[keyof TierLimits];
  features: string[];
  price?: number;
}> {
  return [
    {
      tier: 'FREE',
      limits: WORKSPACE_TIER_LIMITS.FREE,
      features: [
        'Basic AI visibility tracking',
        'Up to 3 team members',
        '10 scans per day',
        '1GB storage',
        'Email support'
      ],
      price: 0
    },
    {
      tier: 'INSIGHTS',
      limits: WORKSPACE_TIER_LIMITS.INSIGHTS,
      features: [
        'Advanced analytics & insights',
        'Up to 10 team members',
        '100 scans per day',
        '10GB storage',
        'Priority support',
        'Custom reports',
        'API access'
      ],
      price: 99
    },
    {
      tier: 'COPILOT',
      limits: WORKSPACE_TIER_LIMITS.COPILOT,
      features: [
        'AI-powered automation',
        'Up to 50 team members',
        '1000 scans per day',
        '100GB storage',
        'Dedicated support',
        'White-label options',
        'Advanced integrations',
        'Custom workflows'
      ],
      price: 299
    }
  ];
}

