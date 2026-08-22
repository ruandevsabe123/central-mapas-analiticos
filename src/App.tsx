import { useEffect, useState } from "react";
import "./Overview.css";
import { createDemoData, uid } from "./data";
import { loadData, saveData } from "./storage";
import type {
  AppData,
  EquipmentAverage,
  ExtractedPrintData,
  PrintLegendItem,
} from "./types";

type Screen = "overview" | "form";
const emptyExtracted = (): ExtractedPrintData => ({
  rawText: "",
  detectedMapType: "",
  detectedSector: "",
  detectedOperation: "",
  detectedDateRange: "",
  equipmentAverages: [],
  warnings: [],
});
const newMap = (): Partial<PrintLegendItem> => ({
  id: "",
  shift: "C",
  sectorName: "",
  operationName: "",
  mapTypeName: "Velocidade",
  scheduledTime: "",
  mainImage: "",
  extractedData: emptyExtracted(),
  finalLegend: "",
});

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [screen, setScreen] = useState<Screen>("overview");
  const [draft, setDraft] = useState<Partial<PrintLegendItem>>(newMap());
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    loadData().then((value) => setData(value ?? createDemoData()));
  }, []);
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => saveData(data), 200);
    return () => clearTimeout(timer);
  }, [data]);
  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  };
  if (!data) return <div className="boot">Abrindo Central de Mapas...</div>;
  const openNew = () => {
    setDraft(newMap());
    setScreen("form");
  };
  const openEdit = (map: PrintLegendItem) => {
    setDraft(map);
    setScreen("form");
  };
  const finish = () => {
    if (
      !draft.sectorName?.trim() ||
      !draft.operationName?.trim() ||
      !draft.mapTypeName
    )
      return flash("Preencha setor, operação e tipo do mapa");
    const now = new Date().toISOString();
    const map = {
      ...draft,
      id: draft.id || uid(),
      categoryId: "",
      sectorId: "",
      operationId: "",
      mapTypeId: "",
      summaryImage: "",
      extractedData: draft.extractedData ?? emptyExtracted(),
      generatedLegend: buildLegend(draft),
      finalLegend: draft.finalLegend || buildLegend(draft),
      createdAt: draft.createdAt || now,
      updatedAt: now,
    } as PrintLegendItem;
    setData({
      ...data,
      printItems: [
        map,
        ...data.printItems.filter((item) => item.id !== map.id),
      ],
    });
    setScreen("overview");
    flash("Mapa finalizado e enviado para a Visão Geral ✓");
  };
  const updateMap = (map: PrintLegendItem) =>
    setData({
      ...data,
      printItems: data.printItems.map((item) =>
        item.id === map.id ? map : item,
      ),
    });
  const deleteMapFromOverview = (map: PrintLegendItem) => {
    const label = `${map.mapTypeName} • ${map.operationName} • Setor ${map.sectorName}`;
    if (!window.confirm(`Excluir definitivamente este mapa?\n\n${label}`))
      return;
    setData({
      ...data,
      printItems: data.printItems.filter((item) => item.id !== map.id),
    });
    flash("Mapa excluído ✓");
  };
  const generateWorkedArea = (
    source: PrintLegendItem,
    areaPeriod: "shift" | "total",
  ) => {
    const now = new Date().toISOString();
    const clone = {
      ...source,
      id: uid(),
      mapTypeName: "Área Trabalhada",
      areaPeriod,
      mainImage: "",
      sentAt: "",
      extractedData: emptyExtracted(),
      createdAt: now,
      updatedAt: now,
      finalLegend: "",
      generatedLegend: "",
    } as PrintLegendItem;
    clone.generatedLegend = buildLegend(clone);
    clone.finalLegend = clone.generatedLegend;
    setData({ ...data, printItems: [clone, ...data.printItems] });
    flash(
      areaPeriod === "total"
        ? "Área Trabalhada Total criada ✓"
        : "Área Trabalhada do Turno criada ✓",
    );
  };
  const removeMap = () => {
    if (!draft.id) return;
    setData({
      ...data,
      printItems: data.printItems.filter((item) => item.id !== draft.id),
    });
    setScreen("overview");
    flash("Mapa excluído");
  };
  const visible = data.printItems.filter((map) =>
    [map.operationName, map.sectorName, map.mapTypeName, map.scheduledTime]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const grouped = visible.reduce<Record<string, PrintLegendItem[]>>(
    (groups, map) => {
      const key = JSON.stringify([
        map.operationName || "Sem operação",
        map.sectorName || "Sem setor",
      ]);
      (groups[key] ??= []).push(map);
      return groups;
    },
    {},
  );
  return (
    <div className="central">
      <header className="topbar">
        <div className="logo">
          <span>C</span>
          <div>
            <b>CENTRAL DE MAPAS</b>
            <small>COA • OPERAÇÃO</small>
          </div>
        </div>
        <nav>
          <button
            className={screen === "overview" ? "active" : ""}
            onClick={() => setScreen("overview")}
          >
            Visão geral
          </button>
          <button
            className={screen === "form" ? "active" : ""}
            onClick={openNew}
          >
            Adicionar mapa
          </button>
        </nav>
        <button className="newButton" onClick={openNew}>
          ＋ Adicionar mapa
        </button>
      </header>
      <main className="workspace">
        {screen === "overview" ? (
          <Overview
            maps={visible}
            grouped={grouped}
            query={query}
            setQuery={setQuery}
            onNew={openNew}
            onEdit={openEdit}
            onUpdate={updateMap}
            onGenerateArea={generateWorkedArea}
            onDelete={deleteMapFromOverview}
            flash={flash}
          />
        ) : (
          <MapForm
            draft={draft}
            setDraft={setDraft}
            onFinish={finish}
            onCancel={() => setScreen("overview")}
            onDelete={draft.id ? removeMap : undefined}
          />
        )}
      </main>
      {toast && <div className="toastNew">{toast}</div>}
    </div>
  );
}

function Overview({
  maps,
  grouped,
  query,
  setQuery,
  onNew,
  onEdit,
  onUpdate,
  onGenerateArea,
  onDelete,
  flash,
}: {
  maps: PrintLegendItem[];
  grouped: Record<string, PrintLegendItem[]>;
  query: string;
  setQuery: (value: string) => void;
  onNew: () => void;
  onEdit: (map: PrintLegendItem) => void;
  onUpdate: (map: PrintLegendItem) => void;
  onGenerateArea: (map: PrintLegendItem, mode: "shift" | "total") => void;
  onDelete: (map: PrintLegendItem) => void;
  flash: (message: string) => void;
}) {
  const sent = maps.filter((map) => map.sentAt).length;
  return (
    <>
      <section className="overviewHead">
        <div>
          <span className="kicker">PAINEL OPERACIONAL</span>
          <h1>Visão geral</h1>
          <p>
            Prepare antes, atualize a imagem na hora e controle o que já foi
            enviado.
          </p>
        </div>
        <div className="overviewStats">
          <span>
            <b>{maps.length}</b> mapas
          </span>
          <span className="readyStat">
            <b>{maps.length - sent}</b> para enviar
          </span>
          <span className="sentStat">
            <b>{sent}</b> enviados
          </span>
        </div>
      </section>
      <div className="overviewTools">
        <label>
          ⌕{" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar operação, setor ou tipo..."
          />
        </label>
        <button className="newButton" onClick={onNew}>
          ＋ Adicionar mapa
        </button>
      </div>
      {maps.length === 0 ? (
        <div className="firstMap">
          <span>◇</span>
          <h2>Nenhum mapa criado</h2>
          <p>
            Comece adicionando seu primeiro mapa. A imagem pode ser colocada
            depois.
          </p>
          <button className="newButton" onClick={onNew}>
            ＋ Criar primeiro mapa
          </button>
        </div>
      ) : (
        <div className="groups">
          {Object.entries(grouped).map(([operation, items]) => (
            <OperationSection
              key={operation}
              operation={operation}
              items={items}
              onEdit={onEdit}
              onUpdate={onUpdate}
              onGenerateArea={onGenerateArea}
              onDelete={onDelete}
              flash={flash}
            />
          ))}
        </div>
      )}
    </>
  );
}

function OperationSection({
  operation,
  items,
  onEdit,
  onUpdate,
  onGenerateArea,
  onDelete,
  flash,
}: {
  operation: string;
  items: PrintLegendItem[];
  onEdit: (map: PrintLegendItem) => void;
  onUpdate: (map: PrintLegendItem) => void;
  onGenerateArea: (map: PrintLegendItem, mode: "shift" | "total") => void;
  onDelete: (map: PrintLegendItem) => void;
  flash: (message: string) => void;
}) {
  const [operationName, sectorName] = JSON.parse(operation) as [string, string];
  const [open, setOpen] = useState(false);
  const sent = items.filter((item) => item.sentAt).length;
  return (
    <section className={open ? "operationGroup open" : "operationGroup"}>
      <button className="groupTitle" onClick={() => setOpen((value) => !value)}>
        <div>
          <span>OPERAÇÃO</span>
          <h2>{operationName}</h2>
          <strong className="sectorHighlight">SETOR {sectorName}</strong>
          <small>
            {items.length} mapas • {items.length - sent} pendentes
          </small>
        </div>
        <b>
          {sent}/{items.length} enviados <i>{open ? "▲" : "▼"}</i>
        </b>
      </button>
      {open && (
        <div className="mapGrid">
          {items.map((map) => (
            <MapCard
              key={map.id}
              map={map}
              onEdit={() => onEdit(map)}
              onUpdate={onUpdate}
              onGenerateArea={onGenerateArea}
              onDelete={() => onDelete(map)}
              flash={flash}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MapCard({
  map,
  onEdit,
  onUpdate,
  onGenerateArea,
  onDelete,
  flash,
}: {
  map: PrintLegendItem;
  onEdit: () => void;
  onUpdate: (map: PrintLegendItem) => void;
  onGenerateArea: (map: PrintLegendItem, mode: "shift" | "total") => void;
  onDelete: () => void;
  flash: (message: string) => void;
}) {
  const legend = decorateAverages(map.finalLegend || buildLegend(map));
  const attach = async (file: Blob) => {
    const mainImage = await fileUrl(file);
    onUpdate({ ...map, mainImage, updatedAt: new Date().toISOString() });
    flash("Imagem atualizada ✓");
  };
  const copyImage = async () => {
    if (!map.mainImage) return flash("Adicione a imagem primeiro");
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": await imageToPng(map.mainImage) }),
      ]);
      flash("Imagem copiada ✓");
    } catch {
      flash("Não foi possível copiar a imagem");
    }
  };
  return (
    <article
      tabIndex={0}
      onPaste={(event) => {
        const image = imageFromPaste(event);
        if (image) attach(image);
      }}
      className={map.sentAt ? "mapCardNew sent" : "mapCardNew"}
    >
      <div className="mapImage">
        {map.mainImage ? (
          <img src={map.mainImage} />
        ) : (
          <div className="pasteEmpty">
            <span>▣</span>
            <b>Imagem ainda não adicionada</b>
            <button
              onClick={async () => {
                const image = await readClipboardImage();
                if (image) attach(image);
                else flash("Copie uma imagem antes");
              }}
            >
              Colar imagem
            </button>
            <small>Ou selecione este cartão e pressione Ctrl + V</small>
          </div>
        )}
        <span
          className={
            map.sentAt
              ? "status sentStatus"
              : map.mainImage
                ? "status readyStatus"
                : "status waitingStatus"
          }
        >
          {map.sentAt
            ? "✓ ENVIADO"
            : map.mainImage
              ? "PRONTO"
              : "AGUARDANDO IMAGEM"}
        </span>
      </div>
      <div className="mapInfo">
        <div className="mapTitle">
          <div>
            <span>
              {map.scheduledTime || "SEM HORÁRIO"} • TURNO {map.shift}
            </span>
            <h3 className="cardMapType">
              {map.mapTypeName === "Área Trabalhada" ? (
                <>
                  Área Trabalhada{" "}
                  <span
                    className={
                      map.areaPeriod === "total"
                        ? "areaKind total"
                        : "areaKind shift"
                    }
                  >
                    {map.areaPeriod === "total"
                      ? "TOTAL"
                      : `TURNO ${map.shift || "C"}`}
                  </span>
                </>
              ) : (
                map.mapTypeName
              )}
            </h3>
            <p>Setor {map.sectorName}</p>
          </div>
          <div className="cardManage">
            <button onClick={onEdit}>Editar</button>
            <button className="quickDelete" onClick={onDelete}>
              Excluir
            </button>
          </div>
        </div>
        <pre>{legend}</pre>
        <div className="cardButtons">
          <button disabled={!map.mainImage} onClick={copyImage}>
            Copiar imagem
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(legend);
              flash("Legenda copiada ✓");
            }}
          >
            Copiar legenda
          </button>
        </div>
        <button
          className="pasteImageButton"
          onClick={async () => {
            const image = await readClipboardImage();
            if (image) attach(image);
            else flash("Copie uma imagem antes");
          }}
        >
          ▣ Colar imagem da área de transferência
        </button>
        {map.mapTypeName !== "Área Trabalhada" && (
          <div className="generateArea">
            <span>Gerar Área Trabalhada</span>
            <div>
              <button onClick={() => onGenerateArea(map, "shift")}>
                Do turno
              </button>
              <button onClick={() => onGenerateArea(map, "total")}>
                Total
              </button>
            </div>
          </div>
        )}
        {map.mainImage && (
          <label className="replaceImage">
            ↻ Trocar imagem
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) attach(file);
              }}
            />
          </label>
        )}
        <button
          className={map.sentAt ? "sentToggle done" : "sentToggle"}
          onClick={() => {
            const sentAt = map.sentAt ? "" : new Date().toISOString();
            onUpdate({ ...map, sentAt, updatedAt: new Date().toISOString() });
            flash(
              sentAt ? "Marcado como enviado ✓" : "Marcado como não enviado",
            );
          }}
        >
          {map.sentAt
            ? `✓ Já enviado às ${new Date(map.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — desfazer`
            : "Marcar como já enviado"}
        </button>
      </div>
    </article>
  );
}

function MapForm({
  draft,
  setDraft,
  onFinish,
  onCancel,
  onDelete,
}: {
  draft: Partial<PrintLegendItem>;
  setDraft: (map: Partial<PrintLegendItem>) => void;
  onFinish: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const averages = draft.extractedData?.equipmentAverages ?? [];
  const [pad, setPad] = useState<number | null>(null);
  const set = (key: keyof PrintLegendItem, value: string) =>
    setDraft({ ...draft, [key]: value, finalLegend: "" });
  const updateAverage = (index: number, patch: Partial<EquipmentAverage>) =>
    setDraft({
      ...draft,
      extractedData: {
        ...(draft.extractedData ?? emptyExtracted()),
        equipmentAverages: averages.map((entry, position) =>
          position === index ? { ...entry, ...patch } : entry,
        ),
      },
      finalLegend: "",
    });
  const addFleet = () =>
    setDraft({
      ...draft,
      extractedData: {
        ...(draft.extractedData ?? emptyExtracted()),
        equipmentAverages: [
          ...averages,
          {
            equipment: "",
            average: "",
            unit: draft.mapTypeName === "Vazão" ? "L/ha" : "km/h",
          },
        ],
      },
    });
  const press = (key: string) => {
    if (pad === null) return;
    const value = averages[pad]?.average ?? "";
    if (key === "⌫") updateAverage(pad, { average: value.slice(0, -1) });
    else if (key === "C") updateAverage(pad, { average: "" });
    else if (!(key === "," && value.includes(",")))
      updateAverage(pad, { average: value + key });
  };
  const pasteDraft = async (image?: Blob | null) => {
    const blob = image ?? (await readClipboardImage());
    if (!blob) return;
    setDraft({ ...draft, mainImage: await fileUrl(blob) });
  };
  return (
    <div
      className="formScreen"
      onPaste={(event) => {
        const image = imageFromPaste(event);
        if (image) pasteDraft(image);
      }}
    >
      <div className="formHead">
        <button onClick={onCancel}>← Voltar</button>
        <div>
          <span className="kicker">
            {draft.id ? "EDITAR MAPA" : "NOVO MAPA"}
          </span>
          <h1>{draft.id ? "Manipular mapa" : "Adicionar um mapa"}</h1>
          <p>
            Defina o mapa agora. A imagem pode ser adicionada na Visão Geral
            quando estiver atualizada.
          </p>
          <button
            className="pasteDraftButton"
            onClick={async () => {
              const image = await readClipboardImage();
              if (image) pasteDraft(image);
            }}
          >
            ▣{" "}
            {draft.mainImage
              ? "Substituir imagem colada"
              : "Colar imagem agora"}
          </button>
        </div>
      </div>
      <div className="formLayout">
        <section className="definition">
          <h2>Definição do mapa</h2>
          <div className="fields">
            <label>
              Setor
              <input
                autoFocus
                value={draft.sectorName ?? ""}
                onChange={(event) => set("sectorName", event.target.value)}
                placeholder="Ex.: J2"
              />
            </label>
            <label>
              Operação
              <input
                value={draft.operationName ?? ""}
                onChange={(event) => set("operationName", event.target.value)}
                placeholder="Ex.: Plantio de Cana"
              />
            </label>
            <label>
              Tipo do mapa
              <select
                value={draft.mapTypeName}
                onChange={(event) => set("mapTypeName", event.target.value)}
              >
                <option>Velocidade</option>
                <option>Área Trabalhada</option>
                <option>Vazão</option>
                <option>Outro</option>
              </select>
            </label>
            <label>
              Turno
              <input
                value={draft.shift ?? "C"}
                onChange={(event) => set("shift", event.target.value)}
              />
            </label>
            <label>
              Horário previsto
              <input
                type="time"
                value={draft.scheduledTime ?? ""}
                onChange={(event) => set("scheduledTime", event.target.value)}
              />
            </label>
          </div>
          {draft.mapTypeName !== "Área Trabalhada" && (
            <div className="fleets">
              <div>
                <h2>Frotas e médias</h2>
                <button onClick={addFleet}>＋ Adicionar frota</button>
              </div>
              {averages.length === 0 && (
                <p>
                  Nenhuma frota adicionada. Você também pode incluir depois.
                </p>
              )}
              {averages.map((entry, index) => (
                <div className="fleetLine" key={index}>
                  <input
                    value={entry.equipment}
                    onChange={(event) =>
                      updateAverage(index, { equipment: event.target.value })
                    }
                    placeholder="Frota: 1528"
                  />
                  <button className="mediaButton" onClick={() => setPad(index)}>
                    {entry.average || "Definir média"}
                  </button>
                  <span>{entry.unit}</span>
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        extractedData: {
                          ...(draft.extractedData ?? emptyExtracted()),
                          equipmentAverages: averages.filter(
                            (_, position) => position !== index,
                          ),
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="finishBar">
            {onDelete && (
              <button className="deleteMap" onClick={onDelete}>
                Excluir mapa
              </button>
            )}
            <span />
            <button onClick={onCancel}>Cancelar</button>
            <button className="finishButton" onClick={onFinish}>
              Finalizar mapa → Visão Geral
            </button>
          </div>
        </section>
        <aside className="legendLive">
          <span className="kicker">PADRÃO DA DESCRIÇÃO</span>
          <h2>Legenda pronta</h2>
          <pre>{draft.finalLegend || buildLegend(draft)}</pre>
          <small>Você poderá editar tudo novamente pela Visão Geral.</small>
        </aside>
      </div>
      {pad !== null && (
        <div className="padOverlay" onClick={() => setPad(null)}>
          <div
            className="numberPad"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="kicker">
              MÉDIA DA FROTA {averages[pad]?.equipment}
            </span>
            <strong>{averages[pad]?.average || "0,00"}</strong>
            <div className="digitKeys">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"].map(
                (key) => (
                  <button key={key} onClick={() => press(key)}>
                    {key}
                  </button>
                ),
              )}
            </div>
            <div className="padBottom">
              <button onClick={() => press("C")}>Limpar</button>
              <button className="finishButton" onClick={() => setPad(null)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildLegend(map: Partial<PrintLegendItem>) {
  const type = map.mapTypeName || "Mapa";
  const title =
    type === "Velocidade" || type === "Vazão"
      ? `Acompanhamento de ${type}`
      : type;
  if (type === "Área Trabalhada") {
    const parts = (map.operationName || "OPERAÇÃO").split(/\s+[–-]\s+/);
    const activity = parts[0];
    const action = parts.slice(1).join(" – ");
    const period =
      map.areaPeriod === "total" ? "Total" : `Turno ${map.shift || "C"}`;
    return [
      `Segue Acompanhamento de Área trabalhada - ${period}`,
      `${activity} – ${map.sectorName || "SETOR"}`,
      action,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const header = `Segue ${title} - Turno ${map.shift || "C"}\n${map.operationName || "OPERAÇÃO"} – Setor - ${map.sectorName || "SETOR"}`;
  const averages = map.extractedData?.equipmentAverages ?? [];
  return type !== "Área Trabalhada" && averages.length
    ? `${header}\n\n${averages
        .filter((entry) => entry.equipment || entry.average)
        .map(
          (entry) =>
            `${entry.equipment} - ${entry.average} ${entry.unit} \`Média\``,
        )
        .join("\n")}`
    : header;
}
function decorateAverages(legend: string) {
  return legend.replace(/(?<!`)\bM[eé]dia\b(?!`)/gi, "`Média`");
}
const fileUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
function imageFromPaste(event: React.ClipboardEvent) {
  const item = [...event.clipboardData.items].find((entry) =>
    entry.type.startsWith("image/"),
  );
  return item?.getAsFile() ?? null;
}
async function readClipboardImage() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((value) => value.startsWith("image/"));
      if (type) return item.getType(type);
    }
    return null;
  } catch {
    return null;
  }
}
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
