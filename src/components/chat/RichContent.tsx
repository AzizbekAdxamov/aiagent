"use client";

import { useMemo, useState } from "react";
import { UniversityCard } from "@/components/cards/UniversityCard";
import { DirectionCard } from "@/components/cards/DirectionCard";
import { GrantCard } from "@/components/cards/GrantCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { CardGallery } from "./CardGallery";
import { ComparisonTable } from "./ComparisonTable";
import { Check, Copy } from "lucide-react";

interface ParsedBlock {
  type:
    | "text"
    | "university-list"
    | "university"
    | "direction"
    | "grant"
    | "news"
    | "comparison"
    | "section-header";
  content: any;
  html?: string;
}

export function RichContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseContent(content), [content]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "section-header": {
            const { level, title } = block.content || {};
            const sizeClass =
              level >= 3
                ? "text-[15px] sm:text-base"
                : level === 2
                ? "text-base sm:text-lg"
                : "text-lg sm:text-xl";
            return (
              <div
                key={index}
                className="flex items-center gap-2.5 pt-2 pb-1 -mx-1"
              >
                <div className="w-1 self-stretch min-h-5 rounded-full bg-gradient-to-b from-primary-400 to-secondary-500" />
                <h3
                  className={`${sizeClass} font-bold text-gray-800 dark:text-gray-100 tracking-tight leading-snug`}
                >
                  {title}
                </h3>
              </div>
            );
          }

          case "university-list":
            return <CardGallery key={index} items={block.content} type="university" />;

          case "university":
            return (
              <div key={index} className="my-2">
                <UniversityCard university={block.content} />
              </div>
            );

          case "direction":
            return (
              <div key={index} className="my-2">
                <DirectionCard direction={block.content} />
              </div>
            );

          case "grant":
            return (
              <div key={index} className="my-2">
                <GrantCard grant={block.content} />
              </div>
            );

          case "news":
            return (
              <div key={index} className="my-2">
                <NewsCard news={block.content} />
              </div>
            );

          case "comparison":
            return <ComparisonTable key={index} data={block.content} />;

          case "text":
          default:
            return block.html ? (
              <div
                key={index}
                className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 break-words"
              >
                <div dangerouslySetInnerHTML={{ __html: block.html }} />
                {block.html.length > 1000 && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(content);
                      setCopiedIndex(index);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    className="mt-1 inline-flex items-center gap-1.5 text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs font-medium transition-colors"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" /> Nusxalandi
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Nusxa olish
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null;
        }
      })}
    </div>
  );
}

/* ============================================================
   BLOCK PARSER — matnni mantiqiy bloklarga bo'ladi
   ============================================================ */

function parseContent(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = text.split("\n");
  let currentText: string[] = [];

  function flushText() {
    if (currentText.length > 0) {
      const html = renderMarkdown(currentText.join("\n"));
      if (html.trim()) {
        blocks.push({ type: "text", content: null, html });
      }
      currentText = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Section header detection (level saqlanadi)
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushText();
      blocks.push({
        type: "section-header",
        content: {
          level: headerMatch[1].length,
          title: headerMatch[2].trim(),
        },
        html: undefined,
      });
      continue;
    }

    // University card detection: "**N. University Name** 🏛" (+ details)
    if (
      (trimmed.includes("🏛") || trimmed.includes("🌍") || trimmed.includes("🏢")) &&
      trimmed.match(/^\*\*(\d+\.\s*)?.+?(\*\*)?\s*[🏛🌍🏢]?\s*[💰🏠]?$/)
    ) {
      flushText();
      const details: string[] = [];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !lines[j].trim().match(/^\*\*/) &&
        !lines[j].trim().match(/^#{1,3}\s/)
      ) {
        details.push(lines[j]);
        j++;
      }

      blocks.push({
        type: "university",
        content: extractUniversityFromMarkdown(trimmed, details),
      });
      i = j - 1;
      continue;
    }

    // Grant card detection
    if (trimmed.startsWith("💰") || trimmed.match(/^\*\*.*Grant/i)) {
      flushText();
      const grantLines: string[] = [trimmed];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !lines[j].trim().match(/^\d+\.\s/) &&
        !lines[j].trim().match(/^#{1,3}\s/)
      ) {
        grantLines.push(lines[j]);
        j++;
      }
      blocks.push({
        type: "grant",
        content: extractGrantFromMarkdown(grantLines),
      });
      i = j - 1;
      continue;
    }

    // News card detection
    if (trimmed.startsWith("📰") || trimmed.match(/^\*\*.*Yangilik/i)) {
      flushText();
      const newsLines: string[] = [trimmed];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !lines[j].trim().match(/^#{1,3}\s/)
      ) {
        newsLines.push(lines[j]);
        j++;
      }
      blocks.push({
        type: "news",
        content: extractNewsFromMarkdown(newsLines),
      });
      i = j - 1;
      continue;
    }

    // Comparison table detection (| separator + comparison keywords)
    if (
      trimmed.includes("|") &&
      trimmed.match(/\b(University|Universitet|Turi|Manzil|Grant|To'lov|Yo'nalish)\b/i)
    ) {
      flushText();
      const tableLines: string[] = [trimmed];
      let j = i + 1;
      while (j < lines.length && lines[j].includes("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      blocks.push({
        type: "comparison",
        content: parseComparisonTable(tableLines),
      });
      i = j - 1;
      continue;
    }

    // Direction card detection
    if (trimmed.match(/^\d+\.\s+\*\*.*(?:yo'nalish|yonalish|direction)/i)) {
      flushText();
      const dirLines: string[] = [trimmed];
      let j = i + 1;
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !lines[j].trim().match(/^\d+\./) &&
        !lines[j].trim().match(/^#{1,3}\s/)
      ) {
        dirLines.push(lines[j]);
        j++;
      }
      blocks.push({
        type: "direction",
        content: extractDirectionFromMarkdown(dirLines),
      });
      i = j - 1;
      continue;
    }

    currentText.push(line);
  }

  flushText();
  return blocks;
}

/* ============================================================
   MARKDOWN → HTML (to'g'ri blok asosidagi renderer)
   ============================================================ */

function renderMarkdown(text: string): string {
  if (!text.trim()) return "";

  const lines = text.split("\n");
  const blocks: string[] = [];
  const buf: string[] = [];

  const flushBuf = () => {
    if (buf.length > 0) {
      blocks.push(renderParagraph(buf.join("\n")));
      buf.length = 0;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t === "") {
      flushBuf();
      i++;
      continue;
    }

    // Fenced code block
    if (t.startsWith("```")) {
      flushBuf();
      const lang = t.replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(renderCodeBlock(codeLines.join("\n"), lang));
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushBuf();
      blocks.push('<hr class="my-4 border-gray-100" />');
      i++;
      continue;
    }

    // Heading (parseContent tashqarida oladi, lekin xavfsizlik uchun ham shu yerda)
    if (/^#{1,6}\s+/.test(t)) {
      flushBuf();
      const level = (t.match(/^#+/) || [""])[0].length;
      blocks.push(renderHeading(t.replace(/^#+\s*/, ""), level));
      i++;
      continue;
    }

    // Blockquote (ketma-ket)
    if (/^>\s?/.test(t)) {
      flushBuf();
      const quotes: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quotes.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(renderBlockquote(quotes));
      continue;
    }

    // List (ketma-ket bir xil turdagi + indentlangan davom qatorlari)
    const isOrdered = /^\d+[.)]\s+/.test(t);
    if (isOrdered || /^[-•*]\s+/.test(t)) {
      flushBuf();
      const items: string[] = [];
      let current = "";
      while (i < lines.length) {
        const raw = lines[i];
        const lt = raw.trim();
        if (isOrdered ? /^\d+[.)]\s+/.test(lt) : /^[-•*]\s+/.test(lt)) {
          if (current) items.push(current);
          current = lt.replace(/^\d+[.)]\s+/, "").replace(/^[-•*]\s+/, "");
          i++;
        } else if (lt !== "" && /^\s/.test(raw) && current) {
          // oldingi item'ning davomi (masalan link qatori)
          current += "\n" + lt;
          i++;
        } else {
          break;
        }
      }
      if (current) items.push(current);
      blocks.push(renderList(items, isOrdered));
      continue;
    }

    // Table (ketma-ket | qatorlar)
    if (t.includes("|")) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().includes("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      if (tableLines.length >= 2) {
        flushBuf();
        blocks.push(renderTable(tableLines));
        i = j;
        continue;
      }
    }

    buf.push(line);
    i++;
  }
  flushBuf();

  return blocks.join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline formatlash: kod, bold, italic, linklar, qator tanaffuslari */
function renderInline(text: string): string {
  let html = escapeHtml(text);

  // Inline code
  html = html.replace(
    /`([^`\n]+)`/g,
    '<code class="bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-primary-100 dark:border-primary-900">$1</code>'
  );

  // Bold + italic
  html = html.replace(
    /\*\*\*(.+?)\*\*\*/g,
    '<strong class="font-bold text-gray-900 dark:text-gray-100"><em>$1</em></strong>'
  );
  // Bold
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>'
  );
  // Italic
  html = html.replace(
    /\*([^*\n]+)\*/g,
    '<em class="text-gray-600 dark:text-gray-400">$1</em>'
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match: string, linkText: string, url: string) => {
      // Xavfsizlik: faqat http/https linklar chiqadi (javascript: kabi sxemalar bloklanadi)
      if (!/^https?:\/\//i.test(url)) {
        return `<span>${linkText}</span>`;
      }
      if (/[🏛🌍🏢💰📚📰📌👉🏻🎓📞🌐🔍📄🏠]/u.test(linkText)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 text-[13px] font-medium transition-all duration-200 border border-primary-100 dark:border-primary-900 hover:border-primary-200 dark:hover:border-primary-700 shadow-sm hover:shadow">${linkText}</a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline decoration-primary-300 dark:decoration-primary-700 hover:decoration-primary-500 dark:hover:decoration-primary-500 transition-all duration-200 font-medium break-all">${linkText} ↗</a>`;
    }
  );

  // Line breaks
  html = html.replace(/\n/g, "<br/>");

  return html;
}

function renderParagraph(text: string): string {
  const inline = renderInline(text.trim());
  if (!inline) return "";
  return `<p class="my-1.5">${inline}</p>`;
}

function renderHeading(title: string, level: number): string {
  const size =
    level === 1
      ? "text-lg sm:text-xl"
      : level === 2
      ? "text-base sm:text-lg"
      : "text-[15px] sm:text-base";
  return `<h${level} class="text-gray-800 dark:text-gray-100 font-bold ${size} my-2.5 leading-snug">${renderInline(
    title
  )}</h${level}>`;
}

function renderList(items: string[], ordered: boolean): string {
  const lis = items
    .map((item, idx) => {
      const content = renderInline(item);
      if (ordered) {
        return `<li class="flex items-start gap-2.5 my-1"><span class="mt-[2px] w-5 h-5 shrink-0 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 text-[11px] font-bold flex items-center justify-center">${
          idx + 1
        }</span><span class="min-w-0 flex-1">${content}</span></li>`;
      }
      return `<li class="flex items-start gap-2.5 my-1"><span class="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-primary-400"></span><span class="min-w-0 flex-1">${content}</span></li>`;
    })
    .join("");
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="my-2 space-y-0.5 list-none pl-0">${lis}</${tag}>`;
}

function renderTable(lines: string[]): string {
  const rows = lines.filter(
    (l) => l.trim().includes("|") && !/^\|?[\s:|-]+\|?$/.test(l.trim())
  );
  if (rows.length === 0) return "";

  let html =
    '<div class="my-3 overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800"><table class="min-w-full text-[13px] leading-relaxed divide-y divide-gray-100 dark:divide-gray-700">';

  rows.forEach((row, ri) => {
    const cells = row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length === 0) return;

    if (ri === 0) {
      html += "<thead><tr>";
      cells.forEach((c) => {
        html += `<th class="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700/60 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">${renderInline(
          c.replace(/\*\*/g, "")
        )}</th>`;
      });
      html += "</tr></thead><tbody>";
    } else {
      html += `<tr class="${
        ri % 2 === 1 ? "bg-white dark:bg-gray-800" : "bg-gray-50/40 dark:bg-gray-800/40"
      } hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition-colors">`;
      cells.forEach((c) => {
        html += `<td class="px-3.5 py-2.5 text-gray-600 dark:text-gray-300 align-top">${renderInline(
          c
        )}</td>`;
      });
      html += "</tr>";
    }
  });

  html += "</tbody></table></div>";
  return html;
}

function renderBlockquote(lines: string[]): string {
  const content = lines.map((l) => renderInline(l)).join("<br/>");
  return `<blockquote class="border-l-4 border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-950/30 pl-4 py-2.5 my-2 text-gray-600 dark:text-gray-400 italic rounded-r-xl">${content}</blockquote>`;
}

function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code.trimEnd());
  const langLabel = lang
    ? `<div class="flex items-center justify-between px-4 py-2 bg-gray-800 rounded-t-xl border-b border-gray-700"><span class="text-gray-300 text-xs font-mono">${escapeHtml(
        lang
      )}</span><span class="text-gray-500 text-xs">code</span></div>`
    : "";
  return `<div class="my-3">${langLabel}<pre class="code-block ${
    lang ? "rounded-t-none" : ""
  }"><code>${escaped}</code></pre></div>`;
}

/* ============================================================
   KARTOCHEKALAR UCHUN EXTRACTORLAR
   ============================================================ */

function extractUniversityFromMarkdown(title: string, details: string[]): any {
  const name = title
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/[🏛🌍🏢💰🏠]\s*/g, "")
    .trim();
  const uni: any = { fullNameUz: name };

  for (const line of details) {
    const l = line.trim();
    if (l.includes("📍")) uni.location = l.replace(/📍\s*/, "").replace(/\*/, "").trim();
    else if (l.includes("💵") || l.includes("💰")) uni.tuition = l.replace(/[💵💰]\s*/, "").replace(/\*/, "").trim();
    else if (l.includes("🏛") || l.includes("Davlat") || l.includes("Xususiy") || l.includes("Xalqaro")) {
      uni.institutionCategory = l.replace(/[🏛🏢🌍]\s*/, "").trim();
    } else if (l.includes("Grant")) uni.hasGrant = l.includes("Available") || l.includes("Mavjud") || l.includes("✅");
    else if (l.includes("Accommodation") || l.includes("Yotoqxona")) uni.hasAccommodation = l.includes("Available") || l.includes("Bor") || l.includes("✅");
    else if (l.includes("Admission")) uni.isOpenForAdmission = l.includes("Open") || l.includes("Ochiq") || l.includes("✅");
    else if (l.includes("Slug:")) uni.slug = l.replace(/.*Slug[^:]*:\s*/i, "").trim();
    else if (l.includes("🔍") || l.includes("ko'rish")) {
      const slugMatch = l.match(/universities\/([a-z0-9-]+)/i);
      if (slugMatch) uni.slug = slugMatch[1];
    }
  }

  return uni;
}

function extractDirectionFromMarkdown(lines: string[]): any {
  const dir: any = {};
  for (const line of lines) {
    const l = line.trim();
    if (l.match(/^\d+\.\s+\*\*/)) {
      dir.nameUz = l.replace(/^\d+\.\s+\*\*/, "").replace(/\*\*.*$/, "").trim();
    }
    const uniMatch = l.match(/—\s*(.+)/);
    if (uniMatch) dir.universityName = uniMatch[1].trim();
  }
  return dir;
}

function extractGrantFromMarkdown(lines: string[]): any {
  const grant: any = {};
  for (const line of lines) {
    const l = line.trim().replace(/^\*\*?/, "").replace(/\*\*?$/, "");
    if (l.match(/Grant.*:|\d+[\.\)]/)) {
      grant.grantTitleUz = l.replace(/^\d+[\.\)]\s*/, "").replace(/^.*?:\s*/, "").trim();
    }
  }
  return grant;
}

function extractNewsFromMarkdown(lines: string[]): any {
  const news: any = {};
  for (const line of lines) {
    const l = line.trim().replace(/^\*\*?/, "").replace(/\*\*?$/, "");
    if (l.match(/^\d+\./)) {
      news.titleUz = l.replace(/^\d+\.\s*/, "").trim();
    } else if (l.length > 50) {
      news.descriptionUz = l.substring(0, 300);
    }
  }
  return news;
}

function parseComparisonTable(lines: string[]): any[] {
  const items: any[] = [];
  let currentUni: any = null;

  for (const line of lines) {
    const l = line.trim();
    if (l.includes("|") && l.includes("**")) {
      const name = l
        .replace(/\|/g, "")
        .replace(/\*\*/g, "")
        .replace(/^\d+\.\s*/, "")
        .trim();
      if (name) {
        currentUni = { name };
        items.push(currentUni);
      }
    } else if (currentUni && l.includes("|")) {
      const cells = l
        .split("|")
        .map((c: string) => c.trim())
        .filter(Boolean);
      if (cells.length >= 2) {
        const key = cells[0].replace(/\*\*/g, "").trim();
        const val = cells[1].replace(/\*\*/g, "").trim();
        if (key.includes("Turi")) currentUni.type = val;
        else if (key.includes("Manzil") || key.includes("Location")) currentUni.location = val;
        else if (key.includes("Grant")) currentUni.hasGrant = val.includes("✅") || val.includes("Mavjud");
        else if (key.includes("Yotoqxona") || key.includes("Accommodation")) currentUni.hasAccommodation = val.includes("✅") || val.includes("Bor");
        else if (key.includes("To'lov") || key.includes("Tuition")) currentUni.tuition = val;
        else if (key.includes("Yo'nalish") || key.includes("Directions")) currentUni.directionCount = parseInt(val) || val;
        else if (key.includes("Talaba") || key.includes("Students")) currentUni.studentsCount = val;
        else if (key.includes("Qabul") || key.includes("Admission")) currentUni.isOpenForAdmission = val.includes("✅") || val.includes("Ochiq");
      }
    }
  }

  return items;
}
