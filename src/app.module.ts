import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { PrismaModule } from './prisma/prisma.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            store: redisStore as any,
            url: redisUrl,
            ttl: 5 * 60 * 1000, // 5 minutes default TTL
          };
        }
        // Fallback to in-memory cache for development
        return {
          ttl: 5 * 60 * 1000,
        };
      },
    }),
    PrismaModule,
    VehiclesModule,
  ],
})
export class AppModule {}
