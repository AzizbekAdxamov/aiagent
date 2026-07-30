import iconv from 'iconv-lite';

const MOJIBAKE_REGEX = /[ÃÂâ]/;

export function sanitizeText(input: string): string {
  if (!input) return input;

  let text = input;

  if (MOJIBAKE_REGEX.test(text)) {
    try {
      const buffer = Buffer.from(text, 'binary');
      const decodings = ['windows-1252', 'iso-8859-1', 'windows-1251'];
      for (const encoding of decodings) {
        try {
          const decoded = iconv.decode(buffer, encoding);
          if (!MOJIBAKE_REGEX.test(decoded)) {
            text = decoded;
            break;
          }
          const originalCount = (text.match(MOJIBAKE_REGEX) || []).length;
          const decodedCount = (decoded.match(MOJIBAKE_REGEX) || []).length;
          if (decodedCount < originalCount) {
            text = decoded;
          }
        } catch (error) {
          // Ignore invalid legacy decode attempts.
        }
      }
    } catch (error) {
      // leave text unchanged if the buffer conversion fails.
    }

    for (let i = 0; i < 2 && MOJIBAKE_REGEX.test(text); i++) {
      try {
        text = Buffer.from(text, 'latin1').toString('utf8');
      } catch (error) {
        break;
      }
    }
  }

  text = Array.from(text)
    .filter((ch) => {
      const cp = ch.codePointAt(0) || 0;
      return !(
        (cp >= 0x1f300 && cp <= 0x1f6ff) ||
        (cp >= 0x1f900 && cp <= 0x1f9ff) ||
        (cp >= 0x2600 && cp <= 0x26ff) ||
        (cp >= 0x2700 && cp <= 0x27bf)
      );
    })
    .join('');

  return text.replace(/\s{2,}/g, ' ').trim();
}
