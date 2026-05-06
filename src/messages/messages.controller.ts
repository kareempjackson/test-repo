import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';

@Controller('bookings/:bookingId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Param('bookingId') bookingId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: any,
  ) {
    const message = await this.messagesService.createMessage(
      bookingId,
      req.user.id,
      createMessageDto.content,
    );
    return {
      success: true,
      data: message,
    };
  }

  @Get()
  async getMessages(
    @Param('bookingId') bookingId: string,
    @Query() query: GetMessagesQueryDto,
    @Request() req: any,
  ) {
    const result = await this.messagesService.getMessages(
      bookingId,
      req.user.id,
      query.page || 1,
      query.limit || 20,
    );
    return {
      success: true,
      data: result.messages,
      pagination: result.pagination,
    };
  }
}
