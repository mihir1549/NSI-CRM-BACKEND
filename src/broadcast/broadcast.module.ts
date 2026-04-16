import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { BroadcastService } from './broadcast.service.js';
import { BroadcastAdminController } from './broadcast-admin.controller.js';
import { BroadcastDistributorController } from './broadcast-distributor.controller.js';
import { BroadcastUserController } from './broadcast-user.controller.js';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [
    BroadcastAdminController,
    BroadcastDistributorController,
    BroadcastUserController,
  ],
  providers: [BroadcastService],
  exports: [BroadcastService],
})
export class BroadcastModule {}
