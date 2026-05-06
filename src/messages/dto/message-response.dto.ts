import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageSenderDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl: string | null;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 'clx0987654321' })
  bookingId: string;

  @ApiProperty({ example: 'Hi, I have a question about the vehicle.' })
  content: string;

  @ApiProperty({ type: MessageSenderDto })
  sender: MessageSenderDto;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  readAt: Date | null;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  data: MessageResponseDto[];

  @ApiProperty({
    example: {
      total: 50,
      page: 1,
      limit: 20,
      totalPages: 3,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
