import { Test, TestingModule } from '@nestjs/testing';
import { QueueCronService } from './queue-cron.service';
import { OnboardingQueueService } from './onboarding-queue.service';
import { FollowupQueueService } from './followup-queue.service';
import { DropoffQueueService } from './dropoff-queue.service';

const mockOnboarding = {
  sendPendingOnboarding: jest.fn().mockResolvedValue(undefined),
};
const mockFollowup = {
  sendPendingFollowups: jest.fn().mockResolvedValue(undefined),
};
const mockDropoff = {
  sendPendingDropoffs: jest.fn().mockResolvedValue(undefined),
};

describe('QueueCronService', () => {
  let service: QueueCronService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueCronService,
        { provide: OnboardingQueueService, useValue: mockOnboarding },
        { provide: FollowupQueueService, useValue: mockFollowup },
        { provide: DropoffQueueService, useValue: mockDropoff },
      ],
    }).compile();

    service = module.get(QueueCronService);
  });

  it('processOnboarding calls sendPendingOnboarding', async () => {
    await service.processOnboarding();
    expect(mockOnboarding.sendPendingOnboarding).toHaveBeenCalledTimes(1);
  });

  it('processFollowups calls sendPendingFollowups', async () => {
    await service.processFollowups();
    expect(mockFollowup.sendPendingFollowups).toHaveBeenCalledTimes(1);
  });

  it('processDropoffs calls sendPendingDropoffs', async () => {
    await service.processDropoffs();
    expect(mockDropoff.sendPendingDropoffs).toHaveBeenCalledTimes(1);
  });
});
