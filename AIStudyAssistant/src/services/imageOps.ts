// Image editing runs in the browser on a <canvas>; the server validates and stores
// both the original and the edited file.

export interface EditSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  rotate: 0 | 90 | 180 | 270;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  flip: boolean;
  crop: boolean;
  background: string | null;
  text: string;
  /** Parts recoloured by the AI (the pixels themselves live in the page's working image). */
  recolor: string;
}

export const DEFAULT_SETTINGS: EditSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  rotate: 0,
  grayscale: false,
  sepia: false,
  invert: false,
  flip: false,
  crop: false,
  background: null,
  text: "",
  recolor: "",
};

const COLORS: [RegExp, string][] = [
  [/ақ(?!\p{L})|white|бел/iu, "#ffffff"],
  [/қара|black|чёрн|черн/iu, "#000000"],
  [/сұр|gr[ae]y|сер/iu, "#9aa1a9"],
  [/көк|blue|син|голуб/iu, "#2f6fd6"],
  [/қызыл|red|красн/iu, "#d64545"],
  [/жасыл|green|зел[её]н/iu, "#2f9e5b"],
  [/сары|yellow|ж[её]лт/iu, "#f2c230"],
];

/** Turns a free-text instruction (kk/ru/en) into edit settings. */
export function parseInstruction(input: string): Partial<EditSettings> {
  const s = input.toLowerCase();
  const out: Partial<EditSettings> = {};
  if (/ақ-?қара|ақ қара|черно-?бел|ч\/б|grayscale|greyscale|black (and|&) white|b\/w/u.test(s)) out.grayscale = true;
  if (/сепия|sepia|ескі фото|старое фото|vintage/u.test(s)) out.sepia = true;
  if (/инверс|негатив|invert|negative/u.test(s)) out.invert = true;
  if (/жарық(ты|ырақ)?\s*(көбейт|арттыр|қос)|жарқын|ярче|светлее|увеличь яркость|bright(er|en)|more light/u.test(s)) out.brightness = 130;
  if (/күңгірт|қараңғы|темнее|затемн|dark(er|en)/u.test(s)) out.brightness = 75;
  if (/контраст|contrast/u.test(s)) out.contrast = /азайт|меньше|less|lower|decrease/u.test(s) ? 75 : 135;
  if (/қанық|насыщ|saturat|vivid|vibrant/u.test(s)) out.saturation = /азайт|меньше|less|lower/u.test(s) ? 60 : 145;
  if (/бұлыңғыр|бұлдыр|размыт|blur/u.test(s)) out.blur = 3;
  if (/бұр|поверн|rotat|turn/u.test(s)) {
    const deg = /(90|180|270)/.exec(s)?.[1];
    out.rotate = (deg ? Number(deg) : 90) as EditSettings["rotate"];
  }
  if (/айна|отраз|зеркал|mirror|flip/u.test(s)) out.flip = true;
  if (/қи(ып|у)?(?!\p{L})|обреж|обрез|crop|шаршы|квадрат|square/u.test(s)) out.crop = true;
  if (/фон|background|аясы/u.test(s)) {
    for (const [re, color] of COLORS) {
      if (re.test(s)) {
        out.background = color;
        break;
      }
    }
  }
  const quoted = /[«"“„']([^»"”']{1,60})[»"”']/u.exec(input);
  if (quoted && /мәтін|жазу|текст|надпис|text|caption|title|қос|добав|add/iu.test(input)) out.text = quoted[1].trim();
  return out;
}

export function operationsOf(settings: EditSettings): string[] {
  const ops: string[] = [];
  if (settings.recolor) ops.push("recolor");
  if (settings.crop) ops.push("crop");
  if (settings.rotate) ops.push("rotate");
  if (settings.flip) ops.push("flip");
  if (settings.brightness !== 100) ops.push("brightness");
  if (settings.contrast !== 100) ops.push("contrast");
  if (settings.saturation !== 100) ops.push("saturation");
  if (settings.grayscale) ops.push("grayscale");
  if (settings.sepia) ops.push("sepia");
  if (settings.invert) ops.push("invert");
  if (settings.blur > 0) ops.push("blur");
  if (settings.background) ops.push("background");
  if (settings.text.trim()) ops.push("text");
  return ops;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const MAX_SIDE = 2400;

/** Renders the image with the given settings and returns a data URL in the same format. */
export function renderEdited(img: HTMLImageElement, settings: EditSettings, mime: string): string {
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (settings.crop) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = side;
    sh = side;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const swap = settings.rotate === 90 || settings.rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  if (settings.background || mime === "image/jpeg") {
    ctx.fillStyle = settings.background ?? "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((settings.rotate * Math.PI) / 180);
  if (settings.flip) ctx.scale(-1, 1);
  ctx.filter = [
    `brightness(${settings.brightness}%)`,
    `contrast(${settings.contrast}%)`,
    `saturate(${settings.saturation}%)`,
    settings.grayscale ? "grayscale(100%)" : "",
    settings.sepia ? "sepia(100%)" : "",
    settings.invert ? "invert(100%)" : "",
    settings.blur > 0 ? `blur(${settings.blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.restore();

  const text = settings.text.trim();
  if (text) {
    const size = Math.max(16, Math.round(canvas.width / 14));
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = Math.max(2, size / 8);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.fillStyle = "#ffffff";
    const y = canvas.height - size * 0.6;
    ctx.strokeText(text, canvas.width / 2, y, canvas.width * 0.92);
    ctx.fillText(text, canvas.width / 2, y, canvas.width * 0.92);
  }
  return canvas.toDataURL(mime, 0.92);
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** "Paint this part of the picture this colour": `target` is an English prompt for the segmentation model. */
export interface RecolorRequest {
  target: string;
  color: string;
  /** The student's own word for the part, for messages. */
  word: string;
}

// Colour words (kk/ru/en) matched against whole words; the hex is the shade the region is dyed to.
const DYE_COLORS: [RegExp, string, string][] = [
  [/^(қара|қараға|черн\p{L}*|чёрн\p{L}*|black)$/u, "#1c1c1c", "black"],
  [/^(ақ|аққа|бел(ый|ая|ое|ые|ым|ыми|ого|ую)|white)$/u, "#f4f4f4", "white"],
  [/^(сұр|сұрға|сер(ый|ая|ое|ые|ым|ыми|ого|ую)|gr[ae]y)$/u, "#8d939a", "gray"],
  [/^(көгілдір\p{L}*|голуб\p{L}*|light-?blue)$/u, "#6fb7ea", "light blue"],
  [/^(көк|көкке|син(ий|яя|ее|ие|им|ими|его|юю)|blue)$/u, "#2f63d6", "blue"],
  [/^(қызғылт сары|сарғыш\p{L}*|оранж\p{L}*|рыж\p{L}*|orange|ginger)$/u, "#ee8a2a", "orange"],
  [/^(қызғылт\p{L}*|розов\p{L}*|pink)$/u, "#ef7fb0", "pink"],
  [/^(қызыл|қызылға|красн\p{L}*|red)$/u, "#d33a3a", "red"],
  [/^(жасыл|жасылға|зел[её]н\p{L}*|green)$/u, "#2e9b55", "green"],
  [/^(сары|сарыға|ж[её]лт\p{L}*|yellow|blond[e]?)$/u, "#f0c63a", "yellow"],
  [/^(қоңыр|қоңырға|коричнев\p{L}*|каштан\p{L}*|brown)$/u, "#7a4b2a", "brown"],
  [/^(күлгін\p{L}*|фиолет\p{L}*|сирен\p{L}*|purple|violet)$/u, "#7b4bc4", "purple"],
  [/^(алтын\p{L}*|золот\p{L}*|gold(en)?)$/u, "#d4a63a", "gold"],
];

// Parts of a picture the segmentation model can find, by word stem (kk/ru/en) -> English prompt.
const OBJECTS: [RegExp, string][] = [
  [/^(шаш|волос|hair)/u, "hair"],
  [/^(көз(і|ін|дер|дерін|ді)?$|глаз|eyes?$)/u, "eyes"],
  [/^(қас(ы|ын|тар|тарын)?$|бров|eyebrows?$)/u, "eyebrows"],
  [/^(сақал|бород|beard)/u, "beard"],
  [/^(ерін|ернін|губ|lips?$)/u, "lips"],
  [/^(бет(і|ін|ті)?$|лиц[оау]|face$)/u, "face"],
  [/^(аспан|неб[оа]|sky)/u, "sky"],
  [/^(бұлт|облак|cloud)/u, "clouds"],
  [/^(көйлег|көйлек|плать|dress)/u, "dress"],
  [/^(жейде|рубаш|рубах|shirt)/u, "shirt"],
  [/^(футболк|t-?shirt)/u, "t-shirt"],
  [/^(шалбар|штан|брюк|trousers|pants)/u, "trousers"],
  [/^(джинс|jeans)/u, "jeans"],
  [/^(күрте|куртк|jacket)/u, "jacket"],
  [/^(бас киім|қалпақ|бөрік|шапк|шляп|кепк|hat|cap$)/u, "hat"],
  [/^(аяқ киім|етік|обув|ботин|кроссов|shoes?|boots?$)/u, "shoes"],
  [/^(сөмке|сумк|bag)/u, "bag"],
  [/^(тырнақ|ногт|nails?$)/u, "nails"],
  [/^(ағаш|дерев|trees?$)/u, "tree"],
  [/^(шөп|трав|grass)/u, "grass"],
  [/^(жапырақ|листь|листв|leaves|leaf$)/u, "leaves"],
  [/^(гүл|цвето[кч]|цветы$|flowers?$)/u, "flower"],
  [/^(көлік|машин|автомоб|car$|cars$)/u, "car"],
  [/^(мысық|кошк|кот$|кота$|cats?$)/u, "cat"],
  [/^(ит(ті|ін|тің|)$|собак|dogs?$)/u, "dog"],
  [/^(құс|птиц|birds?$)/u, "bird"],
  [/^(жылқы|лошад|horses?$)/u, "horse"],
  [/^(су(ды|ын|ы)?$|вод[ауы]$|water$)/u, "water"],
  [/^(теңіз|мор[еяю]$|sea$)/u, "sea"],
  [/^(тау(ды|лар|ларды)?$|гор[ыау]?$|mountains?$)/u, "mountains"],
  [/^(үй(ді|дің|і|ін)?$|дом$|дома$|house$)/u, "house"],
  [/^(қабырға|стен|walls?$)/u, "wall"],
  [/^(есік|двер|doors?$)/u, "door"],
  [/^(терезе|окн|окон|windows?$)/u, "window"],
  [/^(жол(ды)?$|дорог|road$)/u, "road"],
  [/^(доп|мяч|ball$)/u, "ball"],
];

/** Finds "dye <part> <colour>" in an instruction ("шашын қара түске боя" -> hair, black). */
export function parseRecolor(input: string): RecolorRequest | null {
  const text = input.toLowerCase().replace(/бас киім|аяқ киім|қызғылт сары/gu, (m) => m.replace(" ", " "));
  const words = text.match(/[\p{L} -]+/gu)?.map((w) => w.replace(/ /g, " ")) ?? [];
  const objectAt = words.findIndex((w) => OBJECTS.some(([re]) => re.test(w)));
  if (objectAt < 0) return null;
  const colorOf = (w: string) => DYE_COLORS.find(([re]) => re.test(w));
  const after = words.slice(objectAt + 1).map(colorOf).find(Boolean);
  const before = objectAt > 0 ? colorOf(words[objectAt - 1]) : undefined;
  const dye = after ?? before;
  if (!dye) return null;
  const object = OBJECTS.find(([re]) => re.test(words[objectAt]))![1];
  // A colour named right before the part describes it ("the red dress") when another colour follows.
  const target = after && before ? `${before[2]} ${object}` : object;
  return { target, color: dye[1], word: words[objectAt] };
}
