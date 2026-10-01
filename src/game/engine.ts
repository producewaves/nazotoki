import {
  CURATOR_AWAY_FROM,
  CURATOR_AWAY_UNTIL,
  DEVICE_CODE,
  EXPLOSION_TIME,
  LOOP_START,
  ROOMS,
  STORAGE_CODE,
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

export interface GameState {
  /** 何周目か（1始まり） */
  loop: number
  time: number
  room: RoomId
  status: Status
  /** このループ中だけ有効：倉庫の扉を開けたか */
  storageUnlocked: boolean
  /** ループをまたいで残る知識 */
  clues: ClueId[]
  /** このループ中の出来事 */
  log: LogEntry[]
}

export type Action =
  | { type: 'move'; to: RoomId }
  | { type: 'examine'; target: TargetId }
  | { type: 'talk'; npc: NpcId }
  | { type: 'wait'; minutes: number }
  | { type: 'enterCode'; target: CodeTarget; code: string }
  | { type: 'wake' }
  | { type: 'restart' }

const narration = (text: string): LogEntry => ({ kind: 'narration', text })
const speech = (text: string): LogEntry => ({ kind: 'speech', text })
const system = (text: string): LogEntry => ({ kind: 'system', text })

export const isCuratorAway = (time: number) =>
  time >= CURATOR_AWAY_FROM && time < CURATOR_AWAY_UNTIL

/** 今いる部屋で話しかけられる人 */
export const npcsIn = (state: GameState): NpcId[] => {
  if (state.room === 'lobby') return ['guard']
  if (state.room === 'office' && !isCuratorAway(state.time)) return ['curator']
  return []
}

/** 今いる部屋から移動できる部屋 */
export const exitsFrom = (state: GameState): RoomId[] =>
  ROOMS[state.room].exits.filter((to) => to !== 'storage' || state.storageUnlocked)

const loopStartLog = (loop: number): LogEntry[] =>
  loop === 1
    ? [
        narration('閉館間際の美術館。ロビーの大時計は14:50を指している。'),
        narration('なんとなく、嫌な予感がする。'),
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
  status: 'playing',
  storageUnlocked: false,
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
        patch: { storageUnlocked: true },
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
      patch: { status: 'cleared' },
    }
  }
  return { log: [narration(`「${code}」……装置は何も反応しない。`)] }
}

const explode = (state: GameState): GameState => ({
  ...state,
  status: 'exploded',
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

export const reducer = (state: GameState, action: Action): GameState => {
  if (action.type === 'restart') return initialState()
  if (action.type === 'wake') {
    return state.status === 'exploded' ? startLoop(state.loop + 1, state.clues) : state
  }
  if (state.status !== 'playing') return state

  switch (action.type) {
    case 'move': {
      if (!exitsFrom(state).includes(action.to)) return state
      const moved = { ...state, room: action.to }
      return advance(moved, { log: [system(`${ROOMS[action.to].name}へ移動した`)] })
    }
    case 'examine':
      if (!ROOMS[state.room].targets.includes(action.target)) return state
      return advance(state, examine(state, action.target))
    case 'talk':
      if (!npcsIn(state).includes(action.npc)) return state
      return advance(state, talk(state, action.npc))
    case 'wait': {
      const minutes = Math.max(1, Math.floor(action.minutes))
      return advance(state, { log: [system(`${minutes}分待った`)] }, minutes)
    }
    case 'enterCode': {
      const where: RoomId = action.target === 'storageDoor' ? 'lobby' : 'storage'
      if (state.room !== where) return state
      if (action.target === 'storageDoor' && state.storageUnlocked) return state
      return advance(state, enterCode(action.target, action.code))
    }
  }
}
