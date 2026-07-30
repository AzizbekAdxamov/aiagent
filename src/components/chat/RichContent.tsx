"use client";

import { useMemo, useState } from "react";
import { UniversityCard } from "@/components/cards/UniversityCard";
import { DirectionCard } from "@/components/cards/DirectionCard";
import { GrantCard } from "@/components/cards/GrantCard";
import { NewsCard } from "@/components/cards/NewsCard";
import { CardGallery } from "./CardGallery";
import { ComparisonTable } from "./ComparisonTable";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Copy,
  Brain,
  Sparkles,
  Building2,
  BookOpen,
  Award,
  Newspaper,
} from "lucide-react";

interface ParsedBlock {
  type: "text" | "university-list" | "university" | "direction" | "grant" | "news" | "comparison" | "section-header";
  content: any;
  html?: string;
}

export function RichContent({ content }: { content: string }) {
  const blocks = useMemo(() => parseContent(content), [content]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "section-header":
            return (
              <div key={index} className="flex items-center gap-2 pt-2 pb-1">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary-400 to-secondary-500" />
                <h3 className="text-sm font-bold text-gray-800">
                  {block.content}
                </h3>
              </div>
            );

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
                className="prose-custom text-sm leading-relaxed text-gray-700"
              >
                <div
                  className="inline"
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
                {block.html.length > 1000 && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(content);
                      setCopiedIndex(index);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    className="inline-flex items-center gap-1 ml-1 text-primary-500 hover:text-primary-600 text-xs transition-colors"
                  >
                    {copiedIndex === index ? (
                      <><Check className="w-3 h-3 text-green-500" /> Nusxalandi</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Nusxa olish</>
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

    // Section header detection
    if (/^#{1,3}\s+(.+)+$/.test(trimmed)) {
      flushText();
      const title = trimmed.replace(/^#+\s*/, "");
      blocks.push({ type: "section-header", content: title, html: undefined });
      continue;
    }

    // University card detection: "**N. University Name**"
    // or numbered list with university names followed by details
    const uniMatch = trimmed.match(
      /^\*\*(\d+\.\s*)?(.+?)(?:\*\*)?\s*(🏛|🌍|🏢)?\s*(💰|🏠)?$/
    );
    if (uniMatch && (trimmed.includes("🏛") || trimmed.includes("🌍") || trimmed.includes("🏢"))) {
      flushText();
      // Gather university details from next lines until empty line
      const details: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "" && !lines[j].trim().match(/^\*\*/)) {
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
      while (j < lines.length && lines[j].trim() !== "" && !lines[j].trim().match(/^\d\.\s/)) {
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
      while (j < lines.length && lines[j].trim() !== "") {
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

    // Comparison table detection (contains | separator and comparison keywords)
    if (trimmed.includes("|") && trimmed.match(/\b(University|Universitet|Turi|Manzil|Grant|To'lov)\b/i)) {
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
      while (j < lines.length && lines[j].trim() !== "" && !lines[j].trim().match(/^\d+\./)) {
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

function extractUniversityFromMarkdown(title: string, details: string[]): any {
  const name = title.replace(/^\*\*/, "").replace(/\*\*$/, "").replace(/^\d+\.\s*/, "").replace(/[🏛🌍🏢💰🏠]\s*/g, "").trim();
  const uni: any = { fullNameUz: name };

  for (const line of details) {
    const l = line.trim();
    if (l.includes("📍")) uni.location = l.replace(/📍\s*/, "").replace(/\*/, "").trim();
    else if (l.includes("💵") || l.includes("💰")) uni.tuition = l.replace(/[💵💰]\s*/, "").replace(/\*/, "").trim();
    else if (l.includes("🏛") || l.includes("Davlat") || l.includes("Xususiy") || l.includes("Xalqaro")) {
      uni.institutionCategory = l.replace(/[🏛🏢🌍]\s*/, "").trim();
    }
    else if (l.includes("Grant")) uni.hasGrant = l.includes("Available") || l.includes("Mavjud") || l.includes("✅");
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
      const name = l.replace(/\|/g, "").replace(/\*\*/g, "").replace(/^\d+\.\s*/, "").trim();
      if (name) {
        currentUni = { name };
        items.push(currentUni);
      }
    } else if (currentUni && l.includes("|")) {
      const cells = l.split("|").map((c: string) => c.trim()).filter(Boolean);
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

/**
 * Markdown matnni HTML ga aylantirish (yaxshilangan versiya)
 */
function renderMarkdown(text: string): string {
  if (!text.trim()) return "";

  let html = text;

  // Escape HTML
  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks (triple backticks) must be processed FIRST
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match: string, lang: string, code: string) => {
      const langLabel = lang
        ? `<div class="flex items-center justify-between px-4 py-2 bg-gray-900 rounded-t-xl border-b border-gray-700">
            <span class="text-gray-400 text-xs font-mono">${lang}</span>
            <span class="text-gray-500 text-xs">code</span>
          </div>`
        : "";
      return `${langLabel}<pre class="code-block ${lang ? "rounded-t-none" : ""}"><code>${code
        .trim()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</code></pre>`;
    }
  );

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-md text-xs font-mono border border-primary-100">$1</code>'
  );

  // Headers (skip if they're just section markers)
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-primary-600 font-bold text-base mt-4 mb-2">$1</h3>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-primary-600 font-bold text-lg mt-5 mb-2">$1</h2>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="text-primary-600 font-bold text-xl mt-5 mb-3">$1</h1>'
  );

  // Bold + italic
  html = html.replace(
    /\*\*\*(.+?)\*\*\*/g,
    '<strong class="font-bold text-gray-900"><em>$1</em></strong>'
  );
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-gray-900">$1</strong>'
  );
  html = html.replace(/\*(.+?)\*/g, '<em class="text-gray-600">$1</em>');

  // Links with emoji
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, linkText: string, url: string) => {
      if (linkText.match(/[🏛🌍🏢💰📚📰📌👉🏻]/)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 hover:text-primary-800 text-xs font-medium transition-all duration-200 border border-primary-100 hover:border-primary-200 shadow-sm hover:shadow">
          ${linkText}
        </a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-primary-700 underline decoration-primary-300 hover:decoration-primary-500 transition-all duration-200 font-medium">${linkText} ↗</a>`;
    }
  );

  // Tables
  if (html.includes("|") && html.includes("\n|")) {
    html = html.replace(
      /(\|.+\|\s*\n)(\|[-|:\s]+\|\s*\n)?((?:\|.+\|\s*\n?)*)/g,
      (_match: string, headerRow: string, _sepRow: string, bodyRows: string) => {
        const headers = headerRow
          .split("|")
          .filter((h: string) => h.trim())
          .map((h: string) => h.trim());
        let tableHtml =
          '<div class="overflow-x-auto my-3 rounded-xl border border-gray-100 shadow-sm"><table class="min-w-full text-xs divide-y divide-gray-100">';

        tableHtml += "<thead><tr>";
        headers.forEach((h: string) => {
          tableHtml += `<th class="px-3 py-2.5 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">${h}</th>`;
        });
        tableHtml += "</tr></thead>";

        tableHtml += "<tbody class='divide-y divide-gray-50'>";
        const rows = bodyRows.trim().split("\n");
        rows.forEach((row: string, idx: number) => {
          const cells = row
            .split("|")
            .filter((c: string) => c.trim())
            .map((c: string) => c.trim());
          if (cells.length > 0) {
            tableHtml += `<tr class="${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-primary-50/30 transition-colors">`;
            cells.forEach((cell: string) => {
              tableHtml += `<td class="px-3 py-2.5 text-gray-600">${cell}</td>`;
            });
            tableHtml += "</tr>";
          }
        });
        tableHtml += "</tbody></table></div>";

        return tableHtml;
      }
    );
  }

  // Unordered lists
  html = html.replace(
    /^[\s]*[-*•]\s(.+)$/gm,
    '<li class="flex items-start gap-2 text-gray-700"><span class="text-primary-400 mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0"></span><span>$1</span></li>'
  );
  html = html.replace(
    /((?:<li.*>.*<\/li>\n?)+)/g,
    '<ul class="space-y-1 my-2 pl-0">$1</ul>'
  );

  // Ordered lists
  html = html.replace(
    /^(\d+)\.\s(.+)$/gm,
    '<li class="flex items-start gap-2 text-gray-700"><span class="text-primary-500 font-semibold text-xs mt-1 bg-primary-50 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">$1</span><span>$2</span></li>'
  );
  html = html.replace(
    /((?:<li.*>.*<\/li>\n?)+)/g,
    (match: string) => {
      // Don't wrap if already wrapped in ul/ol
      if (match.includes("<ul") || match.includes("<ol")) return match;
      // Check if first li uses the numbered format
      if (match.match(/<li.*>.*<\/li>/)) {
        const firstLi = match.match(/<li[^>]*>(\d+)<\/span>/);
        if (firstLi) return `<ol class="space-y-1.5 my-2 pl-0 list-none">${match}</ol>`;
      }
      return match;
    }
  );

  // Blockquotes
  html = html.replace(
    /^>\s(.+)$/gm,
    '<blockquote class="border-l-4 border-primary-300 bg-primary-50/30 pl-4 py-2 my-2 text-gray-600 italic rounded-r-lg">$1</blockquote>'
  );

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-4 border-gray-100" />');

  // Handle line breaks
  html = html.replace(/\n\n/g, "</p><p class='my-2'>");
  html = html.replace(/\n/g, "<br/>");

  // Wrap in paragraph if needed
  if (
    !html.startsWith("<h") &&
    !html.startsWith("<p") &&
    !html.startsWith("<ul") &&
    !html.startsWith("<ol") &&
    !html.startsWith("<div") &&
    !html.startsWith("<pre") &&
    !html.startsWith("<blockquote") &&
    !html.startsWith("<table") &&
    !html.startsWith("<li")
  ) {
    html = `<p class="my-1">${html}</p>`;
  }

  // Clean up
  html = html.replace(/<p class="my-[01]"><\/p>/g, "");

  return html;
}
