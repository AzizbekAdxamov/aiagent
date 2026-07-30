import dotenv from 'dotenv';
import iconv from 'iconv-lite';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const BASE = process.env.MENTALABA_API_URL || 'https://api.mentalaba.uz/v1';
const TOKEN = process.env.MENTALABA_API_KEY || '';

async function inspect(endpoint: string) {
  const url = `${BASE}${endpoint}`;
  console.log('\n--- Inspecting', url);
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': '*/*' } });
  console.log('Status:', res.status);
  const contentType = res.headers.get('content-type') || '';
  console.log('Content-Type:', contentType);
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log('Raw length:', buffer.length);

  const utf8 = buffer.toString('utf8');
  console.log('\nFirst 500 chars (utf8):\n', utf8.substring(0, 500));

  const candidates = ['windows-1252', 'iso-8859-1', 'windows-1251'];
  for (const enc of candidates) {
    try {
      const dec = iconv.decode(buffer, enc);
      if (dec && dec.length > 0) {
        const hasMojibake = /[ÃÂâ]/.test(dec);
        console.log(`\nDecode with ${enc}: mojibake? ${hasMojibake} -- first 300 chars:\n`, dec.substring(0, 300));
      }
    } catch (e) {
      console.error('decode error', enc, e);
    }
  }

  // hex preview
  const hexPreview = buffer.slice(0, 200).toString('hex');
  console.log('\nHex preview (first 200 bytes):', hexPreview);
}

(async function() {
  try {
    await inspect('/universities/filter?limit=5');
    await inspect('/universities/select-box');
  } catch (e) {
    console.error('Inspect failed:', e);
  }
})();
