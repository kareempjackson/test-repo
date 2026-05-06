export class SenderInfoDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export class MessageResponseDto {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  sender: SenderInfoDto;
}

export class PaginatedMessagesResponseDto {
  messages: MessageResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
