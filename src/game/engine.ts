import {
  COST,
  DECOR_TEXT,
  DEVICE_CODE,
  EXPLOSION_TIME,
  LOOP_START,
  MAP,
  NPC_NAMES,
  SCHEDULES,
  START_POS,
  TARGET_NAMES,
  TARGET_TILES,
  VAULT_CODE,
  ZONES,
  zoneAt,
  type ClueId,
  type CodeTarget,
  type NpcId,
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
  /** その日の0時からの秒 */
  time: number
  pos: Pos
  facing: Dir
  status: Status
  /** ここから下の3つはループごとにリセットされる */
  vaultUnlocked: boolean
  hasKey: boolean
  caseOpen: boolean
  /** 暗証番号の入力画面を開いている対象 */
  prompt: CodeTarget | null
  /** ループをまたいで残る記憶 */
  clues: ClueId[]
  /** このループ中の出来事 */
  log: LogEntry[]
  /** 最後の行動で増えた出来事が log の何番目から始まるか */
  mark: number
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

export const DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** その時刻に人物がいるマス（館内にいなければ null） */
export const npcPos = (npc: NpcId, time: number): Pos | null => {
  let pos: Pos | null = null
  for (const stop of SCHEDULES[npc]) {
    if (time >= stop.from) pos = stop.pos
  }
  return pos
}

const npcAt = (time: number, { x, y }: Pos): NpcId | null => {
  for (const npc of Object.keys(SCHEDULES) as NpcId[]) {
    const p = npcPos(npc, time)
    if (p && p.x === x && p.y === y) return npc
  }
  return null
}

const guardInLobby = (time: number) => {
  const p = npcPos('guard', time)
  return p !== null && zoneAt(p.x, p.y) === 'lobby'
}

/** マスの中身 */
export type Tile =
  | { kind: 'floor' }
  | { kind: 'wall' }
  | { kind: 'decor'; text: string }
  | { kind: 'target'; target: TargetId }
  | { kind: 'npc'; npc: NpcId }
  | { kind: 'vaultDoor' }

export const tileAt = (state: GameState, pos: Pos): Tile => {
  const npc = npcAt(state.time, pos)
  if (npc) return { kind: 'npc', npc }
  const ch = MAP[pos.y]?.[pos.x]
  if (ch === undefined || ch === '#') return { kind: 'wall' }
  if (ch === 'V') return state.vaultUnlocked ? { kind: 'floor' } : { kind: 'vaultDoor' }
  if (ch in TARGET_TILES) return { kind: 'target', target: TARGET_TILES[ch] }
  if (ch in DECOR_TEXT) return { kind: 'decor', text: DECOR_TEXT[ch] }
  return { kind: 'floor' }
}

export const ahead = ({ pos, facing }: { pos: Pos; facing: Dir }): Pos => ({
  x: pos.x + DELTA[facing].x,
  y: pos.y + DELTA[facing].y,
})

export const facingTile = (state: GameState): Tile => tileAt(state, ahead(state))

/** 目の前にあるものの名前（「調べる」ボタンの表示用） */
export const facingLabel = (state: GameState): string | null => {
  const tile = facingTile(state)
  switch (tile.kind) {
    case 'target':
      return TARGET_NAMES[tile.target]
    case 'npc':
      return NPC_NAMES[tile.npc]
    case 'vaultDoor':
      return '鉄の扉'
    case 'decor':
      return '……'
    default:
      return null
  }
}

/** 今いる場所の名前 */
export const placeName = (state: GameState): string => {
  const zone = zoneAt(state.pos.x, state.pos.y)
  return zone ? ZONES[zone].name : ''
}

/** その方向に1歩進めるか */
export const canStep = (state: GameState, dir: Dir): boolean =>
  tileAt(state, ahead({ pos: state.pos, facing: dir })).kind === 'floor'

const loopStartLog = (loop: number): LogEntry[] =>
  loop === 1
    ? [narration('閉館間際の美術館。'), narration('大時計が、二時五十分を指している。')]
    : [narration('……また、二時五十分。')]

export const startLoop = (loop: number, clues: ClueId[]): GameState => ({
  loop,
  time: LOOP_START,
  pos: START_POS,
  facing: 'up',
  status: 'playing',
  vaultUnlocked: false,
  hasKey: false,
  caseOpen: false,
  prompt: null,
  clues,
  log: loopStartLog(loop),
  mark: 0,
})

export const initialState = (): GameState => startLoop(1, [])

/** 出来事を書き足し、テキスト欄に出す範囲を更新する */
const withLog = (state: GameState, entries: LogEntry[]): GameState =>
  entries.length ? { ...state, log: [...state.log, ...entries], mark: state.log.length } : state

const addClue = (clues: ClueId[], clue: ClueId): ClueId[] =>
  clues.includes(clue) ? clues : [...clues, clue]

interface Outcome {
  log: LogEntry[]
  clues?: ClueId[]
  patch?: Partial<GameState>
  /** かかる時間（秒） */
  cost: number
}

const examine = (state: GameState, target: TargetId): Outcome => {
  const cost = COST.examine
  switch (target) {
    case 'clock':
      if (state.loop === 1) return { cost, log: [narration('振り子が、重たく揺れている。')] }
      return {
        cost,
        log: [narration('振り子が揺れている。目覚めるたび、この針は二時五十分だった。')],
        clues: ['clock'],
      }
    case 'portrait':
      return {
        cost,
        log: [narration('微笑む婦人。背景の時計は三時を指している。'), narration('《午後三時の肖像》 1887年')],
        clues: ['paintingYear'],
      }
    case 'harbor':
      return { cost, log: [narration('夕暮れの港。船は一隻も出ていない。')] }
    case 'sketch':
      return { cost, log: [narration('誰かの横顔の素描。題名はない。')] }
    case 'desk':
      if (npcPos('curator', state.time)) {
        return { cost, log: [speech('学芸員「そこ、触らないでください」')] }
      }
      return {
        cost,
        log: [narration('開いたままの手帳。'), narration('「収蔵庫 ― 肖像の生まれ年」')],
        clues: ['notebook'],
      }
    case 'counter':
      if (state.hasKey) return { cost, log: [narration('空の引き出し。')] }
      if (guardInLobby(state.time)) {
        return { cost, log: [speech('警備員「おっと、そこは駄目だよ」')] }
      }
      return {
        cost,
        log: [narration('引き出しの奥に、小さな真鍮の鍵。')],
        clues: ['drawerKey'],
        patch: { hasKey: true },
      }
    case 'device':
      if (state.caseOpen) {
        return { cost, log: [narration('溝が四つ。「はじまりへ」')], clues: ['dial'], patch: { prompt: 'device' } }
      }
      if (state.hasKey) {
        return {
          cost,
          log: [narration('鍵を回すと、ケースが開いた。'), narration('歯車の下に、数字を刻む溝が四つ。「はじまりへ」')],
          clues: ['device', 'dial'],
          patch: { caseOpen: true, prompt: 'device' },
        }
      }
      return {
        cost,
        log: [narration('ガラスの中で、歯車が回っている。'), narration('ケースの隅に小さな鍵穴。')],
        clues: ['device'],
      }
    case 'entrance':
      return { cost, log: [narration('鍵がかかっている。外は、やけに静かだ。')] }
  }
}

const talk = (state: GameState, npc: NpcId): Outcome => {
  const cost = COST.talk
  if (npc === 'guard') {
    if (!guardInLobby(state.time)) {
      return { cost, log: [speech('警備員「見回りさ。三分もすれば戻るよ」')], clues: ['guardPatrol'] }
    }
    if (state.clues.includes('device') && !state.clues.includes('drawerKey')) {
      return {
        cost,
        log: [speech('警備員「ガラスケース？ 鍵なら受付の引き出しだが……渡せないね」')],
        clues: ['drawerKey'],
      }
    }
    return {
      cost,
      log: [
        speech('警備員「もうすぐ閉館だよ。収蔵庫？ 番号なら学芸員さんだ」'),
        speech('警備員「あの人、三時になると必ず席を立つ。時計みたいにね」'),
      ],
      clues: ['guardCode', 'curatorBreak'],
    }
  }
  if (state.clues.includes('device')) {
    return {
      cost,
      log: [
        speech('学芸員「……あの装置を見たのね。祖父の形見なの」'),
        speech('学芸員「口癖があったわ。『終わらせたいなら、はじまりに戻れ』」'),
      ],
      clues: ['curatorHint'],
    }
  }
  return { cost, log: [speech('学芸員「閉館前で忙しいの。ごめんなさいね」')] }
}

const enterCode = (target: CodeTarget, code: string): Outcome => {
  const cost = COST.code
  if (target === 'vaultDoor') {
    if (code === VAULT_CODE) {
      return { cost, log: [narration('カチリ。鉄の扉が開いた。')], patch: { vaultUnlocked: true, prompt: null } }
    }
    return { cost, log: [narration('ブザーが短く鳴った。')] }
  }
  if (code === DEVICE_CODE) {
    return {
      cost,
      log: [narration('「1450」'), narration('歯車が、ゆっくりと止まった。')],
      patch: { status: 'cleared', prompt: null },
    }
  }
  return { cost, log: [narration('何も起こらない。')] }
}

const explode = (state: GameState): GameState => ({
  ...state,
  time: EXPLOSION_TIME,
  status: 'exploded',
  prompt: null,
  clues: addClue(state.clues, 'explosion'),
  log: [...state.log, narration('――光。')],
  mark: state.log.length,
})

/** 時間を進め、15:05になったら爆発させる */
const advance = (state: GameState, outcome: Outcome): GameState => {
  const clues = (outcome.clues ?? []).reduce(addClue, state.clues)
  const next = withLog({ ...state, ...outcome.patch, time: state.time + outcome.cost, clues }, outcome.log)
  if (next.status === 'playing' && next.time >= EXPLOSION_TIME) return explode(next)
  return next
}

const interact = (state: GameState): GameState => {
  const tile = facingTile(state)
  switch (tile.kind) {
    case 'target':
      return advance(state, examine(state, tile.target))
    case 'npc':
      return advance(state, talk(state, tile.npc))
    case 'vaultDoor':
      return withLog({ ...state, prompt: 'vaultDoor' }, [narration('冷たい鉄の扉。四桁のテンキー。')])
    case 'decor':
      return withLog(state, [narration(tile.text)])
    default:
      return state
  }
}

const step = (state: GameState, dir: Dir): GameState => {
  const turned = { ...state, facing: dir }
  const tile = facingTile(turned)
  if (tile.kind === 'floor') return advance({ ...turned, pos: ahead(turned) }, { log: [], cost: COST.step })
  if (tile.kind === 'vaultDoor') return interact(turned)
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
      return advance(state, { log: [], cost: minutes * 60 })
    }
    case 'enterCode':
      if (state.prompt !== action.target) return state
      return advance(state, enterCode(action.target, action.code))
  }
}
