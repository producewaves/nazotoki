// ドット絵はすべてコードで描く（画像ファイルは使わない）。
// 1マス = 16px のネイティブ解像度で描き、表示時に拡大する。

import type { Dir } from '../game/engine'
import type { ZoneId } from '../game/scenario'

export const T = 16

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** 座標から決まる疑似乱数（0〜1）。床の模様を毎フレーム同じにするため */
const hash = (x: number, y: number, salt = 0) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

// ---------------------------------------------------------------- 床

export const drawFloor = (ctx: Ctx, zone: ZoneId | null, tx: number, ty: number) => {
  const x = tx * T
  const y = ty * T
  switch (zone) {
    case 'lobby': {
      // 大理石の市松模様
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) px(ctx, x + i * 8, y + j * 8, 8, 8, (i + j) % 2 ? '#cfc6b4' : '#ded6c6')
      if (hash(tx, ty) > 0.6) px(ctx, x + 3 + Math.floor(hash(tx, ty, 1) * 9), y + 5, 3, 1, '#bdb3a0')
      break
    }
    case 'gallery': {
      // 板張り
      for (let r = 0; r < 4; r++) {
        px(ctx, x, y + r * 4, T, 4, r % 2 ? '#7a4d2c' : '#835431')
        px(ctx, x, y + r * 4 + 3, T, 1, '#5f3a20')
        const seam = Math.floor(hash(tx, ty, r) * 14)
        px(ctx, x + seam, y + r * 4, 1, 3, '#5f3a20')
      }
      break
    }
    case 'sculpture': {
      px(ctx, x, y, T, T, '#a19d94')
      px(ctx, x, y + 15, T, 1, '#87837a')
      px(ctx, x + 15, y, 1, T, '#87837a')
      if (hash(tx, ty) > 0.7) px(ctx, x + 5, y + 7, 2, 1, '#938f86')
      break
    }
    case 'office': {
      px(ctx, x, y, T, T, '#3e5b4b')
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) px(ctx, x + i * 4 + 1, y + j * 4 + 1, 1, 1, '#476653')
      break
    }
    case 'hall': {
      px(ctx, x, y, T, T, '#7a2a33')
      for (let i = 0; i < 2; i++) px(ctx, x + 3 + i * 8, y + 3 + i * 8, 2, 2, '#8e3a43')
      break
    }
    case 'vault': {
      px(ctx, x, y, T, T, '#45454c')
      for (let i = 0; i < 5; i++) px(ctx, x + Math.floor(hash(tx, ty, i) * 15), y + Math.floor(hash(tx, ty, i + 9) * 15), 1, 1, '#52525a')
      if (hash(tx, ty, 3) > 0.8) {
        px(ctx, x + 4, y + 9, 4, 1, '#38383e')
        px(ctx, x + 8, y + 10, 3, 1, '#38383e')
      }
      break
    }
    default:
      // 出入口の敷居
      px(ctx, x, y, T, T, '#5d4630')
      px(ctx, x, y, T, 1, '#4a3726')
      px(ctx, x, y + 15, T, 1, '#4a3726')
  }
}

// ---------------------------------------------------------------- 壁

const FACE: Record<ZoneId, { paper: string; stripe: string; wainscot: string }> = {
  lobby: { paper: '#b8a688', stripe: '#ad9b7d', wainscot: '#6b4a2f' },
  gallery: { paper: '#6b2a30', stripe: '#622529', wainscot: '#3f2a1e' },
  sculpture: { paper: '#a6a299', stripe: '#9c988f', wainscot: '#77736b' },
  office: { paper: '#4b6a54', stripe: '#43604c', wainscot: '#4a3423' },
  hall: { paper: '#b39872', stripe: '#a88d68', wainscot: '#5a3d27' },
  vault: { paper: '#3b3b44', stripe: '#34343c', wainscot: '#2a2a30' },
}

export const drawWallTop = (ctx: Ctx, tx: number, ty: number) => {
  px(ctx, tx * T, ty * T, T, T, '#221d29')
  px(ctx, tx * T, ty * T, T, 1, '#2b2533')
}

/** 手前を向いた壁の面。壁紙と腰板 */
export const drawWallFace = (ctx: Ctx, zone: ZoneId, tx: number, ty: number) => {
  const x = tx * T
  const y = ty * T
  const f = FACE[zone]
  px(ctx, x, y, T, T, f.paper)
  for (let i = 1; i < T; i += 4) px(ctx, x + i, y + 3, 1, 8, f.stripe)
  px(ctx, x, y, T, 3, '#2b2533')
  px(ctx, x, y + 3, T, 1, '#00000033')
  px(ctx, x, y + 11, T, 5, f.wainscot)
  px(ctx, x, y + 11, T, 1, '#ffffff22')
  px(ctx, x, y + 15, T, 1, '#00000055')
}

/** 壁にかかった絵 */
export const drawPainting = (ctx: Ctx, kind: 'P' | 'Q' | 'R', tx: number, ty: number) => {
  const x = tx * T + 2
  const y = ty * T + 3
  px(ctx, x - 1, y + 1, 14, 10, '#00000044')
  px(ctx, x, y, 12, 9, '#c9a23c')
  px(ctx, x + 1, y + 1, 10, 7, '#8a6a22')
  const ix = x + 2
  const iy = y + 2
  if (kind === 'P') {
    px(ctx, ix, iy, 8, 5, '#3d3350')
    px(ctx, ix + 3, iy + 1, 2, 2, '#e8c6a0')
    px(ctx, ix + 2, iy, 4, 1, '#3a2418')
    px(ctx, ix + 2, iy + 3, 4, 2, '#8a3b4a')
    px(ctx, ix + 6, iy + 1, 1, 1, '#d8d0b8')
  } else if (kind === 'Q') {
    px(ctx, ix, iy, 8, 2, '#e09a4c')
    px(ctx, ix, iy + 2, 8, 1, '#c8664a')
    px(ctx, ix, iy + 3, 8, 2, '#355a7a')
    px(ctx, ix + 5, iy + 1, 2, 1, '#f6d27a')
  } else {
    px(ctx, ix, iy, 8, 5, '#e6dcc4')
    px(ctx, ix + 3, iy + 1, 1, 3, '#77706a')
    px(ctx, ix + 4, iy + 1, 2, 1, '#77706a')
    px(ctx, ix + 5, iy + 2, 1, 1, '#77706a')
  }
}

export const drawVaultDoor = (ctx: Ctx, tx: number, ty: number, open: boolean, t: number) => {
  const x = tx * T
  const y = ty * T
  if (open) {
    px(ctx, x, y, T, T, '#1a1a1f')
    px(ctx, x, y, 2, T, '#55565e')
    px(ctx, x + 14, y, 2, T, '#55565e')
    return
  }
  px(ctx, x, y, T, T, '#5a5c66')
  px(ctx, x + 1, y + 1, 14, 14, '#6c6e78')
  px(ctx, x + 1, y + 7, 14, 1, '#4c4e57')
  for (const [rx, ry] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(ctx, x + rx, y + ry, 1, 1, '#9a9ca6')
  px(ctx, x + 5, y + 3, 6, 3, '#2b2c33')
  const blink = Math.floor(t * 2) % 2 === 0
  px(ctx, x + 6, y + 4, 1, 1, blink ? '#ff4d4d' : '#7a2020')
}

export const drawEntrance = (ctx: Ctx, tx: number, ty: number, left: boolean) => {
  const x = tx * T
  const y = ty * T
  px(ctx, x, y, T, T, '#4a3220')
  px(ctx, x + 1, y + 1, 14, 14, '#6b4a2f')
  px(ctx, x + 3, y + 3, 10, 8, '#9cc2d6')
  px(ctx, x + 3, y + 3, 10, 2, '#c7e0ec')
  px(ctx, left ? x + 14 : x + 1, y + 8, 1, 3, '#c9a23c')
}

// ---------------------------------------------------------------- 物

export interface ObjectState {
  caseOpen: boolean
  clockFixed: boolean
  /** ゲーム内の時刻（秒）。直した大時計の針に使う */
  time: number
}

export const drawObject = (ctx: Ctx, ch: string, tx: number, ty: number, t: number, o: ObjectState) => {
  const x = tx * T
  const y = ty * T
  const shadow = (w = 12) => px(ctx, x + (T - w) / 2, y + 13, w, 3, '#00000040')
  switch (ch) {
    case 'C': {
      // 大時計：上にはみ出して背が高い
      shadow(10)
      px(ctx, x + 3, y - 12, 10, 27, '#4f2d1b')
      px(ctx, x + 4, y - 11, 8, 25, '#6a3d24')
      px(ctx, x + 4, y - 10, 8, 8, '#e9dfc6')
      // 短針（二時と三時のあいだ）。長針は、直すまでない
      px(ctx, x + 8, y - 7, 2, 1, '#2b1d14')
      px(ctx, x + 7, y - 7, 1, 1, '#2b1d14')
      if (o.clockFixed) {
        const ang = (((o.time / 60) % 60) / 60) * Math.PI * 2
        for (let r = 1; r <= 3; r++) {
          px(ctx, x + 7 + Math.round(Math.sin(ang) * r), y - 7 - Math.round(Math.cos(ang) * r), 1, 1, '#9a6a1a')
        }
      }
      px(ctx, x + 5, y, 6, 11, '#2c1a10')
      const swing = Math.round(Math.sin(t * 3) * 2)
      px(ctx, x + 7 + swing, y + 1, 2, 7, '#b88b2a')
      px(ctx, x + 6 + swing, y + 7, 4, 3, '#d8aa3a')
      break
    }
    case 'D': {
      shadow(14)
      px(ctx, x + 1, y + 2, 14, 9, '#5a3a22')
      px(ctx, x + 1, y + 2, 14, 7, '#7a5233')
      px(ctx, x + 2, y + 11, 2, 4, '#4a2f1b')
      px(ctx, x + 12, y + 11, 2, 4, '#4a2f1b')
      px(ctx, x + 4, y + 3, 8, 5, '#efe6cf')
      px(ctx, x + 8, y + 3, 1, 5, '#c8bfa6')
      for (let i = 0; i < 3; i++) px(ctx, x + 5, y + 4 + i, 2, 1, '#8d8574')
      break
    }
    case 'd': {
      shadow(14)
      px(ctx, x + 1, y + 4, 14, 7, '#6b4a30')
      px(ctx, x + 2, y + 11, 2, 4, '#4a2f1b')
      px(ctx, x + 12, y + 11, 2, 4, '#4a2f1b')
      px(ctx, x + 4, y + 5, 8, 5, '#c9a23c')
      px(ctx, x + 5, y + 6, 6, 3, '#6b4a30')
      break
    }
    case 'T': {
      // 受付カウンター
      px(ctx, x, y + 3, T, 12, '#5e3b24')
      px(ctx, x, y + 3, T, 3, '#9a6a40')
      px(ctx, x, y + 6, T, 1, '#3f2716')
      if (tx % 2 === 0) px(ctx, x + 10, y + 1, 3, 2, '#d8b04a')
      break
    }
    case 'M': {
      // ガラスケースの装置
      shadow(14)
      px(ctx, x + 2, y + 9, 12, 6, '#55545c')
      px(ctx, x + 2, y + 9, 12, 1, '#6e6d76')
      const cx = x + 8
      const cy = y + 3
      const a = t * 2
      px(ctx, cx - 3, cy - 3, 6, 6, '#b8862a')
      for (let i = 0; i < 4; i++) {
        const ang = a + (i * Math.PI) / 2
        px(ctx, Math.round(cx + Math.cos(ang) * 4) - 1, Math.round(cy + Math.sin(ang) * 4) - 1, 2, 2, '#d9a93a')
      }
      px(ctx, cx - 1, cy - 1, 2, 2, '#5a3c10')
      if (!o.caseOpen) {
        ctx.fillStyle = '#a8d8ff30'
        ctx.fillRect(x + 2, y - 4, 12, 13)
        px(ctx, x + 2, y - 4, 12, 1, '#d8f0ff80')
        px(ctx, x + 2, y - 4, 1, 13, '#d8f0ff60')
        px(ctx, x + 13, y - 4, 1, 13, '#d8f0ff40')
        px(ctx, x + 4, y - 2, 1, 4, '#ffffff70')
      }
      break
    }
    case 'B': {
      // 本棚
      px(ctx, x + 1, y - 6, 14, 21, '#4a2f1b')
      const colors = ['#8a3b3b', '#3b5a8a', '#c9a23c', '#3b7a5a', '#6b3b7a']
      for (let r = 0; r < 3; r++) {
        px(ctx, x + 2, y - 5 + r * 7, 12, 6, '#2b1a0f')
        for (let i = 0; i < 5; i++) {
          const h = 4 + Math.floor(hash(tx, r, i) * 2)
          px(ctx, x + 3 + i * 2, y - 5 + r * 7 + (6 - h), 2, h, colors[(i + r + tx) % colors.length])
        }
      }
      break
    }
    case 'S': {
      // 彫像
      shadow(10)
      px(ctx, x + 3, y + 9, 10, 6, '#8a877f')
      px(ctx, x + 3, y + 9, 10, 1, '#a9a69e')
      px(ctx, x + 6, y - 3, 4, 4, '#ecebe6')
      px(ctx, x + 5, y + 1, 6, 8, '#e2e1db')
      px(ctx, x + 5, y + 1, 1, 8, '#c9c8c1')
      px(ctx, x + 4, y + 2, 1, 4, '#d6d5ce')
      break
    }
    case 'b': {
      shadow(14)
      px(ctx, x + 1, y + 7, 14, 4, '#7a5233')
      px(ctx, x + 1, y + 7, 14, 1, '#97683f')
      px(ctx, x + 2, y + 11, 2, 3, '#4a2f1b')
      px(ctx, x + 12, y + 11, 2, 3, '#4a2f1b')
      break
    }
    case 'p': {
      shadow(8)
      px(ctx, x + 5, y + 9, 6, 6, '#a5532e')
      px(ctx, x + 5, y + 9, 6, 1, '#c2683c')
      px(ctx, x + 4, y + 1, 8, 8, '#3d7a3d')
      px(ctx, x + 3, y + 3, 3, 4, '#336a33')
      px(ctx, x + 10, y + 2, 3, 5, '#336a33')
      px(ctx, x + 6, y - 2, 4, 4, '#4a8f45')
      px(ctx, x + 7, y + 2, 2, 2, '#5aa553')
      break
    }
    case 'x':
    case 'X': {
      shadow(14)
      px(ctx, x + 1, y + 2, 14, 13, '#7a5a34')
      px(ctx, x + 2, y + 3, 12, 11, '#957040')
      px(ctx, x + 2, y + 8, 12, 1, '#7a5a34')
      px(ctx, x + 7, y + 3, 2, 11, '#7a5a34')
      break
    }
  }
}

// ---------------------------------------------------------------- 人物

export interface Look {
  hair: string
  skin: string
  shirt: string
  pants: string
  shoes: string
  cap?: string
  longHair?: boolean
  glasses?: boolean
}

export const LOOKS: Record<'player' | 'guard' | 'curator', Look> = {
  player: { hair: '#3a2418', skin: '#f0c8a0', shirt: '#2f8a8a', pants: '#2b3550', shoes: '#1c1c22' },
  guard: { hair: '#2a2a2a', skin: '#d9a87e', shirt: '#2c3a63', pants: '#1f2742', shoes: '#111', cap: '#1e2850' },
  curator: {
    hair: '#8a3f22',
    skin: '#f3d2b4',
    shirt: '#7a2a40',
    pants: '#3a2a35',
    shoes: '#2a1a1a',
    longHair: true,
    glasses: true,
  },
}

/**
 * 人物を描く。(x, y) はマスの左上（ネイティブpx、小数可）。
 * phase は歩きのコマ（0〜3。0と2は直立、1と3で足を交互に出す）
 */
export const drawCharacter = (ctx: Ctx, x: number, y: number, dir: Dir, phase: number, look: Look) => {
  x = Math.round(x)
  y = Math.round(y)
  const bob = phase % 2 === 1 ? 1 : 0
  const top = y - 6 + bob

  px(ctx, x + 3, y + 13, 10, 3, '#00000050')

  // 脚
  const lift = (i: number) => (phase === 1 && i === 0) || (phase === 3 && i === 1)
  const side = dir === 'left' || dir === 'right'
  for (let i = 0; i < 2; i++) {
    let lx = x + (i === 0 ? 5 : 9)
    if (side && phase % 2 === 1) lx += (i === 0 ? -1 : 1) * (phase === 1 ? 1 : -1)
    const h = lift(i) && !side ? 3 : 4
    px(ctx, lx, y + 10 + bob, 2, h, look.pants)
    px(ctx, lx, y + 10 + bob + h - 1, 2, 1, look.shoes)
  }

  // 胴と腕
  px(ctx, x + 4, top + 10, 8, 7, look.shirt)
  px(ctx, x + 4, top + 16, 8, 1, '#00000030')
  const swing = phase === 1 ? 1 : phase === 3 ? -1 : 0
  if (dir !== 'left') px(ctx, x + 12, top + 11 - swing, 1, 4, look.shirt)
  if (dir !== 'right') px(ctx, x + 3, top + 11 + swing, 1, 4, look.shirt)
  if (dir !== 'left') px(ctx, x + 12, top + 15 - swing, 1, 1, look.skin)
  if (dir !== 'right') px(ctx, x + 3, top + 15 + swing, 1, 1, look.skin)

  // 頭
  px(ctx, x + 4, top + 2, 8, 8, look.skin)
  px(ctx, x + 4, top + 2, 1, 1, look.hair)
  px(ctx, x + 11, top + 2, 1, 1, look.hair)

  if (dir === 'up') {
    px(ctx, x + 4, top + 1, 8, 9, look.hair)
    if (look.longHair) px(ctx, x + 4, top + 10, 8, 2, look.hair)
  } else {
    px(ctx, x + 4, top + 1, 8, 3, look.hair)
    if (dir === 'down') {
      px(ctx, x + 4, top + 4, 1, 2, look.hair)
      px(ctx, x + 11, top + 4, 1, 2, look.hair)
      px(ctx, x + 6, top + 6, 1, 2, '#1b1420')
      px(ctx, x + 9, top + 6, 1, 2, '#1b1420')
      if (look.glasses) px(ctx, x + 5, top + 6, 6, 1, '#c9a23c55')
      if (look.longHair) {
        px(ctx, x + 3, top + 3, 1, 8, look.hair)
        px(ctx, x + 12, top + 3, 1, 8, look.hair)
      }
    } else {
      const back = dir === 'right' ? x + 4 : x + 9
      const eye = dir === 'right' ? x + 10 : x + 5
      px(ctx, back, top + 3, 3, 5, look.hair)
      px(ctx, eye, top + 6, 1, 2, '#1b1420')
      if (look.longHair) px(ctx, back, top + 8, 3, 4, look.hair)
    }
  }

  if (look.cap) {
    px(ctx, x + 4, top, 8, 3, look.cap)
    if (dir === 'down') px(ctx, x + 4, top + 3, 8, 1, '#141a36')
    if (dir === 'left') px(ctx, x + 2, top + 3, 4, 1, '#141a36')
    if (dir === 'right') px(ctx, x + 10, top + 3, 4, 1, '#141a36')
    if (dir === 'down') px(ctx, x + 7, top + 1, 2, 1, '#d8b04a')
  }
}
