// シナリオ「午後3時の美術館」のデータ。
// ゲームの進行ロジックは engine.ts、ここは文章と設定だけを持つ。

export type RoomId = 'lobby' | 'gallery' | 'office' | 'storage'

export type ClueId =
  | 'explosion'
  | 'guardCode'
  | 'curatorBreak'
  | 'paintingYear'
  | 'notebook'
  | 'device'
  | 'clock'

export type TargetId = 'clock' | 'storageDoor' | 'painting' | 'desk' | 'device'

export type NpcId = 'guard' | 'curator'

export type CodeTarget = 'storageDoor' | 'device'

/** 時刻は「その日の0時からの分」で扱う */
export const toMinutes = (h: number, m: number) => h * 60 + m

export const LOOP_START = toMinutes(14, 50)
export const EXPLOSION_TIME = toMinutes(15, 5)
/** 学芸員が席を外している時間帯 [開始, 終了) */
export const CURATOR_AWAY_FROM = toMinutes(15, 0)
export const CURATOR_AWAY_UNTIL = toMinutes(15, 4)

export const STORAGE_CODE = '1887'
export const DEVICE_CODE = '1450'

export const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export interface Room {
  name: string
  /**
   * 部屋のマップ。1文字が1マス。
   * 床・壁：`.` 床 / `#` 壁
   * 飾り（通れない）：`x` 木箱 / `b` ベンチ / `p` 植木
   * 調べられる物：`C` 大時計 / `P` 肖像画 / `D` 机の手帳 / `M` 奇妙な装置
   * 人物：`G` 警備員 / `K` 学芸員（席を外している間は床になる）
   * 出入口：`l` ロビー / `g` 展示室 / `o` 学芸員室 / `S` 地下倉庫（暗証番号つき）
   */
  map: string[]
}

export const ROOMS: Record<RoomId, Room> = {
  lobby: {
    name: 'ロビー',
    map: [
      '#####S#####',
      '#C.......p#',
      '#.........#',
      '#...G.....#',
      '#.........g',
      '#p........#',
      '###########',
    ],
  },
  gallery: {
    name: '展示室',
    map: [
      '#####P#####',
      '#p.......p#',
      '#.........#',
      '#..b...b..#',
      'l.........o',
      '#.........#',
      '###########',
    ],
  },
  office: {
    name: '学芸員室',
    map: [
      '#########',
      '#x.K.D.x#',
      '#.......#',
      'g.......#',
      '#.......#',
      '#########',
    ],
  },
  storage: {
    name: '地下倉庫',
    map: [
      '#########',
      '#x..M..x#',
      '#.......#',
      '#x.....x#',
      '#.......#',
      '####l####',
    ],
  },
}

/** ゲーム開始時の立ち位置（ロビー） */
export const START_POS = { x: 5, y: 5 }

export const TARGET_TILES: Record<string, TargetId> = {
  C: 'clock',
  P: 'painting',
  D: 'desk',
  M: 'device',
}

export const NPC_TILES: Record<string, NpcId> = {
  G: 'guard',
  K: 'curator',
}

export const DOOR_TILES: Record<string, RoomId> = {
  l: 'lobby',
  g: 'gallery',
  o: 'office',
  S: 'storage',
}

/** 調べても時間が進まない飾り */
export const DECOR_TEXT: Record<string, string> = {
  x: '古い木箱が積まれている。',
  b: '来館者用のベンチだ。',
  p: 'よく手入れされた観葉植物だ。',
}

export const TARGET_NAMES: Record<TargetId, string> = {
  clock: '大時計',
  storageDoor: '地下倉庫の扉',
  painting: '肖像画',
  desk: '机の手帳',
  device: '奇妙な装置',
}

export const NPC_NAMES: Record<NpcId, string> = {
  guard: '警備員',
  curator: '学芸員',
}

export interface Clue {
  title: string
  text: string
}

/** メモ帳に残る「知識」。ループしても消えない。 */
export const CLUES: Record<ClueId, Clue> = {
  explosion: {
    title: '15:05の爆発',
    text: '15:05になると地下倉庫の方で爆発が起き、14:50のロビーに戻される。',
  },
  guardCode: {
    title: '倉庫の番号',
    text: '地下倉庫の扉の暗証番号は、学芸員しか知らないらしい。',
  },
  curatorBreak: {
    title: '学芸員の習慣',
    text: '学芸員は毎日きっかり15:00に席を立ち、数分で戻ってくる。',
  },
  paintingYear: {
    title: '《午後三時の肖像》',
    text: '展示室の肖像画。プレートには「1887年」と書かれている。',
  },
  notebook: {
    title: '学芸員の手帳',
    text: '「倉庫の番号は、《午後三時の肖像》が描かれた年」',
  },
  device: {
    title: '時計仕掛けの装置',
    text: '4桁の入力盤があり、「はじまりの刻を刻め」と彫られている。',
  },
  clock: {
    title: 'ロビーの大時計',
    text: '目を覚ますと、大時計はいつも14:50を指している。',
  },
}

export const CLUE_ORDER: ClueId[] = [
  'explosion',
  'clock',
  'guardCode',
  'curatorBreak',
  'paintingYear',
  'notebook',
  'device',
]
