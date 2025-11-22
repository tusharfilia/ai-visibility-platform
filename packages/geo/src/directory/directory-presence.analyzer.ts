/**
 * Directory Presence Analyzer Service
 * Analyzes directory listing presence, NAP consistency, and listing quality
 */

import { Injectable } from '@nestjs/common';
import { DIRECTORY_CONFIGS, DirectoryType, ALL_DIRECTORY_TYPES } from './directory-constants';
import { Pool } from 'pg';

export interface DirectoryListing {
  type: DirectoryType;
  name: string;
  claimed: boolean;
  nap?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  quality?: {
    completeness: number;
    reviews: number;
    photos: number;
    score: number; // 0-100
  };
}

export interface DirectoryPresenceReport {
  coverage: number;           // 0-100%
  napConsistency: number;      // 0-100%
  listingQuality: number;      // 0-100 average
  missing: string[];          // Directory types not claimed
  listings: DirectoryListing[];
  recommendations: string[];
}

@Injectable()
export class DirectoryPresenceAnalyzerService {
  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Analyze directory presence for workspace
   */
  async analyzeDirectoryPresence(workspaceId: string): Promise<DirectoryPresenceReport> {
    try {
      // Get workspace profile for NAP
      const profileResult = await this.dbPool.query(
        'SELECT * FROM "WorkspaceProfile" WHERE "workspaceId" = $1',
        [workspaceId]
      );
      
      const profile = profileResult.rows[0];
      if (!profile) {
        return {
          coverage: 0,
          napConsistency: 0,
          listingQuality: 0,
          missing: ALL_DIRECTORY_TYPES,
          listings: [],
          recommendations: ['Create workspace profile with NAP information'],
        };
      }

      // Get directory submissions
      const submissionsResult = await this.dbPool.query(
        'SELECT * FROM "DirectorySubmission" WHERE "workspaceId" = $1',
        [workspaceId]
      );
      const submissions = submissionsResult.rows;

      // Get citations that are from directories
      const citationsResult = await this.dbPool.query(`
        SELECT c.*, pr."workspaceId"
        FROM "citations" c
        INNER JOIN "answers" a ON c."answerId" = a.id
        INNER JOIN "prompt_runs" pr ON a."promptRunId" = pr.id
        WHERE pr."workspaceId" = $1 AND c."sourceType" = 'directory'
      `, [workspaceId]);

      // Build listings
      const listings = await this.buildListings(profile, submissions, citationsResult.rows);

      // Calculate metrics
      const coverage = this.calculateCoverage(listings);
      const napConsistency = this.calculateNAPConsistency(listings, profile);
      const listingQuality = this.calculateAverageQuality(listings);
      const missing = this.identifyMissingDirectories(listings);

      // Generate recommendations
      const recommendations = this.generateRecommendations(listings, missing, coverage, napConsistency);

      return {
        coverage,
        napConsistency,
        listingQuality,
        missing,
        listings,
        recommendations,
      };
    } catch (error) {
      console.error(`Error analyzing directory presence for ${workspaceId}:`, error);
      return {
        coverage: 0,
        napConsistency: 0,
        listingQuality: 0,
        missing: ALL_DIRECTORY_TYPES,
        listings: [],
        recommendations: ['Error analyzing directory presence'],
      };
    }
  }

  /**
   * Build directory listings
   */
  private async buildListings(
    profile: any,
    submissions: any[],
    citations: any[]
  ): Promise<DirectoryListing[]> {
    const listings: DirectoryListing[] = [];

    for (const directoryType of ALL_DIRECTORY_TYPES) {
      const config = DIRECTORY_CONFIGS[directoryType];
      const submission = submissions.find(s => s.directory === directoryType);
      const citation = citations.find(c => c.directoryType === directoryType);

      const claimed = !!submission && submission.status === 'verified';
      
      const listing: DirectoryListing = {
        type: directoryType,
        name: config.name,
        claimed,
        nap: claimed ? {
          name: profile.businessName,
          address: profile.address,
          phone: profile.phone,
        } : undefined,
        quality: claimed ? this.assessListingQuality(submission, citation) : undefined,
      };

      listings.push(listing);
    }

    return listings;
  }

  /**
   * Check directory listing (verify presence)
   */
  async checkDirectoryListing(workspaceId: string, directoryType: DirectoryType): Promise<boolean> {
    const submissionResult = await this.dbPool.query(
      'SELECT * FROM "DirectorySubmission" WHERE "workspaceId" = $1 AND "directory" = $2 AND "status" = $3',
      [workspaceId, directoryType, 'verified']
    );

    return submissionResult.rows.length > 0;
  }

  /**
   * Verify NAP consistency across directories
   */
  private calculateNAPConsistency(listings: DirectoryListing[], profile: any): number {
    const claimedListings = listings.filter(l => l.claimed && l.nap);
    if (claimedListings.length === 0) return 0;

    const profileNAP = {
      name: (profile.businessName || '').toLowerCase().trim(),
      address: (profile.address || '').toLowerCase().trim(),
      phone: (profile.phone || '').replace(/\D/g, ''), // Remove non-digits
    };

    let consistencyScore = 0;
    let totalChecks = 0;

    for (const listing of claimedListings) {
      if (!listing.nap) continue;

      const listingNAP = {
        name: (listing.nap.name || '').toLowerCase().trim(),
        address: (listing.nap.address || '').toLowerCase().trim(),
        phone: (listing.nap.phone || '').replace(/\D/g, ''),
      };

      // Check name consistency
      if (listingNAP.name === profileNAP.name) consistencyScore++;
      totalChecks++;

      // Check address consistency
      if (listingNAP.address === profileNAP.address) consistencyScore++;
      totalChecks++;

      // Check phone consistency
      if (listingNAP.phone === profileNAP.phone) consistencyScore++;
      totalChecks++;
    }

    return totalChecks > 0 ? Math.round((consistencyScore / totalChecks) * 100) : 0;
  }

  /**
   * Assess listing quality
   */
  private assessListingQuality(submission: any, citation: any): DirectoryListing['quality'] {
    let completeness = 0;
    if (submission.verifiedAt) completeness += 25;
    // In production, check for reviews, photos, etc.
    const reviews = 0; // Would come from directory API
    const photos = 0; // Would come from directory API
    if (reviews > 0) completeness += 25;
    if (photos > 0) completeness += 25;
    if (citation) completeness += 25; // Found in citations

    return {
      completeness,
      reviews,
      photos,
      score: completeness,
    };
  }

  /**
   * Identify missing directories
   */
  private identifyMissingDirectories(listings: DirectoryListing[]): string[] {
    return listings.filter(l => !l.claimed).map(l => l.type);
  }

  /**
   * Calculate coverage percentage
   */
  private calculateCoverage(listings: DirectoryListing[]): number {
    const claimedCount = listings.filter(l => l.claimed).length;
    return Math.round((claimedCount / ALL_DIRECTORY_TYPES.length) * 100);
  }

  /**
   * Calculate average listing quality
   */
  private calculateAverageQuality(listings: DirectoryListing[]): number {
    const qualities = listings.filter(l => l.quality).map(l => l.quality!.score);
    if (qualities.length === 0) return 0;
    return Math.round(qualities.reduce((sum, q) => sum + q, 0) / qualities.length);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    listings: DirectoryListing[],
    missing: string[],
    coverage: number,
    napConsistency: number
  ): string[] {
    const recommendations: string[] = [];

    if (missing.length > 0) {
      const missingNames = missing.map(t => DIRECTORY_CONFIGS[t as DirectoryType].name).join(', ');
      recommendations.push(`Claim listings on: ${missingNames}`);
    }

    if (coverage < 70) {
      recommendations.push(`Directory coverage is ${coverage}% - aim for at least 70%`);
    }

    if (napConsistency < 90) {
      recommendations.push(`NAP consistency is ${napConsistency}% - ensure Name, Address, Phone match across all directories`);
    }

    return recommendations;
  }
}


