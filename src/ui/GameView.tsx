import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject } from 'react'
import { ahead, canStep, facingLabel, npcPos, type Action, type Dir, type GameState, type Pos } from '../game/engine'
import { MAP, type NpcId } from '../game/scenario'
import { HEIGHT, LOOKS, WIDTH, drawScene, type Actor } from '../render/scene'
import { pressDir, type Input } from './input'

const PLAYER_SPEED = 7 // マス/秒
const NPC_SPEED = 3.5
const FRAME_TIME = 0.11 // 歩きの1コマの秒数

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

const walkable = (x: number, y: number) => {
  const ch = MAP[y]?.[x]
  return ch === '.' || ch === '+'
}

/** 人物が歩く道順（幅優先探索） */
const findPath = (from: Pos, to: Pos): Pos[] => {
  const key = (p: Pos) => `${p.x},${p.y}`
  const prev = new Map<string, Pos | null>([[key(from), null]])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (cur.x === to.x && cur.y === to.y) {
      const path: Pos[] = []
      for (let p: Pos | null = cur; p && key(p) !== key(from); p = prev.get(key(p)) ?? null) path.unshift(p)
      return path
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: cur.x + dx, y: cur.y + dy }
      if (prev.has(key(next)) || (!walkable(next.x, next.y) && key(next) !== key(to))) continue
      prev.set(key(next), cur)
      queue.push(next)
    }
  }
  return [to]
}

const dirOf = (dx: number, dy: number, fallback: Dir): Dir => {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  if (dy !== 0) return dy > 0 ? 'down' : 'up'
  return fallback
}

interface Walker {
  x: number
  y: number
  dir: Dir
  anim: number
  alpha: number
  path: Pos[]
  target: Pos | null
}

const moveToward = (w: Walker, tx: number, ty: number, dist: number) => {
  const dx = tx - w.x
  const dy = ty - w.y
  const len = Math.hypot(dx, dy)
  if (len <= dist) {
    w.x = tx
    w.y = ty
    return dist - len
  }
  w.x += (dx / len) * dist
  w.y += (dy / len) * dist
  return 0
}

export function GameView({
  state,
  dispatch,
  input,
}: {
  state: GameState
  dispatch: Dispatch<Action>
  input: RefObject<Input>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  // キーボード
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = stateRef.current
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        if (e.repeat) input.current.held = dir
        else pressDir(input.current, dir)
      } else if (INTERACT_KEYS.has(e.key) && !e.repeat) {
        e.preventDefault()
        if (s.status === 'playing' && !s.prompt) dispatch({ type: 'interact' })
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (KEY_DIRS[e.key] === input.current.held) input.current.held = null
    }
    const onBlur = () => {
      input.current.held = null
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [dispatch, input])

  // 画面サイズに合わせて内部解像度を決める
  useEffect(() => {
    const el = canvas.current!
    const resize = () => {
      const scale = Math.max(1, Math.round((el.clientWidth * devicePixelRatio) / WIDTH))
      el.width = WIDTH * scale
      el.height = HEIGHT * scale
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 描画ループ
  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    const s0 = stateRef.current
    const player: Walker = { x: s0.pos.x, y: s0.pos.y, dir: s0.facing, anim: 0, alpha: 1, path: [], target: null }
    const npcs = new Map<NpcId, Walker>()
    for (const id of ['guard', 'curator'] as NpcId[]) {
      const p = npcPos(id, s0.time)
      npcs.set(id, { x: p?.x ?? 0, y: p?.y ?? 0, dir: 'down', anim: 0, alpha: p ? 1 : 0, path: [], target: p })
    }
    let loop = s0.loop
    let waitingFor: GameState | null = null
    let waitingSince = 0
    let raf = 0
    let last = performance.now()
    let t = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      const s = stateRef.current

      // 新しいループに入ったら全員を元の位置へ
      if (s.loop !== loop) {
        loop = s.loop
        player.x = s.pos.x
        player.y = s.pos.y
        for (const [id, n] of npcs) {
          const p = npcPos(id, s.time)
          Object.assign(n, { x: p?.x ?? 0, y: p?.y ?? 0, alpha: p ? 1 : 0, path: [], target: p, dir: 'down' })
        }
      }

      // 主人公
      player.dir = s.facing
      const moving = player.x !== s.pos.x || player.y !== s.pos.y
      if (Math.hypot(s.pos.x - player.x, s.pos.y - player.y) > 1.5) {
        player.x = s.pos.x
        player.y = s.pos.y
      } else if (moving) {
        moveToward(player, s.pos.x, s.pos.y, PLAYER_SPEED * dt)
        player.anim += dt
      }
      const arrived = player.x === s.pos.x && player.y === s.pos.y

      if (waitingFor && (s !== waitingFor || now - waitingSince > 300)) waitingFor = null
      if (arrived && !waitingFor) {
        const inp = input.current
        if (s.status !== 'playing' || s.prompt) {
          inp.queue.length = 0
        } else if (inp.queue.length) {
          const dir = inp.queue.shift()!
          waitingFor = s
          waitingSince = now
          dispatch({ type: 'step', dir })
        } else if (inp.held && canStep(s, inp.held)) {
          waitingFor = s
          waitingSince = now
          dispatch({ type: 'step', dir: inp.held })
        } else {
          player.anim = 0
        }
      }

      // 警備員と学芸員は予定に合わせて歩く
      for (const [id, n] of npcs) {
        const target = npcPos(id, s.time)
        const changed = target?.x !== n.target?.x || target?.y !== n.target?.y
        if (changed) {
          if (target && n.alpha <= 0) {
            Object.assign(n, { x: target.x, y: target.y, path: [] })
          } else if (target) {
            n.path = findPath({ x: Math.round(n.x), y: Math.round(n.y) }, target)
          }
          n.target = target
        }
        let budget = NPC_SPEED * dt
        const walking = n.path.length > 0
        while (n.path.length && budget > 0) {
          const next = n.path[0]
          n.dir = dirOf(next.x - n.x, next.y - n.y, n.dir)
          budget = moveToward(n, next.x, next.y, budget)
          if (n.x === next.x && n.y === next.y) n.path.shift()
        }
        if (walking) n.anim += dt
        else {
          n.anim = 0
          n.dir = 'down'
        }
        const wantAlpha = n.target ? 1 : 0
        n.alpha += Math.sign(wantAlpha - n.alpha) * Math.min(Math.abs(wantAlpha - n.alpha), dt * 2)
      }

      const toActor = (w: Walker, look: Actor['look'], walking: boolean): Actor => ({
        x: w.x,
        y: w.y,
        dir: w.dir,
        phase: walking ? Math.floor(w.anim / FRAME_TIME) % 4 : 0,
        alpha: w.alpha,
        look,
      })

      const scale = el.width / WIDTH
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      drawScene(ctx, {
        time: s.time,
        t,
        vaultUnlocked: s.vaultUnlocked,
        caseOpen: s.caseOpen,
        player: toActor(player, LOOKS.player, !arrived || player.anim > 0),
        npcs: [
          toActor(npcs.get('guard')!, LOOKS.guard, npcs.get('guard')!.path.length > 0),
          toActor(npcs.get('curator')!, LOOKS.curator, npcs.get('curator')!.path.length > 0),
        ],
        focus: s.status === 'playing' && facingLabel(s) !== null ? ahead(s) : null,
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [dispatch, input])

  return <canvas ref={canvas} className="world" aria-label="美術館の見取り図" />
}
