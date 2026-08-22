import { useMemo, useState } from "react";
import { uid } from "./data";
import "./ManualMap.css";
import "./QuickFlow.css";
import "./MapQueue.css";
import type {
  AppData,
  EquipmentAverage,
  ExtractedPrintData,
  PrintLegendItem,
} from "./types";

const emptyExtracted = (): ExtractedPrintData => ({
  rawText: "",
  detectedMapType: "",
  detectedSector: "",
  detectedOperation: "",
  detectedDateRange: "",
  equipmentAverages: [],
  warnings: [],
});
const blank = (): Partial<PrintLegendItem> => ({
  shift: "C",
  categoryName: "",
  sectorName: "",
  operationName: "",
  mapTypeName: "Velocidade",
  scheduledTime: "",
  mainImage: "",
  summaryImage: "",
  extractedData: emptyExtracted(),
  generatedLegend: "",
  finalLegend: "",
});

export default function PrintAnalyzer({
  data,
  setData,
  flash,
}: {
  data: AppData;
  setData: (data: AppData) => void;
  flash: (message: string) => void;
}) {
  const [item, setItem] = useState<Partial<PrintLegendItem>>(blank());
  const [averagePad, setAveragePad] = useState<number | null>(null);
  const averages = item.extractedData?.equipmentAverages ?? [];
  const legend = useMemo(() => makeLegend(item), [item]);
  const recent = useMemo(
    () =>
      [...data.printItems].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [data.printItems],
  );
  const setField = (
    key:
      "categoryName" | "sectorName" | "operationName" | "mapTypeName" | "shift",
    value: string,
  ) => setItem((current) => ({ ...current, [key]: value, finalLegend: "" }));
  const addAverage = () =>
    setItem((current) => ({
      ...current,
      extractedData: {
        ...(current.extractedData ?? emptyExtracted()),
        equipmentAverages: [
          ...(current.extractedData?.equipmentAverages ?? []),
          {
            equipment: "",
            average: "",
            unit: current.mapTypeName === "Vazão" ? "L/ha" : "km/h",
          },
        ],
      },
    }));
  const updateAverage = (
    index: number,
    key: keyof EquipmentAverage,
    value: string,
  ) =>
    setItem((current) => ({
      ...current,
      extractedData: {
        ...(current.extractedData ?? emptyExtracted()),
        equipmentAverages: (current.extractedData?.equipmentAverages ?? []).map(
          (entry, position) =>
            position === index ? { ...entry, [key]: value } : entry,
        ),
      },
      finalLegend: "",
    }));
  const removeAverage = (index: number) =>
    setItem((current) => ({
      ...current,
      extractedData: {
        ...(current.extractedData ?? emptyExtracted()),
        equipmentAverages: (
          current.extractedData?.equipmentAverages ?? []
        ).filter((_, position) => position !== index),
      },
      finalLegend: "",
    }));
  const savePreset = () => {
    if (!item.sectorName || !item.operationName || !item.mapTypeName)
      return flash("Preencha setor, operação e tipo antes de salvar o atalho");
    const preset = {
      id: uid(),
      name: `${item.categoryName || "Mapa"} • ${item.sectorName} • ${item.mapTypeName}`,
      category: item.categoryName || "",
      sector: item.sectorName,
      operation: item.operationName,
      mapType: item.mapTypeName,
      unit: item.mapTypeName === "Vazão" ? "L/ha" : "km/h",
    };
    setData({ ...data, presets: [...data.presets, preset] });
    flash("Atalho salvo ✓");
  };
  const applyPreset = (id: string) => {
    const preset = data.presets.find((entry) => entry.id === id);
    if (!preset) return;
    setItem((current) => ({
      ...current,
      categoryName: preset.category,
      sectorName: preset.sector,
      operationName: preset.operation,
      mapTypeName: preset.mapType,
      finalLegend: "",
    }));
  };
  const padPress = (key: string) => {
    if (averagePad === null) return;
    const current = averages[averagePad]?.average ?? "";
    if (key === "⌫") updateAverage(averagePad, "average", current.slice(0, -1));
    else if (key === "C") updateAverage(averagePad, "average", "");
    else if (key.startsWith("+") || key.startsWith("-")) {
      const next = Math.max(
        0,
        (Number(current.replace(",", ".")) || 0) +
          Number(key.replace(",", ".")),
      );
      updateAverage(averagePad, "average", next.toFixed(2).replace(".", ","));
    } else if (!(key === "," && current.includes(",")))
      updateAverage(averagePad, "average", current + key);
  };
  const loadImage = async (file: File) => {
    if (!file.type.startsWith("image/"))
      return flash("Escolha uma imagem válida");
    const image = await fileUrl(file);
    setItem((current) => ({ ...current, mainImage: image }));
    flash("Imagem anexada ✓");
  };
  const save = () => {
    if (!item.sectorName || !item.operationName || !item.mapTypeName)
      return flash("Preencha setor, operação e tipo do mapa");
    const now = new Date().toISOString();
    const saved = {
      ...item,
      id: item.id ?? uid(),
      categoryId: "",
      sectorId: "",
      operationId: "",
      mapTypeId: "",
      extractedData: item.extractedData ?? emptyExtracted(),
      generatedLegend: legend,
      finalLegend: item.finalLegend || legend,
      createdAt: item.createdAt ?? now,
      updatedAt: now,
    } as PrintLegendItem;
    setData({
      ...data,
      printItems: [
        saved,
        ...data.printItems.filter((existing) => existing.id !== saved.id),
      ],
    });
    setItem(saved);
    flash("Mapa guardado ✓");
  };
  const copyLegend = async () => {
    await navigator.clipboard.writeText(item.finalLegend || legend);
    flash("Legenda copiada ✓");
  };
  const copyImage = async () => {
    if (!item.mainImage) return flash("Anexe a foto primeiro");
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": await imageToPng(item.mainImage) }),
      ]);
      flash("Imagem copiada ✓");
    } catch {
      flash("O navegador bloqueou a imagem");
    }
  };
  const copyPackage = async () => {
    if (!item.mainImage) return flash("Anexe a foto primeiro");
    try {
      const text = item.finalLegend || legend;
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": await imageToPng(item.mainImage),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      flash("Pacote copiado — cole no WhatsApp ✓");
    } catch {
      await copyImage();
      flash("Imagem copiada. Depois use Copiar legenda.");
    }
  };
  const toggleSent = (saved: PrintLegendItem) => {
    const updated = {
      ...saved,
      sentAt: saved.sentAt ? "" : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setData({
      ...data,
      printItems: data.printItems.map((entry) =>
        entry.id === saved.id ? updated : entry,
      ),
    });
    if (item.id === saved.id) setItem(updated);
    flash(updated.sentAt ? "Marcado como enviado ✓" : "Envio reaberto");
  };
  const grouped = useMemo(
    () =>
      recent.reduce<Record<string, PrintLegendItem[]>>((groups, saved) => {
        const key = saved.operationName || "Sem operação";
        (groups[key] ??= []).push(saved);
        return groups;
      }, {}),
    [recent],
  );
  return (
    <div
      className="manualModule"
      onPaste={(event) => {
        const file = [...event.clipboardData.files].find((entry) =>
          entry.type.startsWith("image/"),
        );
        if (file) loadImage(file);
      }}
    >
      <div className="manualHeader">
        <div>
          <span className="eyebrow">PREPARAÇÃO MANUAL</span>
          <h2>Novo mapa para envio</h2>
          <p>
            Anexe a foto, preencha os dados e guarde. Sem análise automática.
          </p>
        </div>
        <button onClick={() => setItem(blank())}>
          ＋ Limpar e começar outro
        </button>
      </div>
      <div className="manualGrid">
        <section className="manualForm">
          <div className="presetBar">
            <div>
              <b>Atalhos de mapas</b>
              <small>
                Um clique preenche categoria, setor, operação e tipo.
              </small>
            </div>
            <button onClick={savePreset}>☆ Salvar dados atuais</button>
          </div>
          {data.presets.length > 0 && (
            <div className="presetChips">
              {data.presets.map((preset) => (
                <button key={preset.id} onClick={() => applyPreset(preset.id)}>
                  {preset.name}
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      setData({
                        ...data,
                        presets: data.presets.filter(
                          (entry) => entry.id !== preset.id,
                        ),
                      });
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
          <label className="mainUpload">
            {item.mainImage ? (
              <img src={item.mainImage} />
            ) : (
              <>
                <span>＋</span>
                <b>Anexar foto do mapa</b>
                <small>PNG, JPG ou WEBP — também aceita Ctrl + V</small>
              </>
            )}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadImage(file);
              }}
            />
          </label>
          <div className="manualFields">
            <label>
              Turno
              <input
                value={item.shift ?? ""}
                onChange={(e) => setField("shift", e.target.value)}
                placeholder="C"
              />
            </label>
            <label>
              Grupo / categoria (opcional)
              <input
                value={item.categoryName ?? ""}
                onChange={(e) => setField("categoryName", e.target.value)}
                placeholder="Ex.: CPD"
              />
            </label>
            <label>
              Horário previsto
              <input
                type="time"
                value={item.scheduledTime ?? ""}
                onChange={(e) =>
                  setItem({ ...item, scheduledTime: e.target.value })
                }
              />
            </label>
            <label>
              Setor
              <input
                value={item.sectorName ?? ""}
                onChange={(e) => setField("sectorName", e.target.value)}
                placeholder="Ex.: CUP.3"
              />
            </label>
            <label>
              Operação
              <input
                value={item.operationName ?? ""}
                onChange={(e) => setField("operationName", e.target.value)}
                placeholder="Ex.: Pós Emergente"
              />
            </label>
            <label className="wideField">
              Tipo do mapa
              <select
                value={item.mapTypeName ?? ""}
                onChange={(e) => setField("mapTypeName", e.target.value)}
              >
                <option>Velocidade</option>
                <option>Vazão</option>
                <option>Área Trabalhada</option>
                <option>Outro</option>
              </select>
            </label>
          </div>
          {item.mapTypeName !== "Área Trabalhada" && (
            <div className="fleetSection">
              <div className="fleetTitle">
                <div>
                  <h3>Frotas e médias</h3>
                  <p>Adicione uma linha para cada equipamento.</p>
                </div>
                <button onClick={addAverage}>＋ Adicionar frota</button>
              </div>
              {averages.length === 0 && (
                <div className="noFleet">Nenhuma frota adicionada.</div>
              )}
              <div className="fleetRows">
                {averages.map((entry, index) => (
                  <div key={index}>
                    <input
                      value={entry.equipment}
                      onChange={(e) =>
                        updateAverage(index, "equipment", e.target.value)
                      }
                      placeholder="Frota, ex.: 1528"
                    />
                    <button
                      className="averagePicker"
                      value={entry.average}
                      onClick={() => setAveragePad(index)}
                    >
                      {entry.average || "Escolher média"}
                    </button>
                    <input
                      value={entry.unit}
                      onChange={(e) =>
                        updateAverage(index, "unit", e.target.value)
                      }
                      placeholder="km/h"
                    />
                    <button onClick={() => removeAverage(index)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="manualResult">
          <span className="eyebrow">PRÉVIA PARA O WHATSAPP</span>
          <div className="whatsappPreview">
            {item.mainImage ? (
              <img src={item.mainImage} />
            ) : (
              <div className="previewPlaceholder">A foto aparecerá aqui</div>
            )}
            <textarea
              value={item.finalLegend || legend}
              onChange={(e) =>
                setItem({ ...item, finalLegend: e.target.value })
              }
              rows={9}
            />
          </div>
          <button className="packageButton" onClick={copyPackage}>
            ▣ Copiar imagem + legenda
          </button>
          <div className="separateButtons">
            <button onClick={copyImage}>Copiar imagem</button>
            <button onClick={copyLegend}>Copiar legenda</button>
          </div>
          <button className="saveButton" onClick={save}>
            Guardar este mapa
          </button>
          <small>
            Se o WhatsApp colar apenas a imagem, use os dois botões separados.
          </small>
        </section>
      </div>
      {averagePad !== null && (
        <div className="padOverlay" onClick={() => setAveragePad(null)}>
          <div
            className="numberPad"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="eyebrow">
              MÉDIA DA FROTA {averages[averagePad]?.equipment || ""}
            </span>
            <strong>
              {averages[averagePad]?.average || "0,00"}{" "}
              <small>{averages[averagePad]?.unit}</small>
            </strong>
            <div className="adjustKeys">
              {["-0,10", "-0,01", "+0,01", "+0,10"].map((key) => (
                <button key={key} onClick={() => padPress(key)}>
                  {key}
                </button>
              ))}
            </div>
            <div className="digitKeys">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map(
                (key) => (
                  <button key={key} onClick={() => padPress(key)}>
                    {key}
                  </button>
                ),
              )}
            </div>
            <div className="padBottom">
              <button onClick={() => padPress("C")}>Limpar</button>
              <button className="primary" onClick={() => setAveragePad(null)}>
                Confirmar ✓
              </button>
            </div>
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <section className="savedMaps">
          <div>
            <h3>Mapas guardados</h3>
            <button
              onClick={() => {
                setData({ ...data, printItems: [] });
                setItem(blank());
                flash("Mapas guardados removidos");
              }}
            >
              Limpar todos
            </button>
          </div>
          <div className="operationGroups">
            {Object.entries(grouped).map(([operation, maps]) => (
              <section key={operation}>
                <header>
                  <h4>{operation}</h4>
                  <span>
                    {maps.filter((map) => map.sentAt).length}/{maps.length}{" "}
                    enviados
                  </span>
                </header>
                <div>
                  {maps.map((saved) => (
                    <article
                      className={saved.sentAt ? "sentMap" : ""}
                      key={saved.id}
                    >
                      <button
                        className="savedMain"
                        onClick={() => setItem(saved)}
                      >
                        {saved.mainImage ? (
                          <img src={saved.mainImage} />
                        ) : (
                          <div className="noImage">SEM IMAGEM</div>
                        )}
                        <span>
                          <b>
                            {saved.mapTypeName} • Setor {saved.sectorName}
                          </b>
                          <small>
                            {saved.scheduledTime || "Sem horário"} • Turno{" "}
                            {saved.shift}
                          </small>
                        </span>
                        <i>Editar →</i>
                      </button>
                      <button
                        className={
                          saved.sentAt ? "sentButton sent" : "sentButton"
                        }
                        onClick={() => toggleSent(saved)}
                      >
                        {saved.sentAt
                          ? `✓ Enviado ${new Date(saved.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                          : "Marcar já enviado"}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function makeLegend(item: Partial<PrintLegendItem>) {
  const type = item.mapTypeName || "Mapa";
  const title =
    type === "Velocidade" || type === "Vazão"
      ? `Acompanhamento de ${type}`
      : type;
  const lines = [
    `Segue ${title} - Turno ${item.shift || ""}`,
    `${item.operationName || ""} – Setor - ${item.sectorName || ""}`,
  ];
  const averageLines = (item.extractedData?.equipmentAverages ?? [])
    .filter((entry) => entry.equipment || entry.average)
    .map(
      (entry) => `${entry.equipment} - ${entry.average} ${entry.unit} Média`,
    );
  const header = lines.filter(Boolean).join("\n");
  return type !== "Área Trabalhada" && averageLines.length
    ? `${header}\n\n${averageLines.join("\n")}`
    : header;
}
const fileUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const imageToPng = (source: string) =>
  new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject()), "image/png");
    };
    image.onerror = reject;
    image.src = source;
  });
