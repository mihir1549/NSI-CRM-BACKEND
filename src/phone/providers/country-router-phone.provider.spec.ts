import { CountryRouterPhoneProvider } from './country-router-phone.provider';
import type { PhoneProvider } from './phone-provider.interface';

function makeMockProvider(): jest.Mocked<PhoneProvider> {
  return {
    sendOtp: jest.fn().mockResolvedValue(undefined),
    verifyOtp: jest.fn().mockResolvedValue(true),
  };
}

describe('CountryRouterPhoneProvider', () => {
  let msg91: jest.Mocked<PhoneProvider>;
  let twilio: jest.Mocked<PhoneProvider>;
  let router: CountryRouterPhoneProvider;

  beforeEach(() => {
    msg91 = makeMockProvider();
    twilio = makeMockProvider();
    router = new CountryRouterPhoneProvider(
      [{ countryCodes: ['91'], provider: msg91 }],
      twilio,
    );
  });

  describe('sendOtp routing', () => {
    it('routes +91 numbers to MSG91', async () => {
      await router.sendOtp('+919876543210', 'sms');

      expect(msg91.sendOtp).toHaveBeenCalledWith('+919876543210', 'sms');
      expect(twilio.sendOtp).not.toHaveBeenCalled();
    });

    it('routes +1 numbers to Twilio (default)', async () => {
      await router.sendOtp('+14155551234', 'sms');

      expect(twilio.sendOtp).toHaveBeenCalledWith('+14155551234', 'sms');
      expect(msg91.sendOtp).not.toHaveBeenCalled();
    });

    it('routes +44 numbers to Twilio (default)', async () => {
      await router.sendOtp('+447911123456', 'sms');

      expect(twilio.sendOtp).toHaveBeenCalledWith('+447911123456', 'sms');
      expect(msg91.sendOtp).not.toHaveBeenCalled();
    });

    it('routes 91XXXXXXXXXX (no +) to MSG91', async () => {
      await router.sendOtp('919876543210', 'whatsapp');

      expect(msg91.sendOtp).toHaveBeenCalledWith('919876543210', 'whatsapp');
      expect(twilio.sendOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp routing', () => {
    it('routes +91 verification to MSG91', async () => {
      const ok = await router.verifyOtp('+919876543210', '123456', 'sms');

      expect(msg91.verifyOtp).toHaveBeenCalledWith(
        '+919876543210',
        '123456',
        'sms',
      );
      expect(twilio.verifyOtp).not.toHaveBeenCalled();
      expect(ok).toBe(true);
    });

    it('routes non-Indian verification to Twilio default', async () => {
      await router.verifyOtp('+14155551234', '123456', 'sms');

      expect(twilio.verifyOtp).toHaveBeenCalledWith(
        '+14155551234',
        '123456',
        'sms',
      );
      expect(msg91.verifyOtp).not.toHaveBeenCalled();
    });
  });

  describe('extensibility', () => {
    it('supports multiple countryCode entries per route', async () => {
      const eu = makeMockProvider();
      const multi = new CountryRouterPhoneProvider(
        [{ countryCodes: ['44', '49', '33'], provider: eu }],
        twilio,
      );

      await multi.sendOtp('+4917612345678', 'sms'); // Germany
      await multi.sendOtp('+33612345678', 'sms'); // France

      expect(eu.sendOtp).toHaveBeenCalledTimes(2);
      expect(twilio.sendOtp).not.toHaveBeenCalled();
    });

    it('checks routes in order — first matching country code wins', async () => {
      const first = makeMockProvider();
      const second = makeMockProvider();
      const ordered = new CountryRouterPhoneProvider(
        [
          { countryCodes: ['91'], provider: first },
          { countryCodes: ['91'], provider: second },
        ],
        twilio,
      );

      await ordered.sendOtp('+919876543210', 'sms');

      expect(first.sendOtp).toHaveBeenCalled();
      expect(second.sendOtp).not.toHaveBeenCalled();
    });
  });
});
