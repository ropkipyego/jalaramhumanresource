import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const internalEndpoint = process.env.S3_ENDPOINT ?? 'http://minio:9000';
    this.bucket = process.env.S3_BUCKET ?? 'employee-documents';
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: internalEndpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'jalaramhr',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'jalaramhr123',
      },
    });
  }

  getBucket(): string {
    return this.bucket;
  }

  async putObject(path: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { path, bucket: this.bucket };
  }

  async getObject(path: string): Promise<{ stream: Readable; contentType: string }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    if (!result.Body) {
      throw new Error('Object not found');
    }
    return {
      stream: result.Body as Readable,
      contentType: result.ContentType ?? 'application/octet-stream',
    };
  }

  async deleteObject(path: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }),
    );
    return { ok: true, path };
  }
}
