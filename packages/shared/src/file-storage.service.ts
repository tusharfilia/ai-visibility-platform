import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  expiresIn?: number; // seconds
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
  contentType?: string;
}

@Injectable()
export class FileStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT');
    this.bucketName = this.configService.get<string>('CLOUDFLARE_R2_BUCKET', 'ai-visibility-assets');

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error('Cloudflare R2 credentials are required');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Upload file to Cloudflare R2
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
      });

      const result = await this.s3Client.send(command);
      
      return {
        key,
        url: this.getPublicUrl(key),
        size: buffer.length,
        contentType: options.contentType || 'application/octet-stream',
        etag: result.ETag || '',
      };
    } catch (error) {
      console.error('File upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Upload workspace-specific file
   */
  async uploadWorkspaceFile(
    workspaceId: string,
    category: string,
    filename: string,
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const key = `workspaces/${workspaceId}/${category}/${filename}`;
    return this.uploadFile(key, buffer, options);
  }

  /**
   * Upload report file
   */
  async uploadReport(
    workspaceId: string,
    reportType: string,
    format: 'pdf' | 'docx' | 'csv',
    buffer: Buffer
  ): Promise<UploadResult> {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${reportType}-report-${timestamp}.${format}`;
    
    return this.uploadWorkspaceFile(
      workspaceId,
      'reports',
      filename,
      buffer,
      {
        contentType: this.getContentType(format),
        metadata: {
          reportType,
          format,
          generatedAt: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Upload content export
   */
  async uploadContentExport(
    workspaceId: string,
    contentId: string,
    format: 'pdf' | 'docx',
    buffer: Buffer
  ): Promise<UploadResult> {
    const filename = `content-${contentId}.${format}`;
    
    return this.uploadWorkspaceFile(
      workspaceId,
      'exports',
      filename,
      buffer,
      {
        contentType: this.getContentType(format),
        metadata: {
          contentId,
          format,
          exportedAt: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Upload white-label assets
   */
  async uploadWhiteLabelAsset(
    workspaceId: string,
    assetType: 'logo' | 'favicon' | 'background',
    buffer: Buffer,
    originalFilename: string
  ): Promise<UploadResult> {
    const extension = originalFilename.split('.').pop() || 'png';
    const filename = `${assetType}.${extension}`;
    
    return this.uploadWorkspaceFile(
      workspaceId,
      'white-label',
      filename,
      buffer,
      {
        contentType: this.getContentType(extension),
        metadata: {
          assetType,
          originalFilename,
          uploadedAt: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Generate presigned URL for file access
   */
  async getPresignedUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const expiresIn = options.expiresIn || 3600; // 1 hour default
      
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate presigned URL for workspace file
   */
  async getWorkspaceFileUrl(
    workspaceId: string,
    category: string,
    filename: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    const key = `workspaces/${workspaceId}/${category}/${filename}`;
    return this.getPresignedUrl(key, options);
  }

  /**
   * Delete file from storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete workspace file
   */
  async deleteWorkspaceFile(
    workspaceId: string,
    category: string,
    filename: string
  ): Promise<void> {
    const key = `workspaces/${workspaceId}/${category}/${filename}`;
    return this.deleteFile(key);
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(key: string): string {
    const endpoint = this.configService.get<string>('CLOUDFLARE_R2_ENDPOINT');
    return `${endpoint}/${this.bucketName}/${key}`;
  }

  /**
   * Get workspace file public URL
   */
  getWorkspaceFilePublicUrl(
    workspaceId: string,
    category: string,
    filename: string
  ): string {
    const key = `workspaces/${workspaceId}/${category}/${filename}`;
    return this.getPublicUrl(key);
  }

  /**
   * Get content type for file extension
   */
  private getContentType(extension: string): string {
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      csv: 'text/csv',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      txt: 'text/plain',
      json: 'application/json',
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Generate unique filename with timestamp
   */
  generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = originalFilename.split('.').pop() || '';
    const name = originalFilename.replace(/\.[^/.]+$/, '');
    
    return `${name}-${timestamp}-${random}.${extension}`;
  }

  /**
   * Validate file size and type
   */
  validateFile(
    buffer: Buffer,
    allowedTypes: string[],
    maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
  ): { valid: boolean; error?: string } {
    if (buffer.length > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSizeBytes / 1024 / 1024}MB`,
      };
    }

    // Note: In a real implementation, you'd want to check the actual file type
    // using a library like 'file-type' rather than just extension
    
    return { valid: true };
  }
}

