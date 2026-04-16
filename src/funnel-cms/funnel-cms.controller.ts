import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
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
import {
  CmsSectionItem,
  CmsSectionWithStepsItem,
  CmsSectionUpdateResponse,
  CmsStepItem,
  CmsStepUpdateResponse,
  CmsStepContent,
  CmsPhoneGate,
  CmsPaymentGate,
  CmsDecisionStep,
  CmsMessageResponse,
} from './dto/responses/funnel-cms.responses.js';
import { ErrorResponse } from '../common/dto/responses/error.response.js';

/**
 * FunnelCmsController — all admin CMS endpoints.
 * All routes require JwtAuthGuard + RolesGuard(SUPER_ADMIN).
 * RolesGuard always fetches fresh user from DB.
 */
@ApiTags('Funnel CMS')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin/funnel', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class FunnelCmsController {
  constructor(
    private readonly cmsService: FunnelCmsService,
    private readonly validationService: FunnelValidationService,
  ) {}

  // ─── SECTION CRUD ──────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new funnel section' })
  @ApiResponse({
    status: 201,
    description: 'Section created',
    type: CmsSectionItem,
  })
  @Post('sections')
  createSection(@Body() dto: CreateSectionDto) {
    return this.cmsService.createSection(dto);
  }

  @ApiOperation({ summary: 'Get all sections with their steps and content' })
  @ApiResponse({
    status: 200,
    description: 'All sections',
    type: [CmsSectionWithStepsItem],
  })
  @Get('sections')
  getAllSections() {
    return this.cmsService.getAllSections();
  }

  @ApiOperation({ summary: 'Reorder sections' })
  @ApiResponse({
    status: 200,
    description: 'Sections reordered',
    type: CmsMessageResponse,
  })
  @Patch('sections/reorder')
  reorderSections(
    @Body(new ParseArrayPipe({ items: ReorderItemDto }))
    items: ReorderItemDto[],
  ) {
    return this.cmsService.reorderSections(items);
  }

  @ApiOperation({ summary: 'Get section data for editing' })
  @ApiParam({ name: 'uuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section edit data',
    type: CmsSectionUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Get('sections/:uuid/edit')
  getSectionForUpdate(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.cmsService.getSectionForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Update a funnel section' })
  @ApiParam({ name: 'uuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section updated',
    type: CmsSectionItem,
  })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Patch('sections/:uuid')
  updateSection(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.cmsService.updateSection(uuid, dto);
  }

  @ApiOperation({ summary: 'Delete a funnel section' })
  @ApiParam({ name: 'uuid', description: 'Section UUID' })
  @ApiResponse({
    status: 200,
    description: 'Section deleted',
    type: CmsMessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete (users active)',
    type: ErrorResponse,
  })
  @Delete('sections/:uuid')
  deleteSection(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.cmsService.deleteSection(uuid);
  }

  // ─── STEP CRUD ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Create a new step in a section' })
  @ApiResponse({ status: 201, description: 'Step created', type: CmsStepItem })
  @ApiResponse({
    status: 404,
    description: 'Section not found',
    type: ErrorResponse,
  })
  @Post('steps')
  createStep(@Body() dto: CreateStepDto) {
    return this.cmsService.createStep(dto);
  }

  @ApiOperation({ summary: 'Get step data by UUID' })
  @ApiParam({ name: 'uuid', description: 'Step UUID' })
  @ApiResponse({ status: 200, description: 'Step data', type: CmsStepItem })
  @ApiResponse({
    status: 404,
    description: 'Step not found',
    type: ErrorResponse,
  })
  @Get('steps/:uuid')
  getStep(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.cmsService.getStepById(uuid);
  }

  @ApiOperation({ summary: 'Reorder steps (across or within sections)' })
  @ApiResponse({
    status: 200,
    description: 'Steps reordered',
    type: CmsMessageResponse,
  })
  @Patch('steps/reorder')
  reorderSteps(
    @Body(new ParseArrayPipe({ items: ReorderItemDto }))
    items: ReorderItemDto[],
  ) {
    return this.cmsService.reorderSteps(items);
  }

  @ApiOperation({ summary: 'Get step data for editing' })
  @ApiParam({ name: 'uuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Step edit data',
    type: CmsStepUpdateResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'Step not found',
    type: ErrorResponse,
  })
  @Get('steps/:uuid/edit')
  getStepForUpdate(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.cmsService.getStepForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Update step order or active status' })
  @ApiParam({ name: 'uuid', description: 'Step UUID' })
  @ApiResponse({ status: 200, description: 'Step updated', type: CmsStepItem })
  @ApiResponse({
    status: 404,
    description: 'Step not found',
    type: ErrorResponse,
  })
  @Patch('steps/:uuid')
  updateStep(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Body() dto: UpdateStepDto,
  ) {
    return this.cmsService.updateStep(uuid, dto);
  }

  @ApiOperation({ summary: 'Delete a step' })
  @ApiParam({ name: 'uuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Step deleted',
    type: CmsMessageResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete (users active)',
    type: ErrorResponse,
  })
  @Delete('steps/:uuid')
  deleteStep(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.cmsService.deleteStep(uuid);
  }

  // ─── STEP CONTENT/CONFIG ───────────────────────────────────

  @ApiOperation({ summary: 'Get VIDEO_TEXT step content for editing' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Step content edit data',
    type: CmsStepContent,
  })
  @Get('steps/:stepUuid/content/edit')
  getStepContentForUpdate(@Param('stepUuid') uuid: string) {
    return this.cmsService.getStepContentForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Upsert VIDEO_TEXT step content' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Content saved',
    type: CmsStepContent,
  })
  @Patch('steps/:stepUuid/content')
  upsertContent(
    @Param('stepUuid') uuid: string,
    @Body() dto: UpdateStepContentDto,
  ) {
    return this.cmsService.upsertStepContent(uuid, dto);
  }

  @ApiOperation({ summary: 'Get PHONE_GATE config for editing' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Phone gate edit data',
    type: CmsPhoneGate,
  })
  @Get('steps/:stepUuid/phone/edit')
  getPhoneGateForUpdate(@Param('stepUuid') uuid: string) {
    return this.cmsService.getPhoneGateForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Upsert PHONE_GATE config' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Phone gate saved',
    type: CmsPhoneGate,
  })
  @Patch('steps/:stepUuid/phone')
  upsertPhoneGate(
    @Param('stepUuid') uuid: string,
    @Body() dto: UpdatePhoneGateDto,
  ) {
    return this.cmsService.upsertPhoneGate(uuid, dto);
  }

  @ApiOperation({ summary: 'Get PAYMENT_GATE config for editing' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment gate edit data',
    type: CmsPaymentGate,
  })
  @Get('steps/:stepUuid/payment/edit')
  getPaymentGateForUpdate(@Param('stepUuid') uuid: string) {
    return this.cmsService.getPaymentGateForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Upsert PAYMENT_GATE config' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Payment gate saved',
    type: CmsPaymentGate,
  })
  @Patch('steps/:stepUuid/payment')
  upsertPaymentGate(
    @Param('stepUuid') uuid: string,
    @Body() dto: UpdatePaymentGateDto,
  ) {
    return this.cmsService.upsertPaymentGate(uuid, dto);
  }

  @ApiOperation({ summary: 'Get DECISION config for editing' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Decision step edit data',
    type: CmsDecisionStep,
  })
  @Get('steps/:stepUuid/decision/edit')
  getDecisionStepForUpdate(@Param('stepUuid') uuid: string) {
    return this.cmsService.getDecisionStepForUpdate(uuid);
  }

  @ApiOperation({ summary: 'Upsert DECISION config' })
  @ApiParam({ name: 'stepUuid', description: 'Step UUID' })
  @ApiResponse({
    status: 200,
    description: 'Decision step saved',
    type: CmsDecisionStep,
  })
  @Patch('steps/:stepUuid/decision')
  upsertDecisionStep(
    @Param('stepUuid') uuid: string,
    @Body() dto: UpdateDecisionStepDto,
  ) {
    return this.cmsService.upsertDecisionStep(uuid, dto);
  }

  // ─── VALIDATION ────────────────────────────────────────────

  @ApiOperation({ summary: 'Validate funnel configuration' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  @Get('validate')
  validateFunnel() {
    return this.validationService.validateFunnel();
  }
}
