import { Msg91PhoneProvider } from './msg91-phone.provider';

const AUTH_KEY = 'test-auth-key';
const SMS_TEMPLATE = 'sms-tpl-1';
const WA_TEMPLATE = 'wa-tpl-1';
const SENDER_ID = 'MSGIND';
const PHONE = '+919876543210';
const MOBILE = '919876543210';

function mockFetchResponse(body: unknown): Response {
  return {
    json: async () => body,
  } as unknown as Response;
}

describe('Msg91PhoneProvider', () => {
  let provider: Msg91PhoneProvider;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new Msg91PhoneProvider(
      AUTH_KEY,
      SMS_TEMPLATE,
      WA_TEMPLATE,
      SENDER_ID,
    );
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('sendOtp (sms)', () => {
    it('calls MSG91 SMS endpoint with correct params and strips leading +', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ type: 'success' }));

      await provider.sendOtp(PHONE, 'sms');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [urlArg, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const url = new URL(urlArg);

      expect(url.origin + url.pathname).toBe(
        'https://control.msg91.com/api/v5/otp',
      );
      expect(url.searchParams.get('mobile')).toBe(MOBILE);
      expect(url.searchParams.get('authkey')).toBe(AUTH_KEY);
      expect(url.searchParams.get('template_id')).toBe(SMS_TEMPLATE);
      expect(url.searchParams.get('otp_length')).toBe('6');
      expect(url.searchParams.get('otp_expiry')).toBe('10');
      expect(url.searchParams.get('sender')).toBe(SENDER_ID);
      expect(init.method).toBe('POST');
    });

    it('throws when MSG91 returns non-success', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ type: 'error', message: 'bad authkey' }),
      );

      await expect(provider.sendOtp(PHONE, 'sms')).rejects.toThrow(
        /MSG91 SMS OTP failed: bad authkey/,
      );
    });
  });

  describe('sendOtp (whatsapp)', () => {
    it('calls MSG91 WhatsApp endpoint with JSON body and authkey header', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ type: 'success' }));

      await provider.sendOtp(PHONE, 'whatsapp');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [urlArg, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

      expect(urlArg).toBe(
        'https://control.msg91.com/api/v5/whatsapp/whatsapp-otp',
      );
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.authkey).toBe(AUTH_KEY);
      expect(headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual({
        mobile: MOBILE,
        template_id: WA_TEMPLATE,
      });
    });

    it('throws when WhatsApp send returns non-success', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ type: 'error', message: 'template rejected' }),
      );

      await expect(provider.sendOtp(PHONE, 'whatsapp')).rejects.toThrow(
        /MSG91 WhatsApp OTP failed: template rejected/,
      );
    });
  });

  describe('verifyOtp', () => {
    it('returns true on success response (sms)', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ type: 'success' }));

      const ok = await provider.verifyOtp(PHONE, '123456', 'sms');

      expect(ok).toBe(true);
      const [urlArg, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const url = new URL(urlArg);
      expect(url.origin + url.pathname).toBe(
        'https://control.msg91.com/api/v5/otp/verify',
      );
      expect(url.searchParams.get('mobile')).toBe(MOBILE);
      expect(url.searchParams.get('authkey')).toBe(AUTH_KEY);
      expect(url.searchParams.get('otp')).toBe('123456');
      expect(url.searchParams.get('type')).toBeNull();
      expect(init.method).toBe('GET');
    });

    it('sets type=whatsapp when channel is whatsapp', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchResponse({ type: 'success' }));

      await provider.verifyOtp(PHONE, '123456', 'whatsapp');

      const [urlArg] = fetchSpy.mock.calls[0] as [string];
      const url = new URL(urlArg);
      expect(url.searchParams.get('type')).toBe('whatsapp');
    });

    it('returns false on failure response', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ type: 'error', message: 'invalid otp' }),
      );

      const ok = await provider.verifyOtp(PHONE, '000000', 'sms');

      expect(ok).toBe(false);
    });
  });
});
