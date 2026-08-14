/**
 * UNIVERSITY QUALITY (STAGE 17) — "Bu universitet faqat policy'ga mos emas,
 * haqiqatan ham yaxshimi?" degan savolga javob.
 *
 * Hozirgi scoring'da budget/direction/category mosligi (ELIGIBILITY) asosiy
 * edi — "20 mln budget + xususiy" degan ikkita universitet uchun ular orasida
 * farq qiluvchi hech narsa yo'q edi. Bu modul REAL ma'lumotlardan (o'ylab
 * topilgan rating EMAS) universitet sifatini chiqaradi:
 *
 *   tajriba (foundedYear)      → 0-5
 *   talabalar soni (hajm)      → 0-4
 *   akkreditatsiya             → 0-4
 *   rasmiy hamkor (isPartner)  → 0-3
 *   yo'nalishlar kengligi      → 0-3
 *   grant imkoniyati           → 0-1
 *                              ─────
 *   JAMI (cap)                 → 0-15
 *
 * PURE funksiya — API chaqirmaydi, regression testlarda to'g'ridan-to'g'ri
 * ishlatiladi. MUHIM: ball imtihon/qabul policy'ni bekor qilmasligi uchun
 * 15 bilan cheklangan — admissionFailed xususiy(+20)/davlat(-12) farqi (32)
 * hali ham ustun turadi, lekin policy'ga TENG keladiganlar orasida sifat
 * hal qiluvchi bo'ladi.
 */

export interface UniversityQuality {
  /** 0-15 */
  score: number;
  /** Faktga asoslangan, odamga tushunarli sabablar (Uzbek tilida) */
  signals: string[];
}

export function computeUniversityQuality(uni: any): UniversityQuality {
  const u = uni || {};
  const signals: string[] = [];
  let score = 0;

  // 1) TAJRIBA — foundedYear (eski = barqaror, sinovdan o'tgan)
  const rawFy = u.foundedYear;
  const fy = typeof rawFy === "number" ? rawFy : rawFy !== undefined && rawFy !== null ? parseInt(String(rawFy)) : NaN;
  if (!isNaN(fy) && fy > 0) {
    if (fy < 1991) {
      score += 5;
      signals.push(`${fy}-yildan beri faoliyat yuritadi (uzoq yillik tajriba)`);
    } else if (fy <= 2000) {
      score += 4;
      signals.push(`${fy}-yildan beri faoliyat yuritadi`);
    } else if (fy <= 2010) {
      score += 2;
      signals.push(`${fy}-yilda tashkil etilgan`);
    } else {
      score += 1;
      signals.push(`${fy}-yilda tashkil etilgan (yosh universitet)`);
    }
  }

  // 2) TALABALAR SONI — studentsCount (hajm / ommaboplik)
  const rawSc = u.studentsCount;
  const sc = typeof rawSc === "number" ? rawSc : rawSc !== undefined && rawSc !== null ? parseInt(String(rawSc)) : NaN;
  if (!isNaN(sc) && sc > 0) {
    if (sc >= 10000) {
      score += 4;
      signals.push(`${Math.round(sc / 1000)} mingdan ortiq talaba tahsil oladi`);
    } else if (sc >= 5000) {
      score += 3;
      signals.push(`${(sc / 1000).toFixed(1)} ming talaba tahsil oladi`);
    } else if (sc >= 2000) {
      score += 2;
      signals.push(`${sc} dan ortiq talaba tahsil oladi`);
    } else {
      score += 1;
      signals.push(`${sc} talaba tahsil oladi`);
    }
  }

  // 3) AKKREDITATSIYA — sifat nazoratidan o'tgan
  if (u.accreditationCertificate || u.certificationLink) {
    score += 4;
    signals.push("Akkreditatsiyadan o'tgan (sifat nazorati tasdiqlangan)");
  }

  // 4) RASMIY HAMKOR — isPartner (ishonchlilik signali)
  if (u.isPartner === true || u.isPartner === 1) {
    score += 3;
    signals.push("Rasmiy hamkor (partner) universitet");
  }

  // 5) YO'NALISHLAR KENGLIGI — directionCount (tanlov kengligi)
  const rawDc = u.directionCount;
  const dc = typeof rawDc === "number" ? rawDc : rawDc !== undefined && rawDc !== null ? parseInt(String(rawDc)) : NaN;
  if (!isNaN(dc) && dc > 0) {
    if (dc >= 15) {
      score += 3;
      signals.push(`${dc} ta yo'nalishga ega (keng tanlov)`);
    } else if (dc >= 8) {
      score += 2;
      signals.push(`${dc} ta yo'nalishga ega`);
    } else if (dc >= 3) {
      score += 1;
      signals.push(`${dc} ta yo'nalishga ega`);
    }
  }

  // 6) GRANT — hasGrant (imkoniyat sifati)
  if (u.hasGrant === true) {
    score += 1;
    if (!signals.some((s) => s.includes("grant"))) {
      signals.push("Grant imkoniyati mavjud");
    }
  }

  return { score: Math.min(15, score), signals };
}
