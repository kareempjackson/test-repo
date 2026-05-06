import { IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class UploadImageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;
}
