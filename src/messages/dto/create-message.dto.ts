import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(2000, { message: 'Message content cannot exceed 2000 characters' })
  content: string;
}
