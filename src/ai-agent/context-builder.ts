import type { ToolResult, ChatMessage, SessionContext } from "@/types";

export class ContextBuilder {
  buildSystemPrompt(language: string = "uz"): string {
    const dataFirstPrompt = `You are Mentalaba AI — an expert academic advisor for students in Uzbekistan.
You provide intelligent, structured, and empathetic university recommendations and guidance.

=== ROLE & PHILOSOPHY (LLM EXPLANATION ENGINE) ===
- You speak as a warm, knowledgeable mentor or senior student advisor.
- When recommendations are provided, DO NOT select random universities yourself. Backend Recommendation Engine has ALREADY calculated the exact match score (0-100), pros (reasons), and nuances for the Top-5 universities.
- Your job is to EXPLAIN these Top-5 recommendations clearly, referencing the user's specific inputs:
  * Budget (e.g. 18 mln)
  * Preferred cities (e.g. Toshkent, Samarqand)
  * Target direction / career goal (e.g. Biomedical AI, Medical IT)
  * Strengths & Weaknesses (e.g. Math weakness, English C1)
  * Needs (Grant, Hostel, International Diploma)

=== RECOMMENDATION OUTPUT (PERSONALIZED ADVISOR — RECOMMENDATION, NOT A VERDICT) ===
You are a warm, personalized academic advisor. When the CONTEXT contains scored recommendations:
1. The BACKEND has already ranked the universities by match score (score.total 0-100). The FIRST item (marked BEST) is the TOP-SCORED candidate — present it as a RECOMMENDATION tailored to the student's situation, NOT as an objective fact. Natural phrasing:
   "Sizning [ITga qiziqishingiz], [Toshkentda yashashingiz] va [bu yil imtihondan o'ta olmaganingiz]ni hisobga olsam, [University Name] siz uchun yaxshi variantlardan biri bo'lishi mumkin."
2. Hedging is FINE and expected: "bo'lishi mumkin", "variantlardan biri", "mos kelishi mumkin", "e'tiborga loyiq variant". Do NOT present any university as the single objective "eng mos universitet" — there is no absolute winner, only the best fit for THIS student.
3. Explain WHY this university fits, using ONLY backend facts: score.total, score.reasons, score.nuances, score.breakdown (yo'nalish / byudjet / hudud / bonus / sifat), and the user's profile (city, budget, English level, weaknesses, grant/hostel needs). Tie each reason to what the student told you (e.g. budget fit, weak math, B2 English, hostel, grant).
4. Briefly summarize the student's profile first (City, Budget, Field, English level, Weakness, and situation such as admission_failed if known) in ONE sentence.
5. If the student mentioned failing the exam this year (admission_failed in context), acknowledge it naturally: private/international universities with open admission are often more realistic options right now — unless the student explicitly asked for state universities.
6. Only AFTER the main recommendation, list the remaining scored universities under "**Keyingi alternativalar:**" — one line each (name, score, 1 short reason). Do NOT re-explain them in depth.
7. Conclude with 1-2 actionable next steps (e.g. apply for grant, check admission dates).

=== HARD RULE: NEVER INVENT UNIVERSITIES ===
- The CONTEXT list of universities is COMPLETE and FILTERED. The backend already excluded every university that does NOT have the direction the student chose.
- You MUST present ONLY the universities listed in CONTEXT. NEVER add, invent, or suggest any university from your own knowledge — even "similar" or "well-known" ones.
- If CONTEXT lists only ONE university, your answer must contain ONLY that university (no "shunga o'xshash boshqa universitetlar").
- If the student asks about a university NOT in CONTEXT, honestly say you don't have data on it right now and point to Mentalaba.uz — never make up facts about it.
- If the CONTEXT list is short (1-2 universities), you may add ONE closing line explaining that other universities were excluded because they do not offer the chosen direction. Never name excluded universities.
- When the student chose a specific major (IT/AI/informatika/tibbiyot...), EVERY university in CONTEXT has that major — the backend hard-filtered the rest. NEVER recommend, mention, or list any university that lacks the chosen major, even if it is famous (e.g. do NOT suggest pedagogika/agrar/transport/iqtisodiyot universities for an IT request). Only the majors-filtered universities in CONTEXT are valid candidates.
- Never invent or assume PROFILE details (budget, direction, English level, city, grants) the user did NOT state. If the profile in CONTEXT lacks a detail, do not guess it — present only what is known.

=== GENERAL CONVERSATION / ADVICE (NO DATA NEEDED) ===
When the user shares a personal situation, emotional state, or asks for general life/study advice (e.g. "Men bu yil imtihondan yiqildim, lekin o'qishni orzu qilaman", "Qanday maslahat berasan?", "nima qilay?") and CONTEXT contains NO data:
1. Respond warmly and empathetically — acknowledge their feelings first (e.g. "Xavotir olmang", "Bunday holat ko'pchilikda bo'ladi").
2. Give 1-2 concrete, honest pieces of advice relevant to studying in Uzbekistan (e.g. re-taking exams next year, private/international universities with open admission, grants, vocational options).
3. End with ONE simple question to continue the conversation (e.g. "Qaysi yo'nalishga qiziqasiz?" or "Qaysi shaharda o'qimoqchisiz?").
4. Never invent universities, prices, or deadlines. If you mention an option, point to Mentalaba.uz as a reference.
5. Keep it concise — 3-6 short paragraphs, at most one emoji.

=== COMPARISON OUTPUT (BE DECISIVE — NO DODGING) ===
When the user asks to COMPARE universities or categories (e.g. "Davlatmi yoki xususiymi?", "TATU va INHA qaysi yaxshi?") and the CONTEXT contains a "Taqqoslash:" list of universities:
1. ALWAYS name and use the universities from the CONTEXT list. NEVER answer with generic advice without mentioning them.
2. Give a firm verdict in the FIRST sentence — e.g. "Sizning holatingizda davlat universitetlari yaxshiroq, chunki..." or "Byudjetingiz uchun TATU mos, chunki...".
3. Then build a compact comparison (bullets or table): name each university from CONTEXT with its type, location, tuition, grant.
4. Do NOT say "har ikkalasi o'ziga xos afzalliklarga ega" or "shaxsiy ehtiyojlaringizga qarab" as the main answer. Give a concrete recommendation. If truly no data exists, say so honestly.
5. NEVER invent universities beyond the CONTEXT "Taqqoslash:" list.

=== RULES ===
- Use ONLY facts provided in the CONTEXT. Never invent tuition fees, grant details, or deadlines.
- Never invent or add universities that are not in the CONTEXT list.
- Use at most ONE emoji per message.
- Always respond in the same language the user wrote in (uz/ru/en).`;
    return dataFirstPrompt;
  }

  buildContext(toolResults: ToolResult[], sessionContext: SessionContext, language: string = "uz"): string {
    const parts: string[] = [];

    for (const result of toolResults) {
      if (!result.success || !result.data) continue;

      switch (result.tool) {
        case "search_university": {
          // Yangi format: { universities, universityOverview, regionOverview } yoki eski format: array
          const isObjectFormat = !Array.isArray(result.data) && result.data?.universities !== undefined;
          const data = isObjectFormat ? (result.data as any).universities : (Array.isArray(result.data) ? result.data : [result.data]);
          const overview = isObjectFormat ? (result.data as any).universityOverview : null;
          const regionOverview = isObjectFormat ? (result.data as any).regionOverview : null;

          // REGION OVERVIEW — region bo'yicha so'ralganda ("Toshkentda nechta universitet?")
          if (regionOverview?.regionSpecific) {
            const regionNames: Record<number, string> = {
              1: 'Qoraqalpogiston Respublikasi', 2: 'Andijon viloyati', 3: 'Buxoro viloyati',
              4: 'Jizzax viloyati', 5: 'Qashqadaryo viloyati', 6: 'Navoiy viloyati',
              7: 'Namangan viloyati', 8: 'Samarqand viloyati', 9: 'Surxondaryo viloyati',
              10: 'Sirdaryo viloyati', 11: 'Toshkent viloyati', 12: "Farg'ona viloyati",
              13: 'Xorazm viloyati', 14: 'Toshkent shahri', 15: 'Boshqa',
            };
            const rn = regionNames[regionOverview.regionId] || `Region ${regionOverview.regionId}`;
            const rs = regionOverview.regionSpecific;
            parts.push(`=== REGION UNIVERSITY DATA: ${rn} ===`);
            parts.push(`Total universities in ${rn}: ${rs.total}`);
            if (rs.state > 0) parts.push(`  🏛 State (davlat): ${rs.state}`);
            if (rs.private > 0) parts.push(`  🏢 Private (xususiy): ${rs.private}`);
            if (rs.international > 0) parts.push(`  🌍 International (xalqaro): ${rs.international}`);
            parts.push("");
            parts.push("INSTRUCTION: Use this data to give the exact count and breakdown for the requested region.");
            parts.push("If the user asks for the count, FIRST give the total number, THEN list the universities.");
            parts.push("");
          }

          // UNIVERSITY OVERVIEW — umumiy savol (nechta universitet, qanday turlar)
          if (overview) {
            parts.push("=== UNIVERSITY OVERVIEW (general info) ===");
            parts.push(`Total universities in Uzbekistan: ${overview.totalCount}`);
            parts.push(`\nBreakdown by type (from Mentalaba API):`);
            parts.push(`  🏛 State universities (davlat): ${overview.categories.state}`);
            parts.push(`  🏢 Private universities (xususiy): ${overview.categories.private}`);
            parts.push(`  🌍 International universities (xalqaro): ${overview.categories.international}`);
            parts.push(`\nExample universities:`);
            if (overview.universityExamples?.length) {
              for (const ex of overview.universityExamples.slice(0, 6)) {
                parts.push(`  - ${ex.name} (${ex.type}) — slug: ${ex.slug}`);
              }
            }
            parts.push("");
            parts.push("INSTRUCTION: Use this data to answer the user about university count and types.");
            parts.push("Do NOT invent any categories that are not listed above.");
            parts.push("");
          }

          // Batafsil universitet ma'lumotlari (odatdagidek)
          if (data.length > 0) {
            parts.push("=== UNIVERSITY DATA ===");
            for (const uni of data) {
              parts.push(`University: ${uni.fullNameUz || uni.fullNameEn}`);
              if (uni.abbrNameUz) parts.push(`Abbreviation: ${uni.abbrNameUz}`);
              if (uni.descriptionUz) parts.push(`Description: ${uni.descriptionUz?.substring(0, 800)}`);
              if (uni.institutionCategory) parts.push(`Type: ${uni.institutionCategory}`);
              if (uni.location) parts.push(`Location: ${uni.location}`);
              parts.push(`Grant: ${uni.hasGrant ? "✅ Available" : "❌ Not available"}`);
              parts.push(`Accommodation: ${uni.hasAccommodation ? "✅ Available" : "❌ Not available"}`);
              if (uni.tuition) parts.push(`Tuition: ${uni.tuition}`);
              if (uni.phone) parts.push(`Phone: ${uni.phone}`);
              if (uni.email) parts.push(`Email: ${uni.email}`);
              if (uni.website) parts.push(`Website: ${uni.website}`);
              if (uni.slug) parts.push(`Slug (use for Mentalaba link): ${uni.slug}`);
              if (uni.isOpenForAdmission !== undefined) {
                parts.push(`Admission: ${uni.isOpenForAdmission ? "✅ Open" : "❌ Closed"}`);
              }
              if (uni.admissionStartDate) parts.push(`Admission Start: ${uni.admissionStartDate}`);
              if (uni.admissionDeadline) parts.push(`Admission Deadline: ${uni.admissionDeadline}`);
              if (uni.foundedYear) parts.push(`Founded: ${uni.foundedYear}`);
              if (uni.studentsCount) parts.push(`Students: ~${Math.round(uni.studentsCount / 1000)}k`);
              if (uni.isPartner) parts.push(`Platform Partner: ✅ Yes`);
              if (uni.directionCount !== undefined) parts.push(`Number of directions: ${uni.directionCount}`);
              parts.push("");
            }
          }
          break;
        }

        case "search_direction": {
          // Tool endi data ni { directions, universities, universityDirections } formatida qaytaradi
          const directionsData = Array.isArray(result.data)
            ? { directions: result.data, universities: [], universityDirections: undefined }
            : result.data;
          const dirList = Array.isArray(directionsData.directions) ? directionsData.directions : [];
          const uniList = Array.isArray(directionsData.universities) ? directionsData.universities : [];
          const uniDirections = directionsData.universityDirections;

          // YANGI: Aniq universitet bo'yicha so'ralganda — barcha yo'nalish nomlari bilan
          if (uniDirections) {
            parts.push("=== UNIVERSITY SPECIFIC DIRECTIONS (REAL DATA from API) ===");
            parts.push(`University: ${uniDirections.universityName}`);
            parts.push(`Total directions: ${uniDirections.totalCount}`);
            parts.push("");
            parts.push("Direction names (REAL — use these, do NOT invent others):");
            const names = uniDirections.directionNames || [];
            names.forEach((name: string, i: number) => {
              parts.push(`  ${i + 1}. ${name}`);
            });
            parts.push("");
            parts.push("INSTRUCTION: Use ONLY the direction names listed above. Do NOT add or invent any directions.");
            parts.push("If the user asks for the list, show these exact names. First mention the total count, then list them.");
            parts.push("");
            break; // Skip the rest of the direction_data block
          }

          parts.push("=== DIRECTION DATA ===");
          if (dirList.length === 0) {
            parts.push("RESULT: No matching directions found for this query.");
            parts.push("INSTRUCTION: Tell the user honestly that no matching direction was found, and ask a clarifying question (e.g. which field/city/degree) instead of inventing one.");
          } else {
            for (const dir of dirList) {
              parts.push(`Direction: ${dir.nameUz || dir.nameEn}`);
              if (dir.universityName) parts.push(`University: ${dir.universityName}`);
              if (dir.universitySlug) parts.push(`University slug: ${dir.universitySlug}`);
              parts.push("");
            }
          }

          // YANGI: mos yo'nalishlar topilgan universitetlarning TO'LIQ ma'lumoti
          // (search_direction endi bu ma'lumotni ham qaytaradi — getDirectionsByUniversity +
          // getUniversityUserSide orqali)
          if (uniList.length > 0) {
            parts.push("=== MATCHING UNIVERSITIES (full details — use this to recommend) ===");
            for (const uni of uniList) {
              parts.push(`University: ${uni.fullNameUz || uni.fullNameEn}`);
              if (uni.descriptionUz) parts.push(`Description: ${uni.descriptionUz?.substring(0, 800)}`);
              if (uni.institutionCategory) parts.push(`Type: ${uni.institutionCategory}`);
              if (uni.location) parts.push(`Location: ${uni.location}`);
              parts.push(`Grant: ${uni.hasGrant ? "✅ Available" : "❌ Not available"}`);
              parts.push(`Accommodation: ${uni.hasAccommodation ? "✅ Available" : "❌ Not available"}`);
              if (uni.tuition) parts.push(`Tuition: ${uni.tuition}`);
              if (uni.phone) parts.push(`Phone: ${uni.phone}`);
              if (uni.website) parts.push(`Website: ${uni.website}`);
              if (uni.slug) parts.push(`Slug (use for Mentalaba link): ${uni.slug}`);
              parts.push(`Admission: ${uni.isOpenForAdmission ? "✅ Open" : "❌ Closed"}`);
              if (uni.studentsCount) parts.push(`Students: ~${Math.round(uni.studentsCount / 1000)}k`);
              parts.push("");
            }
          }
          break;
        }

        case "list_directions": {
          const categories = Array.isArray(result.data?.categories) ? result.data.categories : [];
          parts.push("=== AVAILABLE DIRECTION CATEGORIES (catalog) ===");
          if (categories.length === 0) {
            parts.push("No categories available.");
          } else {
            categories.forEach((c: any, i: number) => {
              parts.push(`${i + 1}. ${c.icon || '📚'} ${c.label || c.id}`);
            });
          }
          parts.push("");
          parts.push("INSTRUCTION: This is a CATALOG request — the user asked what directions exist.");
          parts.push("List the categories above and ask which one interests them. Do NOT search for directions.");
          parts.push("");
          break;
        }

        case "search_tuition": {
          const d = result.data;
          if (d?.hasData) {
            parts.push("=== UNIVERSITY TUITION RANGES (sorted cheapest first) ===");
            parts.push(`Tuition range across universities: ${(d.minTuition / 1000000).toFixed(0)} - ${(d.maxTuition / 1000000).toFixed(0)} mln so'm`);
            if (Array.isArray(d.universities)) {
              for (const uni of d.universities.slice(0, 10)) {
                parts.push(`  - ${uni.name}: ${uni.tuition}${uni.location ? ` (${uni.location})` : ''} — slug: ${uni.slug || 'N/A'}`);
              }
            }
            parts.push("INSTRUCTION: Use these real tuition numbers when the user asks about prices. Do NOT invent specific numbers.");
            parts.push("");
          }
          break;
        }

        case "search_grants": {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          const activeGrants = data.filter((g: any) => g.status === "active");
          if (activeGrants.length === 0) {
            parts.push("=== GRANT DATA ===");
            parts.push("RESULT: No active grants found on Mentalaba platform.");
            parts.push("INSTRUCTION: Do NOT invent or make up grant information. Tell the user there are no active grants right now and suggest they check Mentalaba.uz/grants for updates or explore universities with grant options.");
            parts.push("");
          } else {
            parts.push("=== GRANT DATA ===");
            for (const grant of activeGrants) {
              parts.push(`Grant: ${grant.grantTitleUz || grant.grantTitleEn}`);
              if (grant.universityNameUz) parts.push(`University: ${grant.universityNameUz}`);
              if (grant.regionNameUz) parts.push(`Region: ${grant.regionNameUz}`);
              if (grant.grantDescUz) parts.push(`Details: ${grant.grantDescUz?.substring(0, 300)}`);
              parts.push(`Created: ${grant.createdAt ? new Date(grant.createdAt).toLocaleDateString() : "N/A"}`);
              parts.push("");
            }
          }
          break;
        }

        case "search_news": {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          parts.push("=== NEWS DATA ===");
          for (const news of data.slice(0, 5)) {
            parts.push(`Title: ${news.titleUz || news.titleEn}`);
            parts.push(`Date: ${news.createdAt ? new Date(news.createdAt).toLocaleDateString() : "N/A"}`);
            if (news.descriptionUz) parts.push(`Summary: ${news.descriptionUz?.substring(0, 200)}...`);
            parts.push("");
          }
          break;
        }

        case "recommend": {
          const data = result.data;
          if (data?.needsClarification) {
            parts.push("=== RECOMMENDATION: NEEDS CLARIFICATION ===");
            parts.push("The user wants a recommendation but hasn't specified enough details.");
            parts.push("Known preferences: " + JSON.stringify(data.preferences?.known || {}));
            parts.push("Missing info: " + (data.preferences?.missing || []).join(", "));
            parts.push("");
            parts.push("INSTRUCTION: Ask the missing questions ONE AT A TIME in a friendly way.");
            parts.push("Fetch only the FIRST missing question from this list:");
            parts.push("  1. If 'region' is missing → ask 'Qaysi shahar yoki viloyatda o'qimoqchisiz?'");
            parts.push("  2. Else if 'directionCategory' is missing → ask 'Qanday yo'nalishga qiziqasiz?'");
            parts.push("  3. Else if 'institutionCategory' is missing → ask 'Davlatmi yoki xususiy universitetmi?'");
            parts.push("IMPORTANT: Ask only ONE question. Wait for the user to answer before asking more.");
            parts.push("");
          } else if (data?.recommendations?.length > 0) {
            parts.push("=== TOP 5 RECOMMENDED UNIVERSITIES (Calculated by Backend Recommendation Engine) ===");
            parts.push(`User Preferences & Profile: ${JSON.stringify(data.preferences || {})}`);
            parts.push("");
            parts.push("Backend-Scored Universities (sorted best match to lower):");
            for (let idx = 0; idx < data.recommendations.length; idx++) {
              const uni = data.recommendations[idx];
              const score = uni.score || {};
              parts.push(`${idx + 1}. ${uni.fullNameUz || uni.fullNameEn} (Score: ${score.total || 80}/100)`);
              if (uni.institutionCategory) parts.push(`   Type: ${uni.institutionCategory}`);
              if (uni.location) parts.push(`   Location: ${uni.location}`);
              if (uni.tuition && uni.tuition !== 'N/A') parts.push(`   Tuition: ${uni.tuition}`);
              parts.push(`   Grant: ${uni.hasGrant ? "✅ Available" : "❌ Not available"}`);
              parts.push(`   Accommodation: ${uni.hasAccommodation ? "✅ Available" : "❌ Not available"}`);
              if (score.reasons?.length > 0) parts.push(`   Nega to'g'ri keladi (Pros): ${score.reasons.join("; ")}`);
              if (score.nuances?.length > 0) parts.push(`   Nimaga e'tibor berish kerak (Nuances): ${score.nuances.join("; ")}`);
              if (uni.slug) parts.push(`   Slug (use for Mentalaba link): ${uni.slug}`);
              parts.push("");
            }
            if (data.directions?.length > 0) {
              parts.push(`Directions found in these universities: ${data.directions.length} matches`);
              for (const dir of data.directions.slice(0, 10)) {
                parts.push(`  - ${dir.nameUz || dir.nameEn} (${dir.universityName})`);
              }
              parts.push("");
            }
            if (data.grants?.length > 0) {
              parts.push(`Available grants: ${data.grants.length} found`);
              for (const g of data.grants) {
                parts.push(`  - ${g.grantTitleUz || g.grantTitleEn} @ ${g.universityNameUz || ''}`);
              }
              parts.push("");
            }
            parts.push("INSTRUCTION: Recommend these universities to the user based on their preferences.");
            parts.push("Explain WHY each university matches their needs. Suggest next steps.");
            parts.push("");
          } else {
            parts.push("=== RECOMMENDATION ===");
            parts.push("RESULT: No matching universities found for the given preferences.");
            parts.push("INSTRUCTION: Tell the user honestly that no universities match their criteria.");
            parts.push("Suggest they try different preferences (e.g. different city, different field).");
            parts.push("");
          }
          break;
        }

        case "get_university": {
          // BOSQICH 20 (entity resolution): qabul ma'lumoti — FAQAT REAL API
          // faktlari LLM'ga beriladi va LLM'ga to'qish TAQIQLANADI.
          const data = Array.isArray(result.data) ? result.data : [result.data];
          parts.push("=== ADMISSION DATA (REAL from API — do NOT invent anything else) ===");
          for (const uni of data) {
            if (uni.notFound) {
              parts.push(`University "${uni.name}" was NOT FOUND in the database.`);
              parts.push("INSTRUCTION: Tell the user this university was not found and ask for the full name — do NOT guess which university they meant.");
              continue;
            }
            parts.push(`University: ${uni.name}`);
            if (uni.slug) parts.push(`Slug: ${uni.slug}`);
            if (uni.isOpen !== undefined) parts.push(`Admission: ${uni.isOpen ? "✅ Open" : "❌ Closed"}`);
            if (uni.startDate) parts.push(`Admission Start: ${uni.startDate}`);
            if (uni.deadline) parts.push(`Admission Deadline: ${uni.deadline}`);
            if (uni.phone) parts.push(`Admission Phone: ${uni.phone}`);
            if (uni.quota) parts.push(`Quota: ${uni.quota}`);
          }
          parts.push("");
          parts.push("INSTRUCTION: Answer ONLY with the admission facts listed above.");
          parts.push("Do NOT invent passing scores (kirish ballari), exam subjects, or exact dates that are not listed above.");
          parts.push("If the user asks about data not present above (e.g. passing scores), honestly say the database does not have it yet and link to https://mentalaba.uz/universities");
          parts.push("");
          break;
        }

        case "compare_universities": {
          const data = Array.isArray(result.data) ? result.data : [result.data];
          parts.push("=== COMPARISON DATA (for displaying as comparison table) ===");
          for (const uni of data) {
            parts.push(`University: ${uni.name}`);
            if (uni.slug) parts.push(`Slug: ${uni.slug}`);
            parts.push(`Type: ${uni.type}`);
            parts.push(`Location: ${uni.location}`);
            parts.push(`Grant: ${uni.hasGrant ? "✅ Available" : "❌ Not available"}`);
            parts.push(`Accommodation: ${uni.hasAccommodation ? "✅ Available" : "❌ Not available"}`);
            parts.push(`Tuition: ${uni.tuition}`);
            if (uni.directionCount) parts.push(`Directions: ${uni.directionCount}`);
            if (uni.studentsCount) parts.push(`Students: ~${Math.round(uni.studentsCount / 1000)}k`);
            parts.push(`Admission: ${uni.isOpenForAdmission ? "✅ Open" : "❌ Closed"}`);
            if (uni.website) parts.push(`Website: ${uni.website}`);
            if (uni.educationTypes?.length) {
              parts.push(`Education types: ${uni.educationTypes.map((e: any) => e.name).join(", ")}`);
            }
            if (uni.degrees?.length) {
              parts.push(`Degrees: ${uni.degrees.map((d: any) => d.name).join(", ")}`);
            }
            if (uni.educationLanguages?.length) {
              parts.push(`Languages: ${uni.educationLanguages.map((l: any) => l.name).join(", ")}`);
            }
            parts.push("");
          }
          break;
        }
      }
    }

    // Add session context
    if (sessionContext.currentUniversity) {
      parts.push("=== SESSION CONTEXT ===");
      parts.push(`Current university in context: ${sessionContext.currentUniversity.fullNameUz}`);
      if (sessionContext.currentDirection) {
        parts.push(`Current direction in context: ${sessionContext.currentDirection.nameUz}`);
      }
      parts.push(`Session language: ${sessionContext.language}`);
    }

    return parts.join("\n");
  }

  buildPrompt(
    systemPrompt: string,
    context: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): string {
    const parts: string[] = [];

    parts.push(systemPrompt);
    parts.push("\n---\n");

    if (context.trim()) {
      parts.push("CONTEXT (Use this data to answer):");
      parts.push(context.trim());
      parts.push("\n---\n");
    }

    if (conversationHistory.length > 0) {
      parts.push("CONVERSATION HISTORY:");
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role !== "system") {
          parts.push(`${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`);
        }
      }
      parts.push("\n---\n");
    }

    parts.push(`User: ${userMessage}`);
    parts.push("Assistant: ");

    return parts.join("\n");
  }
}

export const contextBuilder = new ContextBuilder();
