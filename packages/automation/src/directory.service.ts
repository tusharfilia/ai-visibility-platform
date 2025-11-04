import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface DirectorySubmission {
  id: string;
  workspaceId: string;
  directory: string;
  status: 'pending' | 'submitted' | 'verified' | 'failed';
  submittedAt?: Date;
  verifiedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
  description: string;
  hours: Record<string, string>;
  categories: string[];
  images?: string[];
}

export interface DirectoryConfig {
  name: string;
  apiEndpoint: string;
  requiresAuth: boolean;
  authType?: 'oauth' | 'api_key' | 'basic';
  fields: string[];
  supportedFields: string[];
}

@Injectable()
export class DirectoryAutomationService {
  private directoryConfigs: DirectoryConfig[] = [
    {
      name: 'google',
      apiEndpoint: 'https://mybusiness.googleapis.com/v4',
      requiresAuth: true,
      authType: 'oauth',
      fields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
      supportedFields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
    },
    {
      name: 'yelp',
      apiEndpoint: 'https://api.yelp.com/v3',
      requiresAuth: true,
      authType: 'api_key',
      fields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
      supportedFields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
    },
    {
      name: 'foursquare',
      apiEndpoint: 'https://api.foursquare.com/v2',
      requiresAuth: true,
      authType: 'oauth',
      fields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
      supportedFields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
    },
    {
      name: 'facebook',
      apiEndpoint: 'https://graph.facebook.com/v18.0',
      requiresAuth: true,
      authType: 'oauth',
      fields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
      supportedFields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
    },
    {
      name: 'apple',
      apiEndpoint: 'https://mapsconnect.apple.com/api',
      requiresAuth: true,
      authType: 'oauth',
      fields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
      supportedFields: ['name', 'address', 'phone', 'website', 'description', 'hours', 'categories'],
    },
  ];

  constructor(private configService: ConfigService) {}

  /**
   * Submit business to directory
   */
  async submitToDirectory(
    workspaceId: string,
    directory: string,
    businessInfo: BusinessInfo,
    authToken?: string
  ): Promise<DirectorySubmission> {
    const config = this.directoryConfigs.find(c => c.name === directory);
    if (!config) {
      throw new Error(`Unsupported directory: ${directory}`);
    }

    const submission: DirectorySubmission = {
      id: this.generateId(),
      workspaceId,
      directory,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Validate business info
      this.validateBusinessInfo(businessInfo, config);

      // Submit to directory
      const result = await this.submitToDirectoryAPI(directory, businessInfo, authToken);
      
      submission.status = 'submitted';
      submission.submittedAt = new Date();
      submission.updatedAt = new Date();

      // TODO: Store submission in database
      console.log(`Successfully submitted to ${directory}:`, result);

      return submission;
    } catch (error) {
      submission.status = 'failed';
      submission.errorMessage = error.message;
      submission.updatedAt = new Date();

      // TODO: Store failed submission in database
      console.error(`Failed to submit to ${directory}:`, error);

      return submission;
    }
  }

  /**
   * Submit to multiple directories in batch
   */
  async submitToMultipleDirectories(
    workspaceId: string,
    directories: string[],
    businessInfo: BusinessInfo,
    authTokens: Record<string, string> = {}
  ): Promise<DirectorySubmission[]> {
    const submissions: DirectorySubmission[] = [];

    // Submit to each directory
    for (const directory of directories) {
      try {
        const submission = await this.submitToDirectory(
          workspaceId,
          directory,
          businessInfo,
          authTokens[directory]
        );
        submissions.push(submission);
      } catch (error) {
        console.error(`Failed to submit to ${directory}:`, error);
        submissions.push({
          id: this.generateId(),
          workspaceId,
          directory,
          status: 'failed',
          errorMessage: error.message,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return submissions;
  }

  /**
   * Get submission status
   */
  async getSubmissionStatus(submissionId: string): Promise<DirectorySubmission | null> {
    // TODO: Implement database lookup
    console.log(`Getting status for submission ${submissionId}`);
    return null;
  }

  /**
   * Verify submission
   */
  async verifySubmission(submissionId: string): Promise<boolean> {
    // TODO: Implement verification logic
    console.log(`Verifying submission ${submissionId}`);
    return true;
  }

  /**
   * Get supported directories
   */
  getSupportedDirectories(): DirectoryConfig[] {
    return this.directoryConfigs;
  }

  /**
   * Get directory configuration
   */
  getDirectoryConfig(directory: string): DirectoryConfig | null {
    return this.directoryConfigs.find(c => c.name === directory) || null;
  }

  /**
   * Submit to directory API
   */
  private async submitToDirectoryAPI(
    directory: string,
    businessInfo: BusinessInfo,
    authToken?: string
  ): Promise<any> {
    const config = this.getDirectoryConfig(directory);
    if (!config) {
      throw new Error(`Directory config not found: ${directory}`);
    }

    // Mock implementation - in real implementation, you'd call actual APIs
    switch (directory) {
      case 'google':
        return this.submitToGoogle(businessInfo, authToken);
      case 'yelp':
        return this.submitToYelp(businessInfo, authToken);
      case 'foursquare':
        return this.submitToFoursquare(businessInfo, authToken);
      case 'facebook':
        return this.submitToFacebook(businessInfo, authToken);
      case 'apple':
        return this.submitToApple(businessInfo, authToken);
      default:
        throw new Error(`Submission not implemented for ${directory}`);
    }
  }

  /**
   * Submit to Google My Business
   */
  private async submitToGoogle(businessInfo: BusinessInfo, authToken?: string): Promise<any> {
    if (!authToken) {
      throw new Error('Google My Business requires OAuth authentication');
    }

    // Mock implementation
    return {
      locationId: 'mock-location-id',
      status: 'pending_review',
      message: 'Business listing submitted for review',
    };
  }

  /**
   * Submit to Yelp
   */
  private async submitToYelp(businessInfo: BusinessInfo, authToken?: string): Promise<any> {
    if (!authToken) {
      throw new Error('Yelp requires API key authentication');
    }

    // Mock implementation
    return {
      businessId: 'mock-business-id',
      status: 'pending',
      message: 'Business listing submitted to Yelp',
    };
  }

  /**
   * Submit to Foursquare
   */
  private async submitToFoursquare(businessInfo: BusinessInfo, authToken?: string): Promise<any> {
    if (!authToken) {
      throw new Error('Foursquare requires OAuth authentication');
    }

    // Mock implementation
    return {
      venueId: 'mock-venue-id',
      status: 'pending',
      message: 'Venue submitted to Foursquare',
    };
  }

  /**
   * Submit to Facebook
   */
  private async submitToFacebook(businessInfo: BusinessInfo, authToken?: string): Promise<any> {
    if (!authToken) {
      throw new Error('Facebook requires OAuth authentication');
    }

    // Mock implementation
    return {
      pageId: 'mock-page-id',
      status: 'pending',
      message: 'Business page created on Facebook',
    };
  }

  /**
   * Submit to Apple Maps
   */
  private async submitToApple(businessInfo: BusinessInfo, authToken?: string): Promise<any> {
    if (!authToken) {
      throw new Error('Apple Maps requires OAuth authentication');
    }

    // Mock implementation
    return {
      placeId: 'mock-place-id',
      status: 'pending',
      message: 'Place submitted to Apple Maps',
    };
  }

  /**
   * Validate business information
   */
  private validateBusinessInfo(businessInfo: BusinessInfo, config: DirectoryConfig): void {
    const requiredFields = ['name', 'address', 'phone'];
    
    for (const field of requiredFields) {
      if (!businessInfo[field]) {
        throw new Error(`Required field missing: ${field}`);
      }
    }

    // Validate phone number format
    if (!this.isValidPhoneNumber(businessInfo.phone)) {
      throw new Error('Invalid phone number format');
    }

    // Validate website URL
    if (businessInfo.website && !this.isValidUrl(businessInfo.website)) {
      throw new Error('Invalid website URL format');
    }
  }

  /**
   * Validate phone number
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get OAuth URLs for directory authentication
   */
  getOAuthUrls(directory: string): { authUrl: string; redirectUrl: string } {
    const baseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:8080');
    
    const oauthConfigs = {
      google: {
        authUrl: `https://accounts.google.com/oauth/authorize?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${baseUrl}/auth/google/callback&scope=https://www.googleapis.com/auth/business.manage&response_type=code`,
        redirectUrl: `${baseUrl}/auth/google/callback`,
      },
      facebook: {
        authUrl: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${baseUrl}/auth/facebook/callback&scope=pages_manage_metadata,pages_read_engagement&response_type=code`,
        redirectUrl: `${baseUrl}/auth/facebook/callback`,
      },
      foursquare: {
        authUrl: `https://foursquare.com/oauth2/authenticate?client_id=${process.env.FOURSQUARE_CLIENT_ID}&redirect_uri=${baseUrl}/auth/foursquare/callback&response_type=code`,
        redirectUrl: `${baseUrl}/auth/foursquare/callback`,
      },
      apple: {
        authUrl: `https://appleid.apple.com/auth/authorize?client_id=${process.env.APPLE_CLIENT_ID}&redirect_uri=${baseUrl}/auth/apple/callback&response_type=code&scope=name%20email`,
        redirectUrl: `${baseUrl}/auth/apple/callback`,
      },
    };

    return oauthConfigs[directory] || { authUrl: '', redirectUrl: '' };
  }
}

