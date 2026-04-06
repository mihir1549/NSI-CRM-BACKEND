import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { FunnelCmsService } from './funnel-cms.service.js';
import { FunnelValidationService } from './funnel-validation.service.js';
import {
  CreateSectionDto,
  ReorderItemDto,
  UpdateSectionDto,
} from './dto/section.dto.js';
import { CreateStepDto, UpdateStepDto } from './dto/step.dto.js';
import {
  UpdateDecisionStepDto,
  UpdatePaymentGateDto,
  UpdatePhoneGateDto,
  UpdateStepContentDto,
} from './dto/step-content.dto.js';

/**
 * FunnelCmsController — all admin CMS endpoints.
 * All routes require JwtAuthGuard + RolesGuard(SUPER_ADMIN).
 * RolesGuard always fetches fresh user from DB.
 */
@Controller({ path: 'admin/funnel', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class FunnelCmsController {
  constructor(
    private readonly cmsService: FunnelCmsService,
    private readonly validationService: FunnelValidationService,
  ) {}

  // ─── SECTION CRUD ──────────────────────────────────────────

  @Post('sections')
  createSection(@Body() dto: CreateSectionDto) {
    return this.cmsService.createSection(dto);
  }

  @Get('sections')
  getAllSections() {
    return this.cmsService.getAllSections();
  }

  @Patch('sections/reorder')
  reorderSections(@Body() items: ReorderItemDto[]) {
    return this.cmsService.reorderSections(items);
  }

  @Get('sections/:uuid/edit')
  getSectionForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getSectionForUpdate(uuid);
  }

  @Patch('sections/:uuid')
  updateSection(@Param('uuid') uuid: string, @Body() dto: UpdateSectionDto) {
    return this.cmsService.updateSection(uuid, dto);
  }

  @Delete('sections/:uuid')
  deleteSection(@Param('uuid') uuid: string) {
    return this.cmsService.deleteSection(uuid);
  }

  // ─── STEP CRUD ─────────────────────────────────────────────

  @Post('steps')
  createStep(@Body() dto: CreateStepDto) {
    return this.cmsService.createStep(dto);
  }

  @Get('steps/:uuid')
  getStep(@Param('uuid') uuid: string) {
    return this.cmsService.getStepById(uuid);
  }

  @Patch('steps/reorder')
  reorderSteps(@Body() items: ReorderItemDto[]) {
    return this.cmsService.reorderSteps(items);
  }

  @Get('steps/:uuid/edit')
  getStepForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getStepForUpdate(uuid);
  }

  @Patch('steps/:uuid')
  updateStep(@Param('uuid') uuid: string, @Body() dto: UpdateStepDto) {
    return this.cmsService.updateStep(uuid, dto);
  }

  @Delete('steps/:uuid')
  deleteStep(@Param('uuid') uuid: string) {
    return this.cmsService.deleteStep(uuid);
  }

  // ─── STEP CONTENT/CONFIG ───────────────────────────────────

  @Get('steps/:uuid/content/edit')
  getStepContentForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getStepContentForUpdate(uuid);
  }

  @Put('steps/:uuid/content')
  upsertContent(@Param('uuid') uuid: string, @Body() dto: UpdateStepContentDto) {
    return this.cmsService.upsertStepContent(uuid, dto);
  }

  @Get('steps/:uuid/phone-gate/edit')
  getPhoneGateForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getPhoneGateForUpdate(uuid);
  }

  @Put('steps/:uuid/phone-gate')
  upsertPhoneGate(@Param('uuid') uuid: string, @Body() dto: UpdatePhoneGateDto) {
    return this.cmsService.upsertPhoneGate(uuid, dto);
  }

  @Get('steps/:uuid/payment-gate/edit')
  getPaymentGateForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getPaymentGateForUpdate(uuid);
  }

  @Put('steps/:uuid/payment-gate')
  upsertPaymentGate(@Param('uuid') uuid: string, @Body() dto: UpdatePaymentGateDto) {
    return this.cmsService.upsertPaymentGate(uuid, dto);
  }

  @Get('steps/:uuid/decision/edit')
  getDecisionStepForUpdate(@Param('uuid') uuid: string) {
    return this.cmsService.getDecisionStepForUpdate(uuid);
  }

  @Put('steps/:uuid/decision')
  upsertDecisionStep(@Param('uuid') uuid: string, @Body() dto: UpdateDecisionStepDto) {
    return this.cmsService.upsertDecisionStep(uuid, dto);
  }

  // ─── VALIDATION ────────────────────────────────────────────

  @Get('validate')
  validateFunnel() {
    return this.validationService.validateFunnel();
  }
}



