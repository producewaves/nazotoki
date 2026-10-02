import {
  CURATOR_AWAY_FROM,
  CURATOR_AWAY_UNTIL,
  DECOR_TEXT,
  DEVICE_CODE,
  DOOR_TILES,
  EXPLOSION_TIME,
  LOOP_START,
  NPC_NAMES,
  NPC_TILES,
  ROOMS,
  START_POS,
  STORAGE_CODE,
  TARGET_NAMES,
  TARGET_TILES,
  type ClueId,
  type CodeTarget,
  type NpcId,
  type RoomId,
  type TargetId,
} from './scenario'

export type LogKind = 'narration' | 'speech' | 'system'

export interface LogEntry {
  kind: LogKind
  text: string
}

export type Status = 'playing' | 'exploded' | 'cleared'

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Pos {
  x: number
  y: number
}

export interface GameState {
  /** 何周目か（1始まり） */
  loop: number
  time: number
  room: RoomId
  pos: Pos
  facing: Dir
  status: Status
  /** このループ中だけ有効：倉庫の扉を開けたか */
  storageUnlocked: boolean
  /** 暗証番号の入力画面を開いている対象 */
  prompt: CodeTarget | null
  /** ループをまたいで残る知識 */
  clues: ClueId[]
  /** このループ中の出来事 */
  log: LogEntry[]
}

export type Action =
  | { type: 'step'; dir: Dir }
  | { type: 'interact' }
  | { type: 'wait'; minutes: number }
  | { type: 'enterCode'; target: CodeTarget; code: string }
  | { type: 'closePrompt' }
  | { type: 'wake' }
  | { type: 'restart' }

const narration = (text: string): LogEntry => ({ kind: 'narration', text })
const speech = (text: string): LogEntry => ({ kind: 'speech', text })
const system = (text: string): LogEntry => ({ kind: 'system', text })

const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const isCuratorAway = (time: number) =>
  time >= CURATOR_AWAY_FROM && time < CURATOR_AWAY_UNTIL

/** マスの中身。学芸員が席を外している間、そのマスは床として扱う */
export type Tile =
  | { kind: 'floor' }
  | { kind: 'wall' }
  | { kind: 'decor'; text: string }
  | { kind: 'target'; target: TargetId }
  | { kind: 'npc'; npc: NpcId }
  | { kind: 'door'; to: RoomId }

export const tileAt = (state: GameState, room: RoomId, { x, y }: Pos): Tile => {
  const ch = ROOMS[room].map[y]?.[x]
  if (ch === undefined || ch === '#') return { kind: 'wall' }
  if (ch in DOOR_TILES) return { kind: 'door', to: DOOR_TILES[ch] }
  if (ch in TARGET_TILES) return { kind: 'target', target: TARGET_TILES[ch] }
  if (ch in NPC_TILES) {
    const npc = NPC_TILES[ch]
    if (npc === 'curator' && isCuratorAway(state.time)) return { kind: 'floor' }
    return { kind: 'npc', npc }
  }
  if (ch in DECOR_TEXT) return { kind: 'decor', text: DECOR_TEXT[ch] }
  return { kind: 'floor' }
}

const ahead = ({ pos, facing }: GameState): Pos => ({
  x: pos.x + DELTA[facing].x,
  y: pos.y + DELTA[facing].y,
})

export const facingTile = (state: GameState): Tile => tileAt(state, state.room, ahead(state))

/** 目の前にあるものの名前（「調べる」ボタンの表示用） */
export const facingLabel = (state: GameState): string | null => {
  const tile = facingTile(state)
  switch (tile.kind) {
    case 'target':
      return TARGET_NAMES[tile.target]
    case 'npc':
      return NPC_NAMES[tile.npc]
    case 'door':
      return tile.to === 'storage' ? TARGET_NAMES.storageDoor : `${ROOMS[tile.to].name}への出口`
    case 'decor':
      return '飾り'
    default:
      return null
  }
}

const findTile = (room: RoomId, match: (ch: string) => boolean): Pos | null => {
  const map = ROOMS[room].map
  for (let y = 0; y < map.length; y++) {
    const x = [...map[y]].findIndex(match)
    if (x >= 0) return { x, y }
  }
  return null
}

/** `from` の部屋から `to` の部屋に入ったときの立ち位置と向き */
const entrance = (to: RoomId, from: RoomId): { pos: Pos; facing: Dir } => {
  const door = findTile(to, (ch) => DOOR_TILES[ch] === from)
  if (!door) return { pos: START_POS, facing: 'up' }
  const map = ROOMS[to].map
  for (const dir of ['up', 'down', 'left', 'right'] as Dir[]) {
    const pos = { x: door.x + DELTA[dir].x, y: door.y + DELTA[dir].y }
    if (map[pos.y]?.[pos.x] === '.') return { pos, facing: dir }
  }
  return { pos: START_POS, facing: 'up' }
}

const loopStartLog = (loop: number): LogEntry[] =>
  loop === 1
    ? [
        narration('閉館間際の美術館。ロビーの大時計は14:50を指している。'),
        narration('なんとなく、嫌な予感がする。'),
        system('矢印キーかボタンで歩き、気になるものの前で「調べる」。'),
      ]
    : [
        narration('……はっと目を覚ますと、またロビーに立っていた。'),
        narration('大時計は14:50を指している。'),
        system(`ループ ${loop} 周目`),
      ]

export const startLoop = (loop: number, clues: ClueId[]): GameState => ({
  loop,
  time: LOOP_START,
  room: 'lobby',
  pos: START_POS,
  facing: 'up',
  status: 'playing',
  storageUnlocked: false,
  prompt: null,
  clues,
  log: loopStartLog(loop),
})

export const initialState = (): GameState => startLoop(1, [])

const addClue = (clues: ClueId[], clue: ClueId): ClueId[] =>
  clues.includes(clue) ? clues : [...clues, clue]

interface Outcome {
  log: LogEntry[]
  clues?: ClueId[]
  patch?: Partial<GameState>
}

const examine = (state: GameState, target: TargetId): Outcome => {
  switch (target) {
    case 'clock':
      if (state.loop === 1) {
        return { log: [narration('立派な振り子時計。14時50分を少し過ぎたところだ。')] }
      }
      return {
        log: [narration('振り子時計。目を覚ますと、針はいつも14:50を指している。ここが「はじまり」らしい。')],
        clues: ['clock'],
      }
    case 'storageDoor':
      return {
        log: [narration('重い鉄の扉。4桁の暗証番号を入力するテンキーが付いている。')],
      }
    case 'painting':
      return {
        log: [
          narration('穏やかに微笑む婦人の肖像画。背景の時計は3時を指している。'),
          narration('プレートには「《午後三時の肖像》 1887年」とある。'),
        ],
        clues: ['paintingYear'],
      }
    case 'desk':
      if (!isCuratorAway(state.time)) {
        return { log: [speech('学芸員「ちょっと、勝手に触らないでください！」')] }
      }
      return {
        log: [
          narration('学芸員がいない隙に手帳を開いた。'),
          narration('「倉庫の番号は、《午後三時の肖像》が描かれた年」と走り書きがある。'),
        ],
        clues: ['notebook'],
      }
    case 'device':
      return {
        log: [
          narration('真鍮の歯車が組み合わさった装置。針は15:05に向かって進んでいる。'),
          narration('4桁の入力盤があり、「はじまりの刻を刻め」と彫られている。'),
        ],
        clues: ['device'],
        patch: { prompt: 'device' },
      }
  }
}

const talk = (state: GameState, npc: NpcId): Outcome => {
  if (npc === 'guard') {
    return {
      log: [
        speech('警備員「地下倉庫？ あそこの番号は学芸員さんしか知らないよ」'),
        speech('警備員「あの人は几帳面でね。毎日きっかり15時にお手洗いに立つんだ」'),
      ],
      clues: ['guardCode', 'curatorBreak'],
    }
  }
  if (state.clues.includes('device')) {
    return {
      log: [
        speech('学芸員「……地下の装置を見たのね。あれは祖父の形見なの」'),
        speech('学芸員「止め方？ 祖父はいつも『はじまりに戻れば終わる』と言っていたわ」'),
      ],
    }
  }
  return {
    log: [speech('学芸員「閉館前で忙しいの。倉庫の番号？ 教えられません」')],
  }
}

const enterCode = (target: CodeTarget, code: string): Outcome => {
  if (target === 'storageDoor') {
    if (code === STORAGE_CODE) {
      return {
        log: [narration('カチリ、と音がして扉の鍵が開いた。')],
        patch: { storageUnlocked: true, prompt: null },
      }
    }
    return { log: [narration(`「${code}」……ブザーが鳴った。違うようだ。`)] }
  }
  if (code === DEVICE_CODE) {
    return {
      log: [
        narration('入力盤に「1450」を刻むと、歯車がゆっくりと止まった。'),
        narration('カチ、カチ……時計の音が消え、静寂が訪れる。'),
      ],
      patch: { status: 'cleared', prompt: null },
    }
  }
  return { log: [narration(`「${code}」……装置は何も反応しない。`)] }
}

const explode = (state: GameState): GameState => ({
  ...state,
  status: 'exploded',
  prompt: null,
  clues: addClue(state.clues, 'explosion'),
  log: [
    ...state.log,
    state.room === 'storage'
      ? narration('15:05。目の前の装置がまばゆい光を放った――')
      : narration('15:05。地下の方から轟音と閃光が――'),
  ],
})

/** 時間を進める行動の結果を反映し、15:05になったら爆発させる */
const advance = (state: GameState, outcome: Outcome, minutes = 1): GameState => {
  const clues = (outcome.clues ?? []).reduce(addClue, state.clues)
  const next: GameState = {
    ...state,
    ...outcome.patch,
    time: state.time + minutes,
    clues,
    log: [...state.log, ...outcome.log],
  }
  if (next.status === 'playing' && next.time >= EXPLOSION_TIME) return explode(next)
  return next
}

/** 時間の進まない出来事（飾りを見る、鍵のかかった扉に触れるなど） */
const note = (state: GameState, log: LogEntry[], patch: Partial<GameState> = {}): GameState => ({
  ...state,
  ...patch,
  log: [...state.log, ...log],
})

/** 扉を通る。地下倉庫は鍵が開くまで暗証番号の入力画面を出す */
const passDoor = (state: GameState, to: RoomId): GameState => {
  if (to === 'storage' && !state.storageUnlocked) {
    return note(state, examine(state, 'storageDoor').log, { prompt: 'storageDoor' })
  }
  const { pos, facing } = entrance(to, state.room)
  return advance({ ...state, room: to, pos, facing }, { log: [system(`${ROOMS[to].name}へ移動した`)] })
}

const interact = (state: GameState): GameState => {
  const tile = facingTile(state)
  switch (tile.kind) {
    case 'target':
      return advance(state, examine(state, tile.target))
    case 'npc':
      return advance(state, talk(state, tile.npc))
    case 'door':
      return passDoor(state, tile.to)
    case 'decor':
      return note(state, [narration(tile.text)])
    default:
      return state
  }
}

const step = (state: GameState, dir: Dir): GameState => {
  const turned = { ...state, facing: dir }
  const tile = facingTile(turned)
  if (tile.kind === 'floor') return { ...turned, pos: ahead(turned) }
  if (tile.kind === 'door') return passDoor(turned, tile.to)
  return turned
}

export const reducer = (state: GameState, action: Action): GameState => {
  if (action.type === 'restart') return initialState()
  if (action.type === 'wake') {
    return state.status === 'exploded' ? startLoop(state.loop + 1, state.clues) : state
  }
  if (state.status !== 'playing') return state
  if (action.type === 'closePrompt') return { ...state, prompt: null }
  if (state.prompt && action.type !== 'enterCode') return state

  switch (action.type) {
    case 'step':
      return step(state, action.dir)
    case 'interact':
      return interact(state)
    case 'wait': {
      const minutes = Math.max(1, Math.floor(action.minutes))
      return advance(state, { log: [system(`${minutes}分待った`)] }, minutes)
    }
    case 'enterCode':
      if (state.prompt !== action.target) return state
      return advance(state, enterCode(action.target, action.code))
  }
}
