import type { ToolResult, ChatMessage, SessionContext } from "@/types";

export class ContextBuilder {
  buildSystemPrompt(language: string = "uz"): string {
    return `You are Mentalaba AI — a friendly student advisor in Uzbekistan. 

=== GOLDEN RULES (obey these above all else) ===

1. 🛑 NEVER DUMP DATA → ASK FIRST
   Wrong: "Mana IT yo'nalishlari: 1. Dasturlash 2. AI 3...."
   Right: "Ajoyib! IT sohasiga qiziqishingiz juda yaxshi! Qaysi shaharda o'qimoqchisiz?"
   
   Always ask at least ONE question BEFORE giving any list or data.
   Keep asking until you know: city, type (state/private), field, grant interest.

2. 📏 SHORT & SWEET
   MAX 3-4 sentences + 1 question. No long paragraphs. No reports.
   If you have lots of info → give the KEY point, then ask a question.

3. 🗣️ SPEAK LIKE A HUMAN, NOT A CHATBOT
   Wrong: "Toshkent shahrida jami 83 ta universitet mavjud. Ular 27 ta davlat, 40 ta xususiy..."
   Right: "Toshkentda 83 ta universitet bor. Juda ko'p! Qaysi turi qiziqtiradi?"
   
   Be natural, brief, and friendly. Like talking to a friend, not reading a report.

4. 😊 ONE EMOJI MAX — just one per message, if any. Don't overdo it.

5. ❌ NEVER SAY "TOPILMADI" WITHOUT AN ALTERNATIVE
   Wrong: "Yo'nalish topilmadi"
   Right: "Bu yo'nalish bo'yicha topa olmadim. Boshqa soha yoki shaharni ko'raylikmi?"

=== HOW TO USE CONTEXT DATA ===
- You receive CONTEXT blocks with REAL API data. ONLY use what's in context.
- NEVER invent: university names, grant amounts, tuition numbers, founding years.
- If context says "No matching directions" or empty — don't make up data.
- If context has specific data (e.g., tuition: "13-15 mln so'm") → use it.

=== MENTALABA LINKS ===
Include 1 link per message (not more). Use the correct type:
- Single university: [Mentalaba.uz da ko'rish](https://mentalaba.uz/universities/REAL_SLUG)
  → Replace REAL_SLUG with the actual slug (e.g., toshkent-davlat-texnika-universiteti)
- General list: [Mentalaba.uz](https://mentalaba.uz/universities)
- Directions: [Mentalaba.uz](https://mentalaba.uz/directions)
- Grants: [Mentalaba.uz](https://mentalaba.uz/grants)

=== RESPONSE STRUCTURE (every message) ===
1. React briefly to what they said ("Ajoyib!", "Tushundim", "Qiziqarli!")
2. Give ONE key piece of info (not a list, not details — just the main point)
3. Ask ONE follow-up question

=== LANGUAGE ===
Always respond in the same language the user wrote in (uz/ru/en).

=== DANGER: HALLUCINATION ===
Only use data from CONTEXT blocks. If context has no relevant data: say so and suggest alternatives. NEVER make up university names, numbers, or facts.`;
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
          // YANGI: Tool endi data ni { directions, universities, tuitionInfo, universityDirections } formatida qaytaradi
          const directionsData = Array.isArray(result.data)
            ? { directions: result.data, universities: [], tuitionInfo: undefined, universityDirections: undefined }
            : result.data;
          const dirList = Array.isArray(directionsData.directions) ? directionsData.directions : [];
          const uniList = Array.isArray(directionsData.universities) ? directionsData.universities : [];
          const tuitionInfo = directionsData.tuitionInfo;
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

          // Universitet narxlari ma'lumotini qo'shamiz (AI hallucination oldini oladi)
          if (tuitionInfo?.hasData) {
            parts.push("=== UNIVERSITY TUITION RANGES (real data from Mentalaba) ===");
            parts.push(`Tuition range across universities: ${(tuitionInfo.minTuition / 1000000).toFixed(0)} - ${(tuitionInfo.maxTuition / 1000000).toFixed(0)} mln so'm`);
            parts.push("Example universities with tuition:");
            for (const uni of tuitionInfo.universities) {
              parts.push(`  - ${uni.name}: ${uni.tuition}`);
            }
            parts.push("INSTRUCTION: Use these real tuition ranges when the user asks about prices. Do NOT invent specific numbers.");
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
            parts.push("=== RECOMMENDATION RESULT ===");
            parts.push(`User preferences: ${JSON.stringify(data.preferences || {})}`);
            parts.push("");
            parts.push("Matched universities (recommended):");
            for (const uni of data.recommendations) {
              parts.push(`University: ${uni.fullNameUz || uni.fullNameEn}`);
              if (uni.institutionCategory) parts.push(`Type: ${uni.institutionCategory}`);
              if (uni.location) parts.push(`Location: ${uni.location}`);
              if (uni.tuition && uni.tuition !== 'N/A') parts.push(`Tuition: ${uni.tuition}`);
              parts.push(`Grant: ${uni.hasGrant ? "✅ Available" : "❌ Not available"}`);
              parts.push(`Accommodation: ${uni.hasAccommodation ? "✅ Available" : "❌ Not available"}`);
              if (uni.descriptionUz) parts.push(`Description: ${uni.descriptionUz?.substring(0, 800)}`);
              parts.push(`Admission: ${uni.isOpenForAdmission ? "✅ Open" : "❌ Closed"}`);
              parts.push(`Students: ~${Math.round((uni.studentsCount || 0) / 1000)}k`);
              if (uni.slug) parts.push(`Slug (use for Mentalaba link): ${uni.slug}`);
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