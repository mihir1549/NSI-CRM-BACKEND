import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { MetaLeadService } from './meta-lead.service.js';
import { ListMetaLeadsDto } from './dto/list-meta-leads.dto.js';

@Controller({ path: 'social', version: '1' })
export class MetaLeadController {
  constructor(private readonly metaLeadService: MetaLeadService) {}

  @Get('meta-leads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DISTRIBUTOR')
  getMyMetaLeads(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMetaLeadsDto,
  ) {
    return this.metaLeadService.getMyMetaLeads(
      user.sub,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('admin/meta-leads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAllMetaLeadsAdmin(@Query() query: ListMetaLeadsDto) {
    return this.metaLeadService.getAllMetaLeadsAdmin(
      query.page ?? 1,
      query.limit ?? 20,
    );
  }
}
