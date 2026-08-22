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
    return parseSolinftecText(main, summary);
  } finally {
    await worker.terminate();
  }
}

export function parseSolinftecText(
  mainText: string,
  summaryText: string,
): LocalAnalysis {
  const rawText = `${mainText}\n${summaryText}`.trim();
  const plain = normalize(rawText),
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
  const operation = findOperation(rawText);
  const period =
    rawText.match(
      /\b\d{2}\/\d{2}\/\d{4}\s*[-–a]\s*\d{2}\/\d{2}\/\d{4}\b/i,
    )?.[0] ?? "";
  const sectorHint = findSectorHint(rawText);
  const equipmentBlock = summary.split(/operacao/i)[0];
  const averages = extractEquipmentAverages(equipmentBlock || summary, mapType);
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

function findSectorHint(text: string) {
  const explicit = text.match(
    /\bsetor\s*[-:]?\s*([A-Z]{1,8}[.-]?\d{0,4})\b/i,
  )?.[1];
  if (explicit) return explicit.toUpperCase();
  const fieldCode = text.match(/\b([A-Z]{2,5}\d*)[_-]TA\s*\d+\b/i)?.[1];
  return fieldCode?.toUpperCase() ?? "";
}

function extractEquipmentAverages(
  text: string,
  mapType: string,
): EquipmentAverage[] {
  const clean = text.replace(/(\d)\s*[,.]\s*(\d)/g, "$1.$2");
  const equipments = [...clean.matchAll(/(?:^|\s)(\d{3,6})(?=\s|$)/gm)]
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

async function prepareImage(source: string, scale: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "grayscale(1) contrast(1.5)";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
