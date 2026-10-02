import type { Dir } from '../game/engine'
import { EXPLOSION_TIME, MAP, zoneAt } from '../game/scenario'
import {
  LOOKS,
  T,
  drawCharacter,
  drawEntrance,
  drawFloor,
  drawObject,
  drawPainting,
  drawVaultDoor,
  drawWallFace,
  drawWallTop,
  type Look,
} from './sprites'

export const COLS = MAP[0].length
export const ROWS = MAP.length
export const WIDTH = COLS * T
export const HEIGHT = ROWS * T

export interface Actor {
  /** マス単位の位置（移動中は小数） */
  x: number
  y: number
  dir: Dir
  phase: number
  alpha: number
  look: Look
}

export interface Scene {
  time: number
  /** アニメーション用の経過秒 */
  t: number
  vaultUnlocked: boolean
  caseOpen: boolean
  clockFixed: boolean
  /** エンディング中は 15:05 の警告を出さない */
  ended: boolean
  player: Actor
  npcs: Actor[]
  /** 調べられるものの枠を出すマス */
  focus: { x: number; y: number } | null
}

/** 壁として扱う（上に面が見える）文字 */
const WALLISH = new Set(['#', 'P', 'Q', 'R', 'E'])
const OBJECTS = new Set(['C', 'D', 'd', 'T', 'M', 'B', 'S', 'b', 'p', 'x', 'X'])

/** 照明。マス単位の座標と半径 */
const LIGHTS = [
  { x: 11.5, y: 10, r: 4.5 },
  { x: 4.5, y: 10.5, r: 4 },
  { x: 19.5, y: 10.5, r: 4 },
  { x: 4.5, y: 2.5, r: 3.5 },
  { x: 11.5, y: 3, r: 3.5 },
]

const DARKNESS: Record<string, number> = {
  lobby: 0.1,
  gallery: 0.28,
  sculpture: 0.3,
  office: 0.25,
  hall: 0.32,
  vault: 0.62,
}

let shade: HTMLCanvasElement | null = null

const drawLighting = (ctx: CanvasRenderingContext2D, scene: Scene) => {
  shade ??= document.createElement('canvas')
  shade.width = WIDTH
  shade.height = HEIGHT
  const s = shade.getContext('2d')!
  s.clearRect(0, 0, WIDTH, HEIGHT)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const zone = zoneAt(x, y) ?? zoneAt(x, y + 1) ?? zoneAt(x + 1, y) ?? zoneAt(x - 1, y)
      s.fillStyle = `rgba(14, 8, 28, ${zone ? DARKNESS[zone] : 0.4})`
      s.fillRect(x * T, y * T, T, T)
    }
  }
  s.globalCompositeOperation = 'destination-out'
  const flicker = 1 + Math.sin(scene.t * 7) * 0.02
  const lights = [...LIGHTS, { x: scene.player.x + 0.5, y: scene.player.y + 0.5, r: 2.2 }]
  for (const l of lights) {
    const g = s.createRadialGradient(l.x * T, l.y * T, 0, l.x * T, l.y * T, l.r * T * flicker)
    g.addColorStop(0, 'rgba(0,0,0,0.75)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    s.fillStyle = g
    s.fillRect(0, 0, WIDTH, HEIGHT)
  }
  s.globalCompositeOperation = 'source-over'
  ctx.drawImage(shade, 0, 0)

  // 装置の光
  ctx.globalCompositeOperation = 'lighter'
  const pulse = 0.5 + Math.sin(scene.t * 3) * 0.15
  const g = ctx.createRadialGradient(19.5 * T, 1.3 * T, 0, 19.5 * T, 1.3 * T, 3 * T)
  g.addColorStop(0, `rgba(255, 170, 60, ${0.35 * pulse})`)
  g.addColorStop(1, 'rgba(255, 170, 60, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.globalCompositeOperation = 'source-over'

  // 15:05が近づくと赤く脈打つ
  const left = EXPLOSION_TIME - scene.time
  if (left <= 120 && !scene.ended) {
    const k = (1 - left / 120) * (0.5 + Math.sin(scene.t * 6) * 0.5) * 0.18
    ctx.fillStyle = `rgba(200, 30, 40, ${k})`
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }
}

export const drawScene = (ctx: CanvasRenderingContext2D, scene: Scene) => {
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, WIDTH, HEIGHT)

  // 床と壁
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x]
      if (ch === 'V') {
        drawVaultDoor(ctx, x, y, scene.vaultUnlocked, scene.t)
        continue
      }
      if (ch === 'E') {
        drawEntrance(ctx, x, y, MAP[y][x + 1] === 'E')
        continue
      }
      if (WALLISH.has(ch)) {
        const below = MAP[y + 1]?.[x]
        const zone = zoneAt(x, y + 1)
        if (below !== undefined && !WALLISH.has(below) && zone) {
          drawWallFace(ctx, zone, x, y)
          if (ch === 'P' || ch === 'Q' || ch === 'R') drawPainting(ctx, ch, x, y)
        } else {
          drawWallTop(ctx, x, y)
        }
        continue
      }
      drawFloor(ctx, ch === '+' ? null : zoneAt(x, y), x, y)
    }
  }

  // 物と人物を奥から順に描く
  const items: { y: number; draw: () => void }[] = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = MAP[y][x]
      if (OBJECTS.has(ch)) {
        const o = { caseOpen: scene.caseOpen, clockFixed: scene.clockFixed, time: scene.time }
        items.push({ y, draw: () => drawObject(ctx, ch, x, y, scene.t, o) })
      }
    }
  }
  for (const a of [...scene.npcs, scene.player]) {
    if (a.alpha <= 0) continue
    items.push({
      y: a.y + 0.01,
      draw: () => {
        ctx.globalAlpha = a.alpha
        drawCharacter(ctx, a.x * T, a.y * T, a.dir, a.phase, a.look)
        ctx.globalAlpha = 1
      },
    })
  }
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw())

  drawLighting(ctx, scene)

  // 調べられるものを示す枠
  if (scene.focus) {
    const a = 0.45 + Math.sin(scene.t * 5) * 0.3
    ctx.strokeStyle = `rgba(240, 200, 100, ${a})`
    ctx.lineWidth = 1
    ctx.strokeRect(scene.focus.x * T + 0.5, scene.focus.y * T + 0.5, T - 1, T - 1)
  }
}

export { LOOKS }
