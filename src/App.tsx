import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { exitsFrom, initialState, npcsIn, reducer, type GameState } from './game/engine'
import {
  CLUES,
  CLUE_ORDER,
  EXPLOSION_TIME,
  NPC_NAMES,
  ROOMS,
  TARGET_NAMES,
  formatTime,
  type CodeTarget,
} from './game/scenario'

const STORAGE_KEY = 'nazotoki:save:v1'

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

function CodePad({ label, onSubmit }: { label: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 4) return
    onSubmit(code)
    setCode('')
  }
  return (
    <form className="codepad" onSubmit={submit}>
      <label>
        {label}
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="0000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </label>
      <button type="submit" disabled={code.length !== 4}>
        入力（1分）
      </button>
    </form>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const logEnd = useRef<HTMLDivElement>(null)

  useEffect(() => save(state), [state])
  useEffect(() => logEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [state.log])

  const room = ROOMS[state.room]
  const playing = state.status === 'playing'
  const remaining = EXPLOSION_TIME - state.time
  const npcs = npcsIn(state)
  const codeTarget: CodeTarget | null =
    state.room === 'lobby' && !state.storageUnlocked
      ? 'storageDoor'
      : state.room === 'storage'
        ? 'device'
        : null

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
          <div className="room">
            <h2>{room.name}</h2>
            <p>{room.description}</p>
          </div>

          <div className="log" aria-live="polite">
            {state.log.map((entry, i) => (
              <p key={i} className={`log-${entry.kind}`}>
                {entry.text}
              </p>
            ))}
            <div ref={logEnd} />
          </div>

          <div className="actions">
            <div className="group">
              <h3>調べる</h3>
              {room.targets.map((target) => (
                <button
                  key={target}
                  disabled={!playing}
                  onClick={() => dispatch({ type: 'examine', target })}
                >
                  {TARGET_NAMES[target]}
                </button>
              ))}
            </div>

            {npcs.length > 0 && (
              <div className="group">
                <h3>話す</h3>
                {npcs.map((npc) => (
                  <button key={npc} disabled={!playing} onClick={() => dispatch({ type: 'talk', npc })}>
                    {NPC_NAMES[npc]}
                  </button>
                ))}
              </div>
            )}

            <div className="group">
              <h3>移動</h3>
              {exitsFrom(state).map((to) => (
                <button key={to} disabled={!playing} onClick={() => dispatch({ type: 'move', to })}>
                  {ROOMS[to].name}へ
                </button>
              ))}
            </div>

            <div className="group">
              <h3>待つ</h3>
              <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 1 })}>
                1分
              </button>
              <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 5 })}>
                5分
              </button>
            </div>

            {codeTarget && playing && (
              <CodePad
                key={codeTarget}
                label={codeTarget === 'storageDoor' ? '扉の暗証番号' : '装置の入力盤'}
                onSubmit={(code) => dispatch({ type: 'enterCode', target: codeTarget, code })}
              />
            )}
          </div>
          <p className="hint">行動するたびに1分たちます。</p>
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

      {state.status === 'exploded' && (
        <div className="overlay flash" role="dialog" aria-modal="true">
          <div className="dialog">
            <p className="big">ドォン――</p>
            <p>視界が真っ白に染まっていく。</p>
            <p>……でも、覚えていることがある。</p>
            <button autoFocus onClick={() => dispatch({ type: 'wake' })}>
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
            <button autoFocus onClick={() => dispatch({ type: 'restart' })}>
              もう一度遊ぶ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
