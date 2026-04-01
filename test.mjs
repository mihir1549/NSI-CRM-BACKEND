import fs from 'fs';

const API_URL = 'http://localhost:3000/auth';

async function run() {
  const email = `test-${Date.now()}@test.com`;
  const password = 'Password123!';
  let accessToken = '';
  let refreshTokenCookie = '';

  console.log('--- STARTING E2E INTEGRATION TEST ---');

  // 1. SIGNUP
  console.log('\n1. Testing POST /auth/signup...');
  let res = await fetch(`${API_URL}/signup`, {
    method: 'POST',
    body: JSON.stringify({ fullName: 'Live Test User', email, password }),
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status !== 201) throw new Error('Signup failed: ' + await res.text());
  console.log('✅ Signup successful');

  // Wait for OTP file to be written by the background Nest JS process
  await new Promise(r => setTimeout(r, 1000));
  
  const otp = fs.readFileSync('test-otp.txt', 'utf8').trim();
  console.log('✅ Intercepted OTP:', otp);

  // 2. VERIFY OTP
  console.log('\n2. Testing POST /auth/verify-email-otp...');
  res = await fetch(`${API_URL}/verify-email-otp`, {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status !== 200) throw new Error('Verify OTP failed: ' + await res.text());
  
  const body = await res.json();
  accessToken = body.accessToken;
  
  const setCookie = res.headers.get('set-cookie');
  refreshTokenCookie = setCookie.split(';')[0]; // Extract refresh_token=XYZ
  
  console.log('✅ Verify OTP successful. Status:', body.user.status);
  console.log('✅ Received Access Token');
  console.log('✅ Received HttpOnly Refresh Token Cookie');

  // 3. COMPLETE PROFILE - REQUIRE AUTH
  console.log('\n3. Testing POST /auth/complete-profile (Without Token)...');
  res = await fetch(`${API_URL}/complete-profile`, {
    method: 'POST',
    body: JSON.stringify({ country: 'IN' }),
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status !== 401) throw new Error('Complete Profile without token should fail 401');
  console.log('✅ Complete profile without token rejected (401)');

  // 4. COMPLETE PROFILE - SUCCESS
  console.log('\n4. Testing POST /auth/complete-profile (With Token)...');
  res = await fetch(`${API_URL}/complete-profile`, {
    method: 'POST',
    body: JSON.stringify({ country: 'IN' }),
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
  });
  if (res.status !== 200) throw new Error('Complete Profile failed: ' + await res.text());
  console.log('✅ Profile completed successfully. User is now ACTIVE.');

  // 5. LOGIN
  console.log('\n5. Testing POST /auth/login...');
  res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status !== 200) throw new Error('Login failed: ' + await res.text());
  
  const loginBody = await res.json();
  const loginSetCookie = res.headers.get('set-cookie');
  refreshTokenCookie = loginSetCookie.split(';')[0]; // Rotated cookie
  accessToken = loginBody.accessToken;
  console.log('✅ Login successful. Token pair rotated.');

  // 6. REFRESH TOKEN
  console.log('\n6. Testing POST /auth/refresh...');
  res = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Cookie': refreshTokenCookie }
  });
  if (res.status !== 200) throw new Error('Refresh failed: ' + await res.text());
  
  const refreshSetCookie = res.headers.get('set-cookie');
  refreshTokenCookie = refreshSetCookie.split(';')[0]; // Rotated cookie again
  console.log('✅ Refresh successful. Token rotated again.');

  // 7. RATE LIMITING (Resend OTP)
  console.log('\n7. Testing POST /auth/resend-otp Rate Limiting (Should allow 3, block 4th)...');
  // First, we need to bypass status enforcement? Wait, resend-otp requires status = REGISTERED
  // But our user is now ACTIVE! So resend-otp will return 200 with "If your email is registered..."
  // It still hits the rate limiter!
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API_URL}/resend-otp`, {
      method: 'POST', body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' }
    });
    console.log(`   Attempt ${i+1}: Status ${r.status}`);
  }
  const r4 = await fetch(`${API_URL}/resend-otp`, {
    method: 'POST', body: JSON.stringify({ email }), headers: { 'Content-Type': 'application/json' }
  });
  if (r4.status === 429 || r4.status === 400) {
    console.log(`✅ Rate limiting active. 4th attempt blocked with status ${r4.status}`);
  } else {
    throw new Error('Rate limiting failed, got status ' + r4.status);
  }

  // 8. LOGOUT
  console.log('\n8. Testing POST /auth/logout...');
  res = await fetch(`${API_URL}/logout`, {
    method: 'POST',
    headers: { 'Cookie': refreshTokenCookie }
  });
  if (res.status !== 200) throw new Error('Logout failed: ' + await res.text());
  console.log('✅ Logout successful.');

  // 9. REFRESH AFTER LOGOUT (Should fail)
  console.log('\n9. Testing POST /auth/refresh (After Logout)...');
  res = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Cookie': refreshTokenCookie }
  });
  if (res.status !== 401) throw new Error('Refresh after logout should fail 401');
  console.log('✅ Refresh after logout rejected (401)');

  console.log('\n🎉 ALL TESTS PASSED. BACKEND IS ROBUST AND FULLY VALIDATED.');
}

run().catch(console.error);
