/**
 * HYBRID PROMPT OPTIMIZATSIYA (BOSQICH 7)
 *
 * Hybrid engine uchun KOMPAKT context quruvchi. LLM'ga butun API JSON'ini
 * yuborish o'rniga — faqat kerakli maydonlarni yuboramiz (token 3-5x kamayadi):
 *
 *   - university → nom, joy, kategoriya, to'lov, grant, yotoqxona, qabul
 *   - direction  → nom + universitet
 *   - tuition     → nom + narx
 *   - grant/news  → sarlavha + qisqa tavsif
 *
 * Full context (context-builder.ts) LLM strategiyasi uchun qoladi; hybrid esa
 * shu kompakt versiyani ishlatadi.
 */
import type { ToolResult } from "@/types";

/** Bitta universitet uchun faqat tavsiya qaroriga ta'sir qiladigan maydonlar */
function compactUniversity(uni: any, index: number): string {
  const parts: string[] = [];
  const name = uni.fullNameUz || uni.fullNameEn || uni.name || "Noma'lum";
  parts.push(`${index}. ${name}`);
  if (uni.institutionCategory) parts.push(`   Turi: ${uni.institutionCategory}`);
  if (uni.location) parts.push(`   Manzil: ${uni.location}`);
  if (uni.tuition && uni.tuition !== "N/A") parts.push(`   To'lov: ${uni.tuition}`);
  if (uni.hasGrant !== undefined) parts.push(`   Grant: ${uni.hasGrant ? "✅ bor" : "yo'q"}`);
  if (uni.hasAccommodation !== undefined) parts.push(`   Yotoqxona: ${uni.hasAccommodation ? "✅ bor" : "yo'q"}`);
  if (uni.isOpenForAdmission !== undefined) parts.push(`   Qabul: ${uni.isOpenForAdmission ? "ochiq" : "yopiq"}`);
  if (uni.directionCount) parts.push(`   Yo'nalishlar soni: ${uni.directionCount}`);
  return parts.join("\n");
}

/** Tool natijalaridan faqat tavsiya uchun kerakli maydonlarni ajratadi */
export function buildCompactContext(toolResults: ToolResult[]): string {
  const parts: string[] = [];

  for (const result of toolResults) {
    if (!result.success || !result.data) continue;

    switch (result.tool) {
      case "search_university": {
        const isObjectFormat = !Array.isArray(result.data) && result.data?.universities !== undefined;
        const data = isObjectFormat
          ? (result.data as any).universities
          : (Array.isArray(result.data) ? result.data : [result.data]);
        const overview = isObjectFormat ? (result.data as any).universityOverview : null;
        const regionOverview = isObjectFormat ? (result.data as any).regionOverview : null;

        if (regionOverview?.regionSpecific) {
          const rs = regionOverview.regionSpecific;
          parts.push(`Hudud: ${regionOverview.regionId} — jami ${rs.total} ta (davlat ${rs.state}, xususiy ${rs.private}, xalqaro ${rs.international})`);
        }
        if (overview) {
          parts.push(`O'zbekistonda jami ${overview.totalCount} ta universitet (davlat ${overview.categories.state}, xususiy ${overview.categories.private}, xalqaro ${overview.categories.international})`);
        }
        if (Array.isArray(data) && data.length > 0) {
          parts.push("Universitetlar:");
          data.slice(0, 6).forEach((uni: any, i: number) => parts.push(compactUniversity(uni, i + 1)));
        }
        break;
      }

      case "search_direction": {
        const directionsData = Array.isArray(result.data)
          ? { directions: result.data, universities: [], universityDirections: undefined }
          : result.data;
        const dirs = Array.isArray(directionsData.directions) ? directionsData.directions : [];
        const unis = Array.isArray(directionsData.universities) ? directionsData.universities : [];
        if (directionsData.universityDirections?.directionNames?.length) {
          parts.push(`Universitet: ${directionsData.universityDirections.universityName}`);
          parts.push(`Yo'nalishlar (${directionsData.universityDirections.totalCount} ta):`);
          directionsData.universityDirections.directionNames.slice(0, 15).forEach((n: string, i: number) => parts.push(`  ${i + 1}. ${n}`));
        } else {
          if (dirs.length > 0) {
            parts.push("Topilgan yo'nalishlar:");
            dirs.slice(0, 10).forEach((d: any) => parts.push(`  - ${d.nameUz || d.nameEn}${d.universityName ? ` (${d.universityName})` : ""}`));
          }
          if (unis.length > 0) {
            parts.push("Mos universitetlar:");
            unis.slice(0, 6).forEach((uni: any, i: number) => parts.push(compactUniversity(uni, i + 1)));
          }
          if (directionsData.totalMatches !== undefined) {
            parts.push(`Jami mos: ${directionsData.totalMatches} ta`);
          }
        }
        break;
      }

      case "search_tuition": {
        const d = result.data;
        if (d?.hasData && Array.isArray(d.universities)) {
          parts.push(`Narx oralig'i: ${(d.minTuition / 1_000_000).toFixed(0)} - ${(d.maxTuition / 1_000_000).toFixed(0)} mln so'm`);
          d.universities.slice(0, 8).forEach((u: any, i: number) => {
            parts.push(`${i + 1}. ${u.name} — ${u.tuition}${u.location ? ` (${u.location})` : ""}`);
          });
        }
        break;
      }

      case "search_grants": {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        data.slice(0, 5).forEach((g: any, i: number) => {
          parts.push(`${i + 1}. ${g.grantTitleUz || g.grantTitleEn}${g.universityNameUz ? ` — ${g.universityNameUz}` : ""}`);
        });
        break;
      }

      case "search_news": {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        data.slice(0, 5).forEach((n: any, i: number) => {
          parts.push(`${i + 1}. ${n.titleUz || n.titleEn}`);
        });
        break;
      }

      case "recommend": {
        const d = result.data;
        if (d?.needsClarification) {
          parts.push(`Tavsiya uchun etarli ma'lumot yo'q. Yetishmayotgan: ${(d.preferences?.missing || []).join(", ") || "ma'lumot"}`);
        } else if (Array.isArray(d?.recommendations) && d.recommendations.length > 0) {
          const bestId = d.bestUniversity?.id;
          parts.push(`Tavsiyalar (${d.recommendations.length} ta, backend ball bilan saralangan):`);
          if (d.preferences?.directionCategory) {
            parts.push("MUHIM: Bu ro'yxat TO'LIQ va backend tomonidan HARD FILTERLANGAN — faqat foydalanuvchi tanlagan yo'nalishga (" + d.preferences.directionCategory + ") EGA universitetlar. Boshqa majorga ega (pedagogika/agrar/transport kabi) universitetlarni HECH QACHON tavsiya qilmang va o'zingizdan boshqa universitet qo'shmang, o'ylab topmang.");
          } else {
            parts.push("MUHIM: Bu ro'yxat backend tomonidan filtrlangan va to'liq — o'zingizdan boshqa universitet qo'shmang.");
          }
          if (bestId !== undefined) {
            parts.push("ASOSIY JAVOB: quyidagi birinchi (BEST) universitet — eng mos universitet. Faqat shu bitta universitetni asosiy tavsiya sifatida qat'iy ayting, qolganlari faqat alternativalar.");
          }
          d.recommendations.slice(0, 6).forEach((uni: any, i: number) => {
            const isBest = bestId !== undefined && uni.id === bestId;
            const compact = compactUniversity(uni, i + 1);
            // RECOMMENDATION SCORE (BOSQICH 9): ballni LLM'ga ko'rsatamiz —
            // LLM faqat izohlaydi, ballning o'zi backend tomonidan aniq hisoblangan.
            if (uni.score?.total !== undefined) {
              const weakNote = uni.score.breakdown?.weakness > 0
                ? `, zaif fan chegirmasi -${uni.score.breakdown.weakness}`
                : '';
              parts.push(`${compact}${isBest ? " [BEST — ENG MOS, asosiy javob]" : ""}\n   Ball: ${uni.score.total}/100 (yo'nalish ${uni.score.breakdown?.direction || 0}, byudjet ${uni.score.breakdown?.budget || 0}, hudud ${uni.score.breakdown?.region || 0}, bonus ${uni.score.breakdown?.bonus || 0}${weakNote})`);
              // Fix (nega aynan shu): backend hisoblagan sabablarni ham LLM'ga
              // beramiz — LLM ularni izohlab, "nega aynan shu universitet"
              // degan savolga faktlar bilan javob bera oladi.
              if (uni.score.reasons?.length) {
                parts.push(`   Sabablar: ${uni.score.reasons.slice(0, 3).join("; ")}`);
              }
              if (uni.score.nuances?.length) {
                parts.push(`   E'tibor: ${uni.score.nuances.slice(0, 2).join("; ")}`);
              }
            } else {
              parts.push(`${compact}${isBest ? " [BEST — ENG MOS, asosiy javob]" : ""}`);
            }
          });
        }
        break;
      }

      case "compare_universities": {
        const data = Array.isArray(result.data) ? result.data : [result.data];
        parts.push("Taqqoslash:");
        data.slice(0, 5).forEach((uni: any, i: number) => {
          parts.push(`${i + 1}. ${uni.name} — ${uni.type || "N/A"} | ${uni.location || "N/A"} | ${uni.tuition || "N/A"} | grant: ${uni.hasGrant ? "bor" : "yo'q"}`);
        });
        break;
      }
    }
  }

  return parts.join("\n");
}
