import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages.dto';
import {
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from './dto/message-response.dto';

const NOTIFICATION_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

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
          select: { ownerId: true, make: true, model: true },
        },
        renter: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
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
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Determine recipient and send notification
    const recipientId = isRenter ? booking.vehicle.ownerId : booking.renterId;
    await this.sendNotificationIfNeeded(bookingId, recipientId, senderId, booking);

    return this.mapToResponse(message);
  }

  async getMessages(
    bookingId: string,
    userId: string,
    query: GetMessagesQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          select: { ownerId: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.vehicle.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException(
        'Only the booking renter or vehicle owner can view messages',
      );
    }

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { bookingId },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { bookingId } }),
    ]);

    // Mark messages as read for the current user
    await this.prisma.message.updateMany({
      where: {
        bookingId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return {
      data: messages.map(this.mapToResponse),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCountForBooking(
    bookingId: string,
    userId: string,
  ): Promise<number> {
    return this.prisma.message.count({
      where: {
        bookingId,
        senderId: { not: userId },
        readAt: null,
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
        readAt: null,
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const count of counts) {
      countMap.set(count.bookingId, count._count.id);
    }
    return countMap;
  }

  private async sendNotificationIfNeeded(
    bookingId: string,
    recipientId: string,
    senderId: string,
    booking: {
      vehicle: { make: string; model: string };
      renter: { firstName: string };
    },
  ): Promise<void> {
    try {
      const debounce = await this.prisma.messageNotificationDebounce.findUnique(
        {
          where: {
            bookingId_recipientId: { bookingId, recipientId },
          },
        },
      );

      const now = new Date();
      const shouldNotify =
        !debounce ||
        now.getTime() - debounce.lastNotifiedAt.getTime() >=
          NOTIFICATION_DEBOUNCE_MS;

      if (!shouldNotify) {
        this.logger.debug(
          `Skipping notification for booking ${bookingId} - debounced`,
        );
        return;
      }

      // Upsert debounce record
      await this.prisma.messageNotificationDebounce.upsert({
        where: {
          bookingId_recipientId: { bookingId, recipientId },
        },
        create: {
          bookingId,
          recipientId,
          lastNotifiedAt: now,
        },
        update: {
          lastNotifiedAt: now,
        },
      });

      // Get recipient email
      const recipient = await this.prisma.user.findUnique({
        where: { id: recipientId },
        select: { email: true, firstName: true },
      });

      if (!recipient) {
        return;
      }

      // Get sender name
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      });

      const senderName = sender
        ? `${sender.firstName} ${sender.lastName}`
        : 'Someone';

      await this.emailService.sendMessageNotification({
        to: recipient.email,
        recipientName: recipient.firstName,
        senderName,
        vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
        bookingId,
      });

      this.logger.log(
        `Sent message notification for booking ${bookingId} to ${recipient.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message notification: ${error.message}`,
        error.stack,
      );
    }
  }

  private mapToResponse(message: {
    id: string;
    bookingId: string;
    content: string;
    readAt: Date | null;
    createdAt: Date;
    sender: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }): MessageResponseDto {
    return {
      id: message.id,
      bookingId: message.bookingId,
      content: message.content,
      sender: {
        id: message.sender.id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        avatarUrl: message.sender.avatarUrl,
      },
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }
}
