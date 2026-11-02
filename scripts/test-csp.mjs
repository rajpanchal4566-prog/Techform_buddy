async function test() {
  const res = await fetch('http://localhost:3000/dashboard');
  console.log('Status:', res.status);
  console.log('CSP Report Only Header:', res.headers.get('content-security-policy-report-only'));
  console.log('X-Nonce Header:', res.headers.get('x-nonce'));
  const html = await res.text();
  console.log('Contains nonce in HTML?:', html.includes('nonce='));
  const matches = html.match(/nonce="([^"]+)"/g);
  console.log('Sample script nonces in HTML:', matches ? matches.slice(0, 3) : 'none');
}

test().catch(console.error);
