import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bookings/:bookingId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMessage(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateMessageDto,
    @Request() req: any,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.messagesService.createMessage(bookingId, userId, dto);
  }

  @Get()
  async getMessages(
    @Param('bookingId') bookingId: string,
    @Query() query: MessageQueryDto,
    @Request() req: any,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.messagesService.getMessages(bookingId, userId, query);
  }
}
