import { IsString, IsIn, Matches } from 'class-validator';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class UploadImageDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Filename can only contain letters, numbers, dots, underscores, and hyphens',
  })
  filename: string;

  @IsString()
  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType: string;
}
