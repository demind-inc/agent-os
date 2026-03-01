/**
 * Parses execution console text into sections (## Title) and code blocks (```) for terminal-style UI.
 */

export type ConsoleCodeBlock = {
  type: "code";
  content: string;
  language?: string;
};

export type ConsoleSection = {
  title: string;
  /** Plain text and code block placeholders in order (alternating). */
  parts: (string | ConsoleCodeBlock)[];
};

/**
 * Split full console text into sections by ## headers. Within each section, identify ``` blocks.
 */
export function parseConsoleSections(fullText: string): ConsoleSection[] {
  if (!fullText.trim()) return [];

  const sections: ConsoleSection[] = [];
  const sectionStarts = [...fullText.matchAll(/^##\s+(.+)$/gm)];
  const sectionTitles = sectionStarts.map((m) => m[1]!.trim());
  const sectionIndices = sectionStarts.map((m) => m.index!);

  for (let i = 0; i < sectionIndices.length; i++) {
    const start = sectionIndices[i]!;
    const end = sectionIndices[i + 1] ?? fullText.length;
    const raw = fullText.slice(start, end);
    const firstNewline = raw.indexOf("\n");
    const title = firstNewline >= 0 ? raw.slice(0, firstNewline).replace(/^##\s+/, "").trim() : raw.replace(/^##\s+/, "").trim();
    const body = firstNewline >= 0 ? raw.slice(firstNewline + 1) : "";

    const parts: (string | ConsoleCodeBlock)[] = [];
    const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRe.exec(body)) !== null) {
      const before = body.slice(lastEnd, match.index);
      if (before) parts.push(before);
      parts.push({
        type: "code",
        content: match[2]!.trimEnd(),
        language: match[1]! || undefined,
      });
      lastEnd = codeBlockRe.lastIndex;
    }
    if (lastEnd < body.length) {
      parts.push(body.slice(lastEnd));
    }
    sections.push({ title, parts });
  }

  if (sections.length === 0 && fullText.trim()) {
    sections.push({ title: "Output", parts: [fullText.trim()] });
  }
  return sections;
}
