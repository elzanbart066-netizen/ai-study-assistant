import { createRequire } from "node:module";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import pptxModule from "pptxgenjs";
import type { DocSection, FileFormat, SourceLink } from "../../src/models/index.js";

export interface DocumentInput {
  title: string;
  sections: DocSection[];
  sources: SourceLink[];
  sourcesHeading: string;
}

// DejaVu Sans covers Kazakh and Russian Cyrillic. It ships as an npm package
// under a free license (see node_modules/dejavu-fonts-ttf/LICENSE).
const require = createRequire(import.meta.url);
const fontDir = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const FONT_REGULAR = path.join(fontDir, "DejaVuSans.ttf");
const FONT_BOLD = path.join(fontDir, "DejaVuSans-Bold.ttf");

// pptxgenjs ships CommonJS typings that NodeNext reads as a namespace; the
// runtime default export is the constructor.
const PptxGenJS = ((pptxModule as unknown as { default?: unknown }).default ?? pptxModule) as typeof pptxModule.default;

function sourceLines(input: DocumentInput) {
  return input.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`);
}

export function buildTxt(input: DocumentInput): Buffer {
  const lines = [input.title, "=".repeat(Math.min(input.title.length, 60)), ""];
  for (const section of input.sections) {
    lines.push(section.heading, "-".repeat(Math.min(section.heading.length, 60)), ...section.paragraphs, "");
  }
  if (input.sources.length > 0) {
    lines.push(input.sourcesHeading, ...sourceLines(input));
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

export async function buildDocx(input: DocumentInput): Promise<Buffer> {
  const children: Paragraph[] = [new Paragraph({ text: input.title, heading: HeadingLevel.TITLE })];
  for (const section of input.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    for (const p of section.paragraphs) {
      children.push(new Paragraph({ children: [new TextRun(p)], spacing: { after: 120 } }));
    }
  }
  if (input.sources.length > 0) {
    children.push(new Paragraph({ text: input.sourcesHeading, heading: HeadingLevel.HEADING_1 }));
    for (const line of sourceLines(input)) {
      children.push(new Paragraph({ text: line }));
    }
  }
  const doc = new Document({
    creator: "AI Study Assistant",
    title: input.title,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

export function buildPdf(input: DocumentInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: input.title, Creator: "AI Study Assistant" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("regular", FONT_REGULAR);
    doc.registerFont("bold", FONT_BOLD);
    doc.font("bold").fontSize(20).fillColor("#33383E").text(input.title);
    doc.moveDown();
    for (const section of input.sections) {
      doc.font("bold").fontSize(14).text(section.heading);
      doc.moveDown(0.3);
      for (const p of section.paragraphs) {
        doc.font("regular").fontSize(11).text(p, { align: "justify" });
        doc.moveDown(0.5);
      }
      doc.moveDown(0.5);
    }
    if (input.sources.length > 0) {
      doc.font("bold").fontSize(14).text(input.sourcesHeading);
      doc.moveDown(0.3);
      for (const s of input.sources) {
        doc.font("regular").fontSize(10).fillColor("#33383E").text(`${s.title} — `, { continued: true });
        doc.fillColor("#2F5D8A").text(s.url, { link: s.url, underline: true });
      }
    }
    doc.end();
  });
}

export async function buildPptx(input: DocumentInput): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = input.title;
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "ECEFF1" };
  titleSlide.addText(input.title, { x: 0.8, y: 2.6, w: 11.7, h: 1.5, fontSize: 36, bold: true, color: "33383E", fontFace: "Arial" });
  for (const section of input.sections) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(section.heading, { x: 0.6, y: 0.4, w: 12, h: 0.9, fontSize: 26, bold: true, color: "33383E", fontFace: "Arial" });
    slide.addText(
      section.paragraphs.map((p) => ({ text: p, options: { bullet: true, breakLine: true } })),
      { x: 0.6, y: 1.4, w: 12, h: 5.6, fontSize: 16, color: "33383E", valign: "top", fontFace: "Arial", fit: "shrink" },
    );
  }
  if (input.sources.length > 0) {
    const slide = pptx.addSlide();
    slide.addText(input.sourcesHeading, { x: 0.6, y: 0.4, w: 12, h: 0.9, fontSize: 26, bold: true, color: "33383E" });
    slide.addText(
      input.sources.map((s) => ({ text: `${s.title} — ${s.url}`, options: { hyperlink: { url: s.url }, breakLine: true } })),
      { x: 0.6, y: 1.4, w: 12, h: 5.6, fontSize: 14, color: "2F5D8A", valign: "top" },
    );
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

export const MIME: Record<FileFormat | "png" | "jpg" | "webp", string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export function buildDocument(format: FileFormat, input: DocumentInput): Promise<Buffer> {
  switch (format) {
    case "txt":
      return Promise.resolve(buildTxt(input));
    case "docx":
      return buildDocx(input);
    case "pdf":
      return buildPdf(input);
    case "pptx":
      return buildPptx(input);
  }
}
