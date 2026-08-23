import { createWorker, PSM } from "tesseract.js";
import type { EquipmentAverage } from "./types";

export type LocalAnalysis = {
  mapType: string;
  operation: string;
  sectorHint: string;
  period: string;
  averages: EquipmentAverage[];
  workedArea: string;
  overlapArea: string;
  rawText: string;
};

export async function analyzeSolinftecPrints(
  mainImage: string,
  summaryImage: string,
  progress: (value: number, message: string) => void,
): Promise<LocalAnalysis> {
  const worker = await createWorker("por", 1, {
    logger: (event) => {
      if (event.status === "recognizing text")
        progress(Math.round(event.progress * 100), "Lendo informações...");
    },
  });
  try {
    progress(0, "Preparando print principal...");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });
    const main = mainImage
      ? (await worker.recognize(await prepareImage(mainImage, 1.35))).data.text
      : "";
    progress(0, "Preparando resumo de equipamentos...");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const summary = summaryImage
      ? (await worker.recognize(await prepareImage(summaryImage, 2))).data.text
      : "";
    let numericSummary = "";
    if (summaryImage) {
      progress(0, "Lendo frotas e médias...");
      const { width, height } = await imageDimensions(summaryImage);
      const compactSummary = width / height > 0.5;
      const graphTop = compactSummary ? 0.16 : 0.5;
      const graphBottom = compactSummary ? 0.64 : 0.86;
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "0123456789.,",
        preserve_interword_spaces: "1",
      });
      const fleetNumbers = (
        await worker.recognize(
          await prepareImage(
            summaryImage,
            4,
            graphTop,
            graphBottom,
            0,
            0.3,
          ),
        )
      ).data.text;
      const averageNumbers = (
        await worker.recognize(
          await prepareImage(
            summaryImage,
            4,
            graphTop,
            graphBottom,
            0.52,
            0.96,
          ),
        )
      ).data.text;
      numericSummary = `--- FROTAS ---\n${fleetNumbers}\n--- MEDIAS ---\n${averageNumbers}`;
    }
    return parseSolinftecText(main, summary, numericSummary);
  } finally {
    await worker.terminate();
  }
}

export function parseSolinftecText(
  mainText: string,
  summaryText: string,
  numericSummaryText = "",
): LocalAnalysis {
  const rawText = `${mainText}\n${summaryText}${
    numericSummaryText
      ? `\n\n--- LEITURA NUMÉRICA DO GRÁFICO ---\n${numericSummaryText}`
      : ""
  }`.trim();
  const semanticText = `${mainText}\n${summaryText}`;
  const plain = normalize(semanticText),
    main = normalize(mainText),
    summary = normalize(summaryText);
  const mapType =
    /area\s+trabalhada/.test(plain) && !/velocidade/.test(plain)
      ? "Área Trabalhada"
      : /vazao/.test(plain)
        ? "Vazão"
        : /velocidade|km\s*\/\s*h/.test(plain)
          ? "Velocidade"
          : "";
  const operation = classifyOperation(findOperation(semanticText), semanticText);
  const period =
    semanticText.match(
      /\b\d{2}\/\d{2}\/\d{4}\s*[-–a]\s*\d{2}\/\d{2}\/\d{4}\b/i,
    )?.[0] ?? "";
  const sectorHint = findSectorHint(semanticText);
  const equipmentBlock = summary.split(/operacao/i)[0];
  const averages = numericSummaryText.includes("--- FROTAS ---")
    ? extractSeparatedAverages(numericSummaryText, mapType)
    : extractEquipmentAverages(numericSummaryText || equipmentBlock, mapType);
  const workedArea = findLabeledNumber(main, "area trabalhada");
  const overlapArea = findLabeledNumber(main, "area de sobreposicao");
  return {
    mapType,
    operation,
    sectorHint,
    period,
    averages,
    workedArea,
    overlapArea,
    rawText,
  };
}

function findOperation(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidates = lines.filter((line) =>
    /\b\d{4,8}\s*[-–]\s*[A-ZÀ-Ú]/i.test(line),
  );
  const selected = candidates.at(-1) ?? "";
  return selected
    .replace(/^.*?\b\d{4,8}\s*[-–]\s*/i, "")
    .replace(/[^A-ZÀ-Ú0-9 /-]+$/i, "")
    .trim();
}

function classifyOperation(activity: string, completeText = activity) {
  const normalized = normalize(completeText);
  if (/plantio\s+de\s+baixa\s+densidade/.test(normalized))
    return "Plantio de Cana";
  return activity;
}

function findSectorHint(text: string) {
  const explicit = text.match(
    /\bsetor\s*[-:]?\s*([A-Z]{1,8}[.-]?\d{0,4})\b/i,
  )?.[1];
  if (explicit) return explicit.toUpperCase();
  const fieldCode = text.match(/\b([A-Z]{1,5}\d*)[_-]TA\s*\d+\b/i)?.[1];
  return fieldCode?.toUpperCase() ?? "";
}

function extractEquipmentAverages(
  text: string,
  mapType: string,
): EquipmentAverage[] {
  const clean = text
    .replace(/\b[I|l](?=\d{3,5}\b)/g, "1")
    .replace(/(\d)\s*[,.]\s*(\d)/g, "$1.$2");
  const equipments = [...clean.matchAll(/\b(\d{3,6})\b/g)]
    .map((match) => match[1])
    .filter((value) => !/^20\d{2}$/.test(value));
  const decimals = [...clean.matchAll(/\b(\d{1,3}\.\d{1,3})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 0 && value < 1000);
  const likelyAverages = decimals
    .filter((value) => value > 0)
    .slice(-equipments.length || undefined);
  const unit = mapType === "Vazão" ? "L/ha" : "km/h";
  return [...new Set(equipments)]
    .slice(0, likelyAverages.length)
    .map((equipment, index) => ({
      equipment,
      average: likelyAverages[index].toFixed(2).replace(".", ","),
      unit,
    }));
}

function extractSeparatedAverages(text: string, mapType: string) {
  const fleetText =
    text.split("--- FROTAS ---")[1]?.split("--- MEDIAS ---")[0] ?? "";
  const averageText = text.split("--- MEDIAS ---")[1] ?? "";
  const fleets = [...fleetText.matchAll(/\b\d{3,6}\b/g)].map(
    (match) => match[0],
  );
  const averages = averageText
    .split(/\s+/)
    .map(parseChartAverage)
    .filter((value): value is number => value !== null && value > 0);
  const unit = normalize(mapType) === "vazao" ? "L/ha" : "km/h";
  return [...new Set(fleets)]
    .slice(0, averages.length)
    .map((equipment, index) => ({
      equipment,
      average: String(averages[index]).replace(".", ","),
      unit,
    }));
}

function parseChartAverage(token: string) {
  const clean = token.replace(/[^\d,.]/g, "").replace(",", ".");
  if (!clean || /^\d$/.test(clean)) return null;
  if (clean.includes(".")) {
    const value = Number(clean);
    return Number.isFinite(value) && value < 1000 ? value : null;
  }
  if (!/^\d{2,4}$/.test(clean)) return null;
  const decimals = clean.length === 2 ? 1 : 2;
  return Number(`${clean.slice(0, -decimals)}.${clean.slice(-decimals)}`);
}

function findLabeledNumber(text: string, label: string) {
  const index = text.indexOf(label);
  if (index < 0) return "";
  return (
    text
      .slice(index + label.length, index + label.length + 80)
      .match(/\b\d{1,5}[,.]\d{1,3}\b/)?.[0]
      ?.replace(".", ",") ?? ""
  );
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function imageDimensions(source: string) {
  const image = await loadImage(source);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
}

async function prepareImage(
  source: string,
  scale: number,
  cropTop = 0,
  cropBottom = 1,
  cropLeft = 0,
  cropRight = 1,
) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const sourceY = Math.round(image.naturalHeight * cropTop);
  const sourceX = Math.round(image.naturalWidth * cropLeft);
  const sourceBottom = Math.round(image.naturalHeight * cropBottom);
  const sourceRight = Math.round(image.naturalWidth * cropRight);
  const sourceHeight = sourceBottom - sourceY;
  const sourceWidth = sourceRight - sourceX;
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = `grayscale(1) contrast(${cropTop ? 2 : 1.5})`;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/png");
}
