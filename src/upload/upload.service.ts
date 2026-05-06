import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface SignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
}

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private useS3: boolean;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || 'caribbean-wheels';
    this.useS3 = !!this.configService.get<string>('AWS_ACCESS_KEY_ID');

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
        },
      });
    }
  }

  async getSignedUploadUrl(key: string, contentType: string): Promise<SignedUploadResult> {
    if (!this.useS3) {
      return this.getMockSignedUrl(key);
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });

    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }

  private getMockSignedUrl(key: string): SignedUploadResult {
    const baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    return {
      uploadUrl: `${baseUrl}/mock-upload/${key}`,
      publicUrl: `${baseUrl}/uploads/${key}`,
    };
  }
}
