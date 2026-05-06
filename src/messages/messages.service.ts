import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class MessagesService {
  private lastNotificationTimes: Map<string, number> = new Map();
  private readonly NOTIFICATION_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createMessage(bookingId: string, senderId: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }

    if (content.length > 2000) {
      throw new BadRequestException('Message content cannot exceed 2000 characters');
    }

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
      throw new NotFoundException('Booking not found');
    }

    const isRenter = booking.renterId === senderId;
    const isOwner = booking.vehicle.ownerId === senderId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException('Only the booking renter or vehicle owner can send messages');
    }

    const message = await this.prisma.message.create({
      data: {
        bookingId,
        senderId,
        content: content.trim(),
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
    const recipient = isRenter ? booking.vehicle.owner : booking.renter;
    await this.sendDebouncedEmailNotification(
      bookingId,
      recipient.email,
      recipient.firstName || 'User',
      message.sender.firstName || 'Someone',
    );

    return message;
  }

  async getMessages(
    bookingId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.vehicle.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException('Only the booking renter or vehicle owner can view messages');
    }

    // Mark messages as read for the current user
    await this.prisma.message.updateMany({
      where: {
        bookingId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    const skip = (page - 1) * limit;

    const [messages, totalCount] = await Promise.all([
      this.prisma.message.findMany({
        where: { bookingId },
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { bookingId } }),
    ]);

    return {
      messages,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + messages.length < totalCount,
      },
    };
  }

  async getUnreadCountForBooking(bookingId: string, userId: string): Promise<number> {
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
      _count: {
        id: true,
      },
    });

    const countMap = new Map<string, number>();
    counts.forEach((item) => {
      countMap.set(item.bookingId, item._count.id);
    });

    return countMap;
  }

  private async sendDebouncedEmailNotification(
    bookingId: string,
    recipientEmail: string,
    recipientName: string,
    senderName: string,
  ): Promise<void> {
    const cacheKey = `${bookingId}:${recipientEmail}`;
    const lastNotification = this.lastNotificationTimes.get(cacheKey);
    const now = Date.now();

    if (lastNotification && now - lastNotification < this.NOTIFICATION_DEBOUNCE_MS) {
      return; // Skip notification, still within debounce window
    }

    this.lastNotificationTimes.set(cacheKey, now);

    try {
      await this.emailService.sendMessageNotification(
        recipientEmail,
        recipientName,
        senderName,
        bookingId,
      );
    } catch (error) {
      console.error('Failed to send message notification email:', error);
    }
  }
}
