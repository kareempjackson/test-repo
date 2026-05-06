import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import {
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from './dto/message-response.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly emailDebounceMap = new Map<string, number>();
  private readonly DEBOUNCE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createMessage(
    bookingId: string,
    senderId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          include: {
            owner: true,
          },
        },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const isRenter = booking.renterId === senderId;
    const isOwner = booking.vehicle.ownerId === senderId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException(
        'Only the booking renter or vehicle owner can send messages',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        bookingId,
        senderId,
        content: dto.content,
        isRead: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send email notification to recipient (debounced)
    const recipientId = isRenter ? booking.vehicle.ownerId : booking.renterId;
    const recipient = isRenter ? booking.vehicle.owner : booking.renter;
    await this.sendDebouncedEmailNotification(
      bookingId,
      recipientId,
      recipient.email,
      message.sender.firstName || message.sender.email,
    );

    return this.mapToResponse(message);
  }

  async getMessages(
    bookingId: string,
    userId: string,
    query: MessageQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.vehicle.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException(
        'Only the booking renter or vehicle owner can view messages',
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.message.count({ where: { bookingId } }),
    ]);

    // Mark messages as read for the current user
    await this.prisma.message.updateMany({
      where: {
        bookingId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      messages: messages.map((m) => this.mapToResponse(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(bookingId: string, userId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        bookingId,
        senderId: { not: userId },
        isRead: false,
      },
    });
  }

  async getUnreadCountsForBookings(
    bookingIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    const counts = await this.prisma.message.groupBy({
      by: ['bookingId'],
      where: {
        bookingId: { in: bookingIds },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const count of counts) {
      countMap.set(count.bookingId, count._count.id);
    }
    return countMap;
  }

  private async sendDebouncedEmailNotification(
    bookingId: string,
    recipientId: string,
    recipientEmail: string,
    senderName: string,
  ): Promise<void> {
    const debounceKey = `${bookingId}:${recipientId}`;
    const lastSent = this.emailDebounceMap.get(debounceKey);
    const now = Date.now();

    if (lastSent && now - lastSent < this.DEBOUNCE_INTERVAL_MS) {
      this.logger.debug(
        `Email notification debounced for booking ${bookingId} to user ${recipientId}`,
      );
      return;
    }

    this.emailDebounceMap.set(debounceKey, now);

    try {
      await this.emailService.sendMessageNotification(
        recipientEmail,
        senderName,
        bookingId,
      );
      this.logger.log(
        `Email notification sent to ${recipientEmail} for booking ${bookingId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email notification: ${error.message}`,
        error.stack,
      );
    }
  }

  private mapToResponse(message: any): MessageResponseDto {
    return {
      id: message.id,
      bookingId: message.bookingId,
      senderId: message.senderId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        email: message.sender.email,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
      },
    };
  }
}
