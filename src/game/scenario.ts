// シナリオ「午後3時の美術館」のデータ。
// ゲームの進行ロジックは engine.ts、ここは文章と設定だけを持つ。

export type ZoneId = 'lobby' | 'gallery' | 'sculpture' | 'office' | 'hall' | 'vault'

export type ClueId =
  | 'explosion'
  | 'clock'
  | 'guardCode'
  | 'curatorBreak'
  | 'paintingYear'
  | 'notebook'
  | 'device'
  | 'drawerKey'
  | 'guardPatrol'
  | 'dial'
  | 'curatorHint'
  | 'normalEnd'
  | 'clockHand'
  | 'sketchBack'
  | 'handFound'
  | 'clockFixed'
  | 'lastMinute'
  | 'curatorHint2'

export type TargetId =
  | 'clock'
  | 'portrait'
  | 'harbor'
  | 'sketch'
  | 'desk'
  | 'counter'
  | 'device'
  | 'entrance'
  | 'crate'

export type NpcId = 'guard' | 'curator'

export type CodeTarget = 'vaultDoor' | 'device'

/** 時刻は「その日の0時からの秒」で扱う */
export const at = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s

export const LOOP_START = at(14, 50)
export const EXPLOSION_TIME = at(15, 5)

/** 行動ごとにかかる時間（秒） */
export const COST = {
  step: 5,
  examine: 30,
  talk: 60,
  code: 30,
} as const

export const VAULT_CODE = '1887'
/** ノーマルエンド：はじまりに戻る */
export const DEVICE_CODE = '1450'
/** トゥルーエンド：いちばん怖い時刻へ進む */
export const FORWARD_CODE = '1505'
/** トゥルーエンドの番号を受け付ける「最後の一分」の始まり */
export const LAST_MINUTE = at(15, 4)

export const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/**
 * 美術館全体のマップ。1文字が1マス。
 * `#` 壁 / `.` 床 / `+` 出入口 / `V` 収蔵庫の扉（暗証番号） / `E` 正面玄関（開かない）
 * 壁の絵：`P` 肖像画 / `Q` 港の絵 / `R` 素描
 * 物：`C` 大時計 / `D` 学芸員の机 / `T` 受付カウンター / `M` ガラスケースの装置
 * 飾り：`B` 本棚 / `d` 作業机 / `S` 彫像 / `b` ベンチ / `p` 植木 / `x` 木箱
 * `X` 木箱（見た目は `x` と同じ。長針が眠っている）
 */
export const MAP = [
  '########################',
  '#BB....p#p....p#x..M..X#',
  '#...D...#......#.......#',
  '#.......+......V.......#',
  '#d......#......#.......#',
  '#p......#......#x.....x#',
  '##Q#P#R####++###########',
  '#p.....p#C....p#.......#',
  '#.......#......#.S...S.#',
  '#..b.b..#......#.......#',
  '#.......#......#..S.S..#',
  '#.......+......+.......#',
  '#.......#TT....#.......#',
  '#p.....p#......#p..S..p#',
  '#.......#......#.......#',
  '###########EE###########',
]

export const START_POS = { x: 11, y: 14 }

interface Zone {
  name: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export const ZONES: Record<ZoneId, Zone> = {
  office: { name: '学芸員室', x1: 1, y1: 1, x2: 7, y2: 5 },
  hall: { name: '廊下', x1: 9, y1: 1, x2: 14, y2: 5 },
  vault: { name: '収蔵庫', x1: 16, y1: 1, x2: 22, y2: 5 },
  gallery: { name: '絵画室', x1: 1, y1: 7, x2: 7, y2: 14 },
  lobby: { name: 'ロビー', x1: 9, y1: 7, x2: 14, y2: 14 },
  sculpture: { name: '彫刻室', x1: 16, y1: 7, x2: 22, y2: 14 },
}

export const zoneAt = (x: number, y: number): ZoneId | null => {
  for (const [id, z] of Object.entries(ZONES) as [ZoneId, Zone][]) {
    if (x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2) return id
  }
  return null
}

export const TARGET_TILES: Record<string, TargetId> = {
  C: 'clock',
  P: 'portrait',
  Q: 'harbor',
  R: 'sketch',
  D: 'desk',
  T: 'counter',
  M: 'device',
  E: 'entrance',
  X: 'crate',
}

export const TARGET_NAMES: Record<TargetId, string> = {
  clock: '大時計',
  portrait: '肖像画',
  harbor: '港の絵',
  sketch: '素描',
  desk: '学芸員の机',
  counter: '受付',
  device: 'ガラスケース',
  entrance: '正面玄関',
  crate: '木箱',
}

/** 調べても時間の進まない飾り */
export const DECOR_TEXT: Record<string, string> = {
  B: '美術年鑑が隙間なく並んでいる。',
  d: '修復途中の額縁が置かれている。',
  S: '白い石の像。目が合った気がした。',
  b: '誰も座っていないベンチ。',
  p: '観葉植物。葉が少しも揺れていない。',
  x: '埃をかぶった木箱。',
}

export const NPC_NAMES: Record<NpcId, string> = {
  guard: '警備員',
  curator: '学芸員',
}

interface Stop {
  /** この時刻から */
  from: number
  /** null のあいだは館内にいない */
  pos: { x: number; y: number } | null
}

/** 人物の居場所の予定。時刻順に並べる */
export const SCHEDULES: Record<NpcId, Stop[]> = {
  guard: [
    { from: 0, pos: { x: 11, y: 13 } },
    { from: at(14, 56), pos: { x: 19, y: 12 } },
    { from: at(14, 59), pos: { x: 11, y: 13 } },
  ],
  curator: [
    { from: 0, pos: { x: 4, y: 1 } },
    { from: at(15, 0), pos: null },
    { from: at(15, 4), pos: { x: 4, y: 1 } },
  ],
}

export interface Clue {
  title: string
  text: string
}

/** メモ帳に残る記憶。ループしても消えない。 */
export const CLUES: Record<ClueId, Clue> = {
  explosion: { title: '15:05', text: '奥から閃光。気づけば、また14:50。' },
  clock: { title: '大時計', text: '目覚めるたび、針は14:50。' },
  guardCode: { title: '収蔵庫', text: '番号を知るのは学芸員だけ。' },
  curatorBreak: { title: '学芸員', text: '三時きっかりに席を立つ。' },
  paintingYear: { title: '《午後三時の肖像》', text: '1887年。' },
  notebook: { title: '手帳の走り書き', text: '「収蔵庫 ― 肖像の生まれ年」' },
  device: { title: 'ガラスケース', text: '中で歯車が回っている。小さな鍵穴。' },
  drawerKey: { title: 'ケースの鍵', text: '受付の引き出しの中。' },
  guardPatrol: { title: '警備員', text: '五十六分、彫刻室へ見回り。三分で戻る。' },
  dial: { title: '装置の溝', text: '四つの数字。「はじまりへ」と彫られている。' },
  curatorHint: { title: '祖父の口癖', text: '「終わらせたいなら、はじまりに戻れ」' },
  normalEnd: { title: '1450', text: '時は止まった。三時は、来なかった。' },
  clockHand: { title: '長針のない大時計', text: '短い針だけが、二と三のあいだ。' },
  sketchBack: { title: '素描の裏', text: '「長針は眠らせた。冷たい部屋の、箱の中」' },
  handFound: { title: '真鍮の長針', text: '収蔵庫の木箱の底に。' },
  clockFixed: { title: '動き出した大時計', text: '長針をはめると、本当の時刻を刻みはじめた。' },
  lastMinute: { title: '溝の上の銘', text: '「進みたいなら、最後の一分に、次の刻を」' },
  curatorHint2: { title: '口癖の続き', text: '「進みたいなら、いちばん怖い時刻を刻め」' },
}

export const CLUE_ORDER: ClueId[] = [
  'explosion',
  'clock',
  'guardCode',
  'curatorBreak',
  'paintingYear',
  'notebook',
  'device',
  'drawerKey',
  'guardPatrol',
  'dial',
  'curatorHint',
  'normalEnd',
  'clockHand',
  'sketchBack',
  'handFound',
  'clockFixed',
  'curatorHint2',
  'lastMinute',
]
