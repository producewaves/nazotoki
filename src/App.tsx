import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  facingLabel,
  initialState,
  isCuratorAway,
  reducer,
  type Action,
  type Dir,
  type GameState,
} from './game/engine'
import { CLUES, CLUE_ORDER, EXPLOSION_TIME, ROOMS, formatTime } from './game/scenario'

const STORAGE_KEY = 'nazotoki:save:v2'

const load = (): GameState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as GameState
  } catch {
    // 保存データが読めないときは最初から
  }
  return initialState()
}

const save = (state: GameState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

const INTERACT_KEYS = new Set([' ', 'Enter', 'z', 'Z'])

/** マップの文字ごとの見た目 */
const TILE_ICON: Record<string, string> = {
  C: '🕰️',
  P: '🖼️',
  D: '📔',
  M: '⚙️',
  G: '👮',
  K: '👩',
  x: '📦',
  b: '🪑',
  p: '🪴',
  S: '🚪',
}

const tileClass = (ch: string) => {
  if (ch === '#') return 'wall'
  if (ch === 'S') return 'door locked'
  if ('lgo'.includes(ch)) return 'door'
  if (ch === 'D') return 'floor desk'
  if (ch === 'P') return 'wall'
  return 'floor'
}

function RoomMap({ state }: { state: GameState }) {
  const map = ROOMS[state.room].map
  const width = map[0].length
  const curatorAway = isCuratorAway(state.time)
  const front = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  }[state.facing]
  const fx = state.pos.x + front[0]
  const fy = state.pos.y + front[1]

  return (
    <div className="map" style={{ '--cols': width } as CSSProperties}>
      {map.flatMap((row, y) =>
        [...row].map((raw, x) => {
          const ch = raw === 'S' && state.storageUnlocked ? 'open' : raw
          const hidden = raw === 'K' && curatorAway
          const isPlayer = state.pos.x === x && state.pos.y === y
          const isFront = fx === x && fy === y && facingLabel(state) !== null
          const icon = hidden || ch === 'open' ? '' : TILE_ICON[raw]
          return (
            <div
              key={`${x}-${y}`}
              className={`tile ${ch === 'open' ? 'door' : tileClass(raw)} ${isFront ? 'front' : ''}`}
            >
              {isPlayer ? (
                <span className={`player face-${state.facing}`}>🧑</span>
              ) : (
                icon && <span className="icon">{icon}</span>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}

function CodePad({
  label,
  onSubmit,
  onClose,
}: {
  label: string
  onSubmit: (code: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 4) return
    onSubmit(code)
    setCode('')
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="dialog codepad" onSubmit={submit}>
        <p className="big">{label}</p>
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="0000"
          aria-label="4桁の番号"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <div className="row">
          <button type="button" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="primary" disabled={code.length !== 4}>
            入力（1分）
          </button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const messages = useRef<HTMLDivElement>(null)

  useEffect(() => {
    save(state)
  }, [state])

  // ページ全体は動かさず、メッセージ欄の中だけを最新までスクロールする
  useLayoutEffect(() => {
    const box = messages.current
    if (box) box.scrollTop = box.scrollHeight
  }, [state.log])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.status !== 'playing' || state.prompt) return
      if (e.target instanceof HTMLInputElement) return
      const dir = KEY_DIRS[e.key]
      let action: Action | null = null
      if (dir) action = { type: 'step', dir }
      else if (INTERACT_KEYS.has(e.key)) action = { type: 'interact' }
      if (!action) return
      e.preventDefault()
      dispatch(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.status, state.prompt])

  const playing = state.status === 'playing' && !state.prompt
  const remaining = EXPLOSION_TIME - state.time
  const label = facingLabel(state)
  const recent = state.log.slice(-40)

  const restart = () => {
    if (confirm('メモ帳も含めて最初からやり直しますか？')) dispatch({ type: 'restart' })
  }

  return (
    <div className="app">
      <header className="hud">
        <h1>午後3時の美術館</h1>
        <div className="hud-stats">
          <span className="loop">ループ {state.loop}</span>
          <span className={`clock ${remaining <= 3 ? 'danger' : ''}`}>{formatTime(state.time)}</span>
        </div>
      </header>

      <main className="layout">
        <section className="scene">
          <div className="room-name">{ROOMS[state.room].name}</div>
          <RoomMap state={state} />

          <div className="messages" ref={messages} aria-live="polite">
            {recent.map((entry, i) => (
              <p key={state.log.length - recent.length + i} className={`log-${entry.kind}`}>
                {entry.text}
              </p>
            ))}
          </div>

          <div className="controls">
            <div className="dpad" aria-label="移動">
              <button className="up" aria-label="上" disabled={!playing} onClick={() => dispatch({ type: 'step', dir: 'up' })}>
                ▲
              </button>
              <button className="left" aria-label="左" disabled={!playing} onClick={() => dispatch({ type: 'step', dir: 'left' })}>
                ◀
              </button>
              <button className="right" aria-label="右" disabled={!playing} onClick={() => dispatch({ type: 'step', dir: 'right' })}>
                ▶
              </button>
              <button className="down" aria-label="下" disabled={!playing} onClick={() => dispatch({ type: 'step', dir: 'down' })}>
                ▼
              </button>
            </div>
            <div className="side-buttons">
              <button
                className="interact primary"
                disabled={!playing || label === null}
                onClick={() => dispatch({ type: 'interact' })}
              >
                調べる
                <small>{label ?? '目の前に何もない'}</small>
              </button>
              <div className="wait">
                <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 1 })}>
                  1分待つ
                </button>
                <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 5 })}>
                  5分待つ
                </button>
              </div>
            </div>
          </div>
          <p className="hint">
            歩くだけなら時間はたちません。調べる・話す・部屋を移る・待つと時間が進みます。
            <span className="keys">（キーボード：矢印キーで移動、スペースで調べる）</span>
          </p>
        </section>

        <aside className="notebook">
          <h2>メモ帳</h2>
          <p className="notebook-sub">ループしても消えない記憶</p>
          {state.clues.length === 0 ? (
            <p className="empty">まだ何もわかっていない。</p>
          ) : (
            <ul>
              {CLUE_ORDER.filter((id) => state.clues.includes(id)).map((id) => (
                <li key={id}>
                  <strong>{CLUES[id].title}</strong>
                  <span>{CLUES[id].text}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="restart" onClick={restart}>
            最初からやり直す
          </button>
        </aside>
      </main>

      {state.prompt && state.status === 'playing' && (
        <CodePad
          key={state.prompt}
          label={state.prompt === 'storageDoor' ? '扉の暗証番号' : '装置の入力盤'}
          onSubmit={(code) => dispatch({ type: 'enterCode', target: state.prompt!, code })}
          onClose={() => dispatch({ type: 'closePrompt' })}
        />
      )}

      {state.status === 'exploded' && (
        <div className="overlay flash" role="dialog" aria-modal="true">
          <div className="dialog">
            <p className="big">ドォン――</p>
            <p>視界が真っ白に染まっていく。</p>
            <p>……でも、覚えていることがある。</p>
            <button className="primary" autoFocus onClick={() => dispatch({ type: 'wake' })}>
              目を覚ます
            </button>
          </div>
        </div>
      )}

      {state.status === 'cleared' && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="dialog">
            <p className="big">ループ脱出！</p>
            <p>やがて大時計は15:05を過ぎ、何事もなく時を刻み続けた。</p>
            <p>
              {state.loop}周目の{formatTime(state.time)}に脱出しました。
            </p>
            <button className="primary" autoFocus onClick={() => dispatch({ type: 'restart' })}>
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
