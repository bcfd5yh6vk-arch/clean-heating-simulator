const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = __dirname;
const INPUT = path.join(ROOT, "midterm-draft.md");
const OUTPUT = path.join(ROOT, "midterm-guohang.pptx");

const FONT = "Times New Roman";
const TITLE_SIZE = 28;
const BODY_SIZE = 14;
const REF_SIZE = 12;
const LINE_SPACING = 1.15;

const expectedSections = [
  "Title",
  "Research Question & Hypothesis",
  "Background",
  "Literature Review",
  "Research Design / Method",
  "Research Plan & Challenges",
  "Expected Results — user study not yet run",
  "References",
  "Acknowledgements",
];

function parseSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  const sections = {};

  matches.forEach((match, index) => {
    const title = match[1].trim();
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    sections[title] = markdown.slice(start, end).trim();
  });

  for (const section of expectedSections) {
    if (!sections[section]) {
      throw new Error(`Missing or empty section: ${section}`);
    }
  }

  return sections;
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function linesFrom(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function addSlideTitle(slide, title) {
  slide.addText(title, {
    x: 0.55,
    y: 0.35,
    w: 12.2,
    h: 0.55,
    fontFace: FONT,
    fontSize: TITLE_SIZE,
    bold: true,
    color: "17212B",
    margin: 0,
    fit: "shrink",
  });
}

function addBody(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x ?? 0.7,
    y: opts.y ?? 1.1,
    w: opts.w ?? 12,
    h: opts.h ?? 5.8,
    fontFace: FONT,
    fontSize: opts.fontSize ?? BODY_SIZE,
    color: "17212B",
    breakLine: false,
    fit: "shrink",
    valign: "top",
    margin: 0.05,
    lineSpacingMultiple: LINE_SPACING,
  });
}

function bulletText(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

function firstSentence(text) {
  const match = text.match(/^(.+?[.!?])\s/);
  return match ? match[1] : text;
}

function makeDeck(sections) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Guo Hang";
  pptx.subject = "Baoding Coal-to-X Village Transition Simulation Sandbox";
  pptx.title = "Midterm Presentation";
  pptx.company = "CTB";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: "en-US",
  };

  // Slide 1: Title
  {
    const slide = pptx.addSlide();
    slide.background = { color: "F6F8FB" };
    const titleLines = linesFrom(sections.Title);
    slide.addText(titleLines[0], {
      x: 1.2,
      y: 2.25,
      w: 10.9,
      h: 0.8,
      fontFace: FONT,
      fontSize: TITLE_SIZE,
      bold: true,
      align: "center",
      color: "17212B",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(`${titleLines[1]}\n${titleLines[2]}`, {
      x: 2.0,
      y: 3.35,
      w: 9.3,
      h: 0.85,
      fontFace: FONT,
      fontSize: BODY_SIZE,
      align: "center",
      color: "17212B",
      margin: 0,
      breakLine: false,
      lineSpacingMultiple: LINE_SPACING,
    });
  }

  // Slide 2: Research Question & Hypothesis
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Research Question & Hypothesis");
    addBody(slide, sections["Research Question & Hypothesis"], { y: 1.25, h: 5.6 });
  }

  // Slide 3: Background
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Background");
    const items = splitParagraphs(sections.Background).map(firstSentence);
    addBody(slide, bulletText(items), { y: 1.15, h: 5.8 });
  }

  // Slide 4: Literature Review
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Literature Review");
    const items = [
      "Zhao et al. (2024): clean heating costs are highly sensitive to subsidies.",
      "Yu and Xin (2021): heating burden can become a form of energy poverty.",
      "Li, Song, and Zhu (2021): gas costs can change household heating choices.",
      "He et al. (2021): some Baoding clean-heating households returned to coal.",
      "Zhang et al. (2024): costs and health benefits are uneven across regions.",
      "My gap: a village-facing sandbox based on household data.",
    ];
    addBody(slide, bulletText(items), { y: 1.1, h: 5.9 });
  }

  // Slide 5: Research Design / Method
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Research Design / Method");
    const items = [
      "The artifact is a clean heating transition simulation sandbox.",
      "Users enter income, house size, heating method, and winter heating cost.",
      "The current MVP shows cost, surplus, compliance, emissions, and energy burden.",
      "The next version will use many households from one village.",
      "Feedback will come from short before-and-after questions and user comments.",
    ];
    addBody(slide, bulletText(items), { y: 1.1, h: 5.9 });
  }

  // Slide 6: Research Plan & Challenges
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Research Plan & Challenges");
    const items = [
      "June 20: present the research question, hypothesis, MVP, and evidence.",
      "Late June: improve simulator logic and pathway recommendations.",
      "Early July: build a simple village data table.",
      "After that: run a small user test and collect feedback.",
      "Main challenges: data privacy, model accuracy, and clear communication.",
    ];
    addBody(slide, bulletText(items), { y: 1.1, h: 5.9 });
  }

  // Slide 7: Expected Results with prototype placeholder
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Expected Results — user study not yet run");
    const items = [
      "I expect users to see that there is no single best pathway for every village.",
      "I expect affordability to become more visible.",
      "I expect users to care more about household-data-based village decisions.",
      "I will not report user numbers or final conclusions before the study is run.",
    ];
    addBody(slide, bulletText(items), { x: 0.65, y: 1.1, w: 6.0, h: 5.9 });
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.05,
      y: 1.25,
      w: 5.55,
      h: 4.95,
      fill: { color: "F3F4F6", transparency: 12 },
      line: { color: "8A96A3", width: 1.5, dash: "dash" },
    });
    slide.addText("Insert prototype screenshot here", {
      x: 7.45,
      y: 3.35,
      w: 4.75,
      h: 0.45,
      fontFace: FONT,
      fontSize: BODY_SIZE,
      color: "5A6B7B",
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  }

  // Slide 8: References
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "References");
    const refs = linesFrom(sections.References);
    const leftRefs = refs.slice(0, Math.ceil(refs.length / 2)).join("\n");
    const rightRefs = refs.slice(Math.ceil(refs.length / 2)).join("\n");
    addBody(slide, leftRefs, { x: 0.55, y: 1.05, w: 6.05, h: 5.95, fontSize: REF_SIZE });
    addBody(slide, rightRefs, { x: 6.85, y: 1.05, w: 5.95, h: 5.95, fontSize: REF_SIZE });
  }

  // Slide 9: Acknowledgements
  {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Acknowledgements");
    addBody(slide, sections.Acknowledgements, { y: 1.35, h: 4.0 });
  }

  return pptx;
}

async function main() {
  const markdown = fs.readFileSync(INPUT, "utf8");
  const sections = parseSections(markdown);
  const pptx = makeDeck(sections);
  await pptx.writeFile({ fileName: OUTPUT });
  console.log(`Generated ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
