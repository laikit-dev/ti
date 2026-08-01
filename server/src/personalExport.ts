import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";

export interface PersonalExportUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  avatarUrl: string;
  profileCoverUrl: string;
  bio: string;
  recordsPublic: boolean;
  createdAt: unknown;
}

export interface PersonalExportProblemset {
  id: number;
  title: string;
  description: string;
  problemsetType: string;
  durationMinutes: number;
  questionCount: number;
  createdAt: unknown;
  questions: PersonalExportQuestion[];
}

export interface PersonalExportQuestion {
  id: number;
  index: number;
  type: string;
  groupTitle: string;
  sharedMaterial: string;
  stem: string;
  inputPlaceholder: string;
  options: Array<{ key: string; text: string }>;
  score: number;
  answer: string;
  analysis: string;
}

export interface PersonalExportSubmission {
  id: number;
  problemsetId: number;
  problemsetTitle: string;
  mode: string;
  status: string;
  score: number;
  maxScore: number;
  startedAt: unknown;
  submittedAt: unknown;
  createdAt: unknown;
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function cleanPdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface PdfFontFace {
  name: string;
  path: string;
  ranges: Array<[number, number]>;
}

type PdfLine = Array<{ character: string; face: PdfFontFace }>;

type PdfBlock =
  | { kind: "title"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "section"; text: string }
  | { kind: "space" }
  | { kind: "table"; title: string; rows: Array<[string, string]> };

const require = createRequire(import.meta.url);
let cachedPdfFontFaces: PdfFontFace[] | null = null;

function loadPdfFontFaces(): PdfFontFace[] {
  if (cachedPdfFontFaces) return cachedPdfFontFaces;
  const cssPath = require.resolve("@fontsource/noto-sans-sc/400.css");
  const css = readFileSync(cssPath, "utf8");
  const cssDirectory = dirname(cssPath);
  const faces: PdfFontFace[] = [];
  const blocks = css.match(/@font-face\s*{[^}]+}/g) ?? [];
  for (const [index, block] of blocks.entries()) {
    const source = block.match(/url\((\.\/files\/[^)]+\.woff2)\)/)?.[1];
    const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!source || !unicodeRange) continue;
    const ranges = unicodeRange.split(",").map((range): [number, number] => {
      const [startRaw, endRaw] = range.trim().replace(/^U\+/i, "").split("-");
      const start = Number.parseInt(startRaw, 16);
      const end = endRaw ? Number.parseInt(endRaw, 16) : start;
      return [start, end];
    }).filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end));
    faces.push({
      name: `NotoSansSC-${index}`,
      path: resolve(cssDirectory, source.replace(/\.woff2$/, ".woff")),
      ranges
    });
  }
  if (faces.length === 0) throw new Error("Noto Sans SC font subsets could not be loaded");
  cachedPdfFontFaces = faces;
  return faces;
}

function createPdf(
  blocks: PdfBlock[],
  watermark: { uid: string; timestamp: string },
  editPassword: string
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    pdfVersion: "1.7",
    ownerPassword: editPassword,
    userPassword: "",
    permissions: {
      printing: "highResolution",
      copying: true,
      contentAccessibility: true,
      modifying: false,
      annotating: false,
      fillingForms: false,
      documentAssembly: false
    },
    margins: { top: 44, right: 44, bottom: 64, left: 44 },
    bufferPages: true,
    info: { Title: "保存站有题 - 个人记录导出", Author: "保存站有题" }
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolvePdf, rejectPdf) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolvePdf(Buffer.concat(chunks)));
    doc.on("error", rejectPdf);
  });
  const fontFaces = loadPdfFontFaces();
  fontFaces.forEach((face) => doc.registerFont(face.name, face.path));
  const fallbackFace = fontFaces.find((face) => face.ranges.some(([start, end]) => start <= 0x41 && end >= 0x7a)) ?? fontFaces[0];
  const faceForCharacter = (character: string) => {
    const codePoint = character.codePointAt(0) ?? 0x3f;
    return fontFaces.find((face) => face.ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) ?? fallbackFace;
  };
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  let y = doc.page.margins.top;

  const drawRuns = (characters: Array<{ character: string; face: PdfFontFace }>, x: number, lineY: number, size: number) => {
    let cursorX = x;
    let runFace = characters[0]?.face;
    let run = "";
    const flush = () => {
      if (!run || !runFace) return;
      doc.font(runFace.name).fontSize(size);
      doc.text(run, cursorX, lineY, { lineBreak: false });
      cursorX += doc.widthOfString(run);
      run = "";
    };
    for (const item of characters) {
      if (runFace !== item.face) {
        flush();
        runFace = item.face;
      }
      run += item.character;
    }
    flush();
  };

  const layoutText = (value: unknown, size: number, maxWidth: number): PdfLine[] => {
    const text = cleanPdfText(value) || " ";
    const lines: PdfLine[] = [[]];
    let lineWidth = 0;
    for (const character of Array.from(text)) {
      const face = faceForCharacter(character);
      doc.font(face.name).fontSize(size);
      const characterWidth = doc.widthOfString(character);
      if (lineWidth + characterWidth > maxWidth && lines.at(-1)!.length > 0) {
        lines.push([]);
        lineWidth = 0;
      }
      lines.at(-1)!.push({ character, face });
      lineWidth += characterWidth;
    }
    return lines;
  };

  const addPage = () => {
    doc.addPage();
    y = doc.page.margins.top;
  };

  const drawParagraph = (value: unknown, size = 10, color = "#1f2937", gapAfter = 7) => {
    const lineHeight = Math.ceil(size * 1.55);
    const lines = layoutText(value, size, contentWidth);
    for (const line of lines) {
      if (y + lineHeight > bottom()) {
        addPage();
      }
      doc.fillColor(color);
      drawRuns(line, doc.page.margins.left, y, size);
      y += lineHeight;
    }
    y += gapAfter;
  };

  const drawMergedTableRow = (text: string, background = "#eef3ff", color = "#315efb") => {
    const size = 10;
    const padding = 7;
    const lineHeight = 16;
    const lines = layoutText(text, size, contentWidth - padding * 2);
    const height = lines.length * lineHeight + padding * 2;
    if (y + height > bottom()) addPage();
    doc.rect(doc.page.margins.left, y, contentWidth, height).fillAndStroke(background, "#b8c7e6");
    doc.fillColor(color);
    lines.forEach((line, index) => drawRuns(line, doc.page.margins.left + padding, y + padding + index * lineHeight, size));
    y += height;
  };

  const drawTableRow = (labelInput: string, valueInput: string) => {
    const size = 9;
    const lineHeight = 14;
    const padding = 6;
    const labelWidth = 78;
    const valueWidth = contentWidth - labelWidth;
    let remaining = layoutText(valueInput || "无", size, valueWidth - padding * 2);
    let firstPart = true;
    while (remaining.length > 0) {
      if (bottom() - y < lineHeight + padding * 2) addPage();
      const availableLines = Math.max(1, Math.floor((bottom() - y - padding * 2) / lineHeight));
      const valueLines = remaining.splice(0, availableLines);
      const label = firstPart ? labelInput : `${labelInput}（续）`;
      const labelLines = layoutText(label, size, labelWidth - padding * 2);
      const rowHeight = Math.max(labelLines.length, valueLines.length) * lineHeight + padding * 2;
      if (y + rowHeight > bottom()) {
        remaining.unshift(...valueLines);
        addPage();
        continue;
      }
      const left = doc.page.margins.left;
      doc.rect(left, y, labelWidth, rowHeight).fillAndStroke("#f5f7fb", "#cfd8e6");
      doc.rect(left + labelWidth, y, valueWidth, rowHeight).fillAndStroke("#ffffff", "#cfd8e6");
      doc.fillColor("#475569");
      labelLines.forEach((line, index) => drawRuns(line, left + padding, y + padding + index * lineHeight, size));
      doc.fillColor("#1f2937");
      valueLines.forEach((line, index) => drawRuns(line, left + labelWidth + padding, y + padding + index * lineHeight, size));
      y += rowHeight;
      firstPart = false;
    }
    y += 8;
  };

  for (const block of blocks) {
    if (block.kind === "space") {
      y += 6;
      continue;
    }
    if (block.kind === "title") {
      drawParagraph(block.text, 20, "#315efb", 12);
      continue;
    }
    if (block.kind === "paragraph") {
      drawParagraph(block.text, 10, "#1f2937", 6);
      continue;
    }
    if (block.kind === "section") {
      if (y + 34 > bottom()) addPage();
      y += 8;
      doc.moveTo(doc.page.margins.left, y - 5).lineTo(doc.page.margins.left + contentWidth, y - 5).strokeColor("#dbe4f0").stroke();
      drawParagraph(block.text, 14, "#315efb", 8);
      continue;
    }
    if (y + 76 > bottom()) addPage();
    drawMergedTableRow(block.title);
    block.rows.forEach(([label, value]) => drawTableRow(label, value));
  }

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const contentBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 16;
    const watermarkText = `UID: ${watermark.uid}  ·  TIMESTAMP: ${watermark.timestamp}`;
    const watermarkCharacters = Array.from(watermarkText).map((character) => ({ character, face: faceForCharacter(character) }));
    let watermarkWidth = 0;
    for (const item of watermarkCharacters) {
      doc.font(item.face.name).fontSize(13);
      watermarkWidth += doc.widthOfString(item.character);
    }
    const centerX = doc.page.width / 2;
    const centerY = doc.page.height / 2;
    doc.markContent("Artifact", { type: "Layout" });
    doc.save();
    doc.fillColor("#64748b").fillOpacity(0.14);
    doc.rotate(-28, { origin: [centerX, centerY] });
    drawRuns(watermarkCharacters, centerX - watermarkWidth / 2, centerY, 13);
    doc.restore();
    doc.endMarkedContent();
    const disclaimer = "此文件不应当被用于任何形式的证明。";
    const pageNumber = `第 ${index + 1} / ${range.count} 页`;
    const disclaimerCharacters = Array.from(disclaimer).map((character) => ({ character, face: faceForCharacter(character) }));
    const pageNumberCharacters = Array.from(pageNumber).map((character) => ({ character, face: faceForCharacter(character) }));
    doc.fillColor("#718096");
    drawRuns(disclaimerCharacters, doc.page.margins.left, doc.page.height - 32, 8);
    let pageNumberWidth = 0;
    for (const item of pageNumberCharacters) {
      doc.font(item.face.name).fontSize(8);
      pageNumberWidth += doc.widthOfString(item.character);
    }
    drawRuns(pageNumberCharacters, doc.page.width - doc.page.margins.right - pageNumberWidth - 8, doc.page.height - 32, 8);
    doc.page.margins.bottom = contentBottomMargin;
  }
  doc.end();
  return completed;
}

async function createActivityPdf(
  user: PersonalExportUser,
  problemsets: PersonalExportProblemset[],
  submissions: PersonalExportSubmission[],
  exportedAt: Date,
  editPassword: string
): Promise<Buffer> {
  const blocks: PdfBlock[] = [
    { kind: "title", text: "保存站有题 - 个人记录导出" },
    { kind: "paragraph", text: `UID：${user.uid}` },
    { kind: "paragraph", text: `导出时间：${exportedAt.toISOString()}` },
    { kind: "space" },
    { kind: "section", text: "个人信息" },
    {
      kind: "table",
      title: "账号资料",
      rows: [
        ["账号内部编号", String(user.id)],
        ["UID", user.uid],
        ["用户名", user.name || "无"],
        ["注册邮箱", user.email || "无"],
        ["头像地址", user.avatarUrl || "无"],
        ["个人主页背景", user.profileCoverUrl || "无"],
        ["个人简介", user.bio || "无"],
        ["做题记录公开", user.recordsPublic ? "是" : "否"],
        ["注册时间", formatDate(user.createdAt)],
        ["导出时间", exportedAt.toISOString()]
      ]
    },
    { kind: "space" },
    { kind: "section", text: `上传的题目（${problemsets.length}）` }
  ];
  if (problemsets.length === 0) blocks.push({ kind: "paragraph", text: "暂无上传题目。" });
  problemsets.forEach((problemset) => {
    blocks.push({
      kind: "table",
      title: `题单 #${problemset.id} - ${problemset.title}`,
      rows: [
        ["题单描述", problemset.description || "无"],
        ["题单类型", problemset.problemsetType],
        ["作答时长", `${problemset.durationMinutes} 分钟`],
        ["题目数量", String(problemset.questionCount)],
        ["创建时间", formatDate(problemset.createdAt)]
      ]
    });
    problemset.questions.forEach((question) => {
      const optionText = question.options.length > 0
        ? question.options.map((option) => `${option.key}. ${option.text}`).join("　")
        : "无";
      const rows: Array<[string, string]> = [
        ["题目 ID", String(question.id)],
        ["题目类型", question.type],
        ["分值", String(question.score)],
        ["分组标题", question.groupTitle || "无"],
        ["共享材料", question.sharedMaterial || "无"],
        ["题干", question.stem || "无"],
        ["选项", optionText],
        ["输入提示", question.inputPlaceholder || "无"],
        ["标准答案", question.answer || "无"],
        ["答案解析", question.analysis || "无"]
      ];
      blocks.push({ kind: "table", title: `第 ${question.index} 题`, rows });
    });
  });
  blocks.push({ kind: "space" }, { kind: "section", text: `做题记录（${submissions.length}）` });
  if (submissions.length === 0) blocks.push({ kind: "paragraph", text: "暂无做题记录。" });
  submissions.forEach((submission) => {
    blocks.push({
      kind: "table",
      title: `做题记录 #${submission.id}`,
      rows: [
        ["题单 ID", String(submission.problemsetId)],
        ["题单标题", submission.problemsetTitle || "无"],
        ["作答模式", submission.mode || "无"],
        ["记录状态", submission.status || "无"],
        ["得分", `${submission.score}/${submission.maxScore}`],
        ["开始时间", formatDate(submission.startedAt) || "无"],
        ["提交时间", formatDate(submission.submittedAt) || "无"],
        ["创建时间", formatDate(submission.createdAt) || "无"]
      ]
    });
  });
  return createPdf(blocks, { uid: user.uid, timestamp: exportedAt.toISOString() }, editPassword);
}

export async function buildPersonalExportPdf(input: {
  user: PersonalExportUser;
  problemsets: PersonalExportProblemset[];
  submissions: PersonalExportSubmission[];
  exportedAt?: Date;
  editPassword?: string;
}): Promise<Buffer> {
  const exportedAt = input.exportedAt ?? new Date();
  const editPassword = input.editPassword ?? randomBytes(12).toString("base64url");
  if (editPassword.length !== 16) throw new Error("PDF edit password must contain exactly 16 characters");
  return createActivityPdf(input.user, input.problemsets, input.submissions, exportedAt, editPassword);
}
