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

  // MUHIM: emojilarni o'chirmaymiz va yangi qatorlarni buzmaymiz.
  // Avvalgi versiya emojilarni (🏛🌍📚✅...) filter qilib o'chirardi va
  // /\s{2,}/ bilan \n\n larni bitta bo'sh joyga aylantirardi. Bu esa
  // frontend RichContent parserini (kartochka aniqlash, markdown
  // sarlavhalar, ro'yxatlar) butunlay buzardi — logda data bor, lekin
  // chatda universitet nomi / yo'nalish ko'rinmasdi.
  // Endi faqat qatordan ortiqcha bo'sh joylarni yig'ishtiramiz.
  return text
    .replace(/[ \t]+/g, ' ')
    .trim();
}
