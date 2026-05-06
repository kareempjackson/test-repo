import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages.dto';
import {
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from './dto/message-response.dto';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings/:bookingId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to send messages for this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async createMessage(
    @Param('bookingId') bookingId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: { user: { id: string } },
  ): Promise<MessageResponseDto> {
    return this.messagesService.createMessage(
      bookingId,
      req.user.id,
      createMessageDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get messages for a booking (paginated, newest first)' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to view messages for this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getMessages(
    @Param('bookingId') bookingId: string,
    @Query() query: GetMessagesQueryDto,
    @Request() req: { user: { id: string } },
  ): Promise<PaginatedMessagesResponseDto> {
    return this.messagesService.getMessages(bookingId, req.user.id, query);
  }
}
