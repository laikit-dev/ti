import MarkdownIt from "markdown-it";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js/lib/common";

function escapeHtml(raw: string) {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeLanguage(lang: string) {
  const raw = String(lang ?? "").trim().toLowerCase();
  if (!raw) return "";
  const aliasMap: Record<string, string> = {
    cxx: "cpp",
    "c++": "cpp",
    py: "python",
    tsx: "typescript",
    jsx: "javascript",
    sh: "bash",
    yml: "yaml"
  };
  return aliasMap[raw] ?? raw;
}

function highlightLine(line: string, language: string) {
  if (!line.length) return "&nbsp;";
  if (!language || !hljs.getLanguage(language)) return escapeHtml(line);
  try {
    return hljs.highlight(line, { language, ignoreIllegals: true }).value || escapeHtml(line);
  } catch {
    return escapeHtml(line);
  }
}

function renderHighlightedCode(code: string, language: string) {
  const lines = code.split(/\r?\n/);
  while (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const html = lines
    .map((line, index) => {
      const content = highlightLine(line, language);
      return `<span class="code-line"><span class="line-no">${index + 1}</span><span class="line-content">${content}</span></span>`;
    })
    .join("");
  return {
    html,
    lineNumberWidth: `${Math.max(2, String(lines.length).length)}ch`
  };
}

const renderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
  highlight(code: string, lang: string) {
    const language = normalizeLanguage(lang);
    const hasLanguage = Boolean(language && hljs.getLanguage(language));
    let resolvedLanguage = hasLanguage ? language : "";
    if (!resolvedLanguage) {
      try {
        const auto = hljs.highlightAuto(code);
        resolvedLanguage = auto.language && hljs.getLanguage(auto.language) ? auto.language : "";
      } catch {
        resolvedLanguage = "";
      }
    }

    const className = resolvedLanguage ? `language-${resolvedLanguage}` : "language-plain";
    const renderedCode = renderHighlightedCode(code, resolvedLanguage);
    return `<pre class="hljs code-block"><code class="${className}" style="--code-line-number-width: ${renderedCode.lineNumberWidth}">${renderedCode.html}</code></pre>`;
  }
});

renderer.use(markdownItSub);
renderer.use(markdownItSup);
renderer.use(markdownItFootnote);
renderer.use(markdownItEmoji);
renderer.use(markdownItTexmath, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: {
    throwOnError: false,
    strict: "ignore",
    output: "html"
  }
});

renderer.linkify.set({ fuzzyEmail: false });

renderer.renderer.rules.link_open = (tokens: any[], idx: number, options: any, _env: any, self: any) => {
  const token = tokens[idx];
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noopener noreferrer nofollow");
  return self.renderToken(tokens, idx, options);
};

export function renderLuoguMarkdown(source: string): string {
  const text = String(source ?? "");
  if (!text.trim()) return "";
  const normalizedLatex = text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_all, expr: string) => `\n$$\n${expr}\n$$\n`)
    .replace(/\\\((.+?)\\\)/g, (_all, expr: string) => `$${expr}$`);
  return renderer.render(normalizedLatex);
}
