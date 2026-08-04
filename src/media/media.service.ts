import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';
import { ImageKitAuthResponseDto } from './dto/imagekit-auth-response.dto';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class MediaService {
  private readonly imagekit: ImageKit | null;

  constructor(private readonly config: ConfigService) {
    const publicKey = this.config.get<string>('IMAGEKIT_PUBLIC_KEY')?.trim();
    const privateKey = this.config.get<string>('IMAGEKIT_PRIVATE_KEY')?.trim();
    const urlEndpoint = this.config
      .get<string>('IMAGEKIT_URL_ENDPOINT')
      ?.trim();

    if (publicKey && privateKey && urlEndpoint) {
      this.imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });
    } else {
      this.imagekit = null;
    }
  }

  getAuthParams(): ImageKitAuthResponseDto {
    const client = this.requireClient();
    const auth = client.getAuthenticationParameters();
    return {
      token: auth.token,
      expire: auth.expire,
      signature: auth.signature,
      publicKey: this.config.getOrThrow<string>('IMAGEKIT_PUBLIC_KEY').trim(),
      urlEndpoint: this.config
        .getOrThrow<string>('IMAGEKIT_URL_ENDPOINT')
        .trim(),
    };
  }

  async uploadBuffer(
    file: Express.Multer.File,
    folder = '/pantri/packages',
  ): Promise<UploadResponseDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

    const client = this.requireClient();
    const result = await client.upload({
      file: file.buffer,
      fileName: file.originalname || `upload-${Date.now()}`,
      folder,
      useUniqueFileName: true,
    });

    return {
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      thumbnailUrl: result.thumbnailUrl ?? null,
    };
  }

  getShareBaseUrl(): string {
    return (
      this.config.get<string>('APP_SHARE_BASE_URL')?.trim().replace(/\/$/, '') ??
      'https://pantri.app'
    );
  }

  buildShareBannerUrl(coverImageUrl: string, packageName: string): string {
    const endpoint = this.config.get<string>('IMAGEKIT_URL_ENDPOINT')?.trim();
    if (!endpoint || !coverImageUrl.includes('imagekit.io')) {
      return coverImageUrl;
    }

    const encoded = encodeURIComponent(packageName.slice(0, 40));
    const separator = coverImageUrl.includes('?') ? '&' : '?';
    return `${coverImageUrl}${separator}tr=w-1200,h-630,fo-auto,l-text,i-${encoded},co-FFFFFF,fs-42,l-end`;
  }

  private requireClient(): ImageKit {
    if (!this.imagekit) {
      throw new ServiceUnavailableException(
        'ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.',
      );
    }
    return this.imagekit;
  }
}
