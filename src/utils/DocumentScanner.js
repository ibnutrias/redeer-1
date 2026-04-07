// DocumentScanner.js
// Advanced CamScanner-style document detection using lightweight pure JS Computer Vision
// Pipeline:
// 1. Downscale to 192x144
// 2. Grayscale 
// 3. Bradley-Roth Adaptive Thresholding (robust to shadows/lighting)
// 4. Connected Components to find blobs
// 5. Convex Hull (Monotone Chain)
// 6. Douglas-Peucker Polygon Approximation to find 4 corners
// 7. Homography Perspective Warp

const DW = 192
const DH = 144

// Temporal smoothing state
let lastSmoothed = null
const SMOOTH_FACTOR = 0.35 // 0.0-1.0, higher means more responsive, lower means smoother

/* ────────────────────────────────────────────────────────────
   PUBLIC API
──────────────────────────────────────────────────────────── */

export function detectDocument(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  if (!vw || !vh) return null

  // Capture small frame
  const ac = makeCanvas(DW, DH)
  ac.ctx.drawImage(videoEl, 0, 0, DW, DH)
  const imgData = ac.ctx.getImageData(0, 0, DW, DH).data

  // 1. Grayscale
  const gray = new Uint8Array(DW * DH)
  for (let i = 0; i < DW * DH; i++) {
    gray[i] = (imgData[i * 4] * 299 + imgData[i * 4 + 1] * 587 + imgData[i * 4 + 2] * 114) / 1000
  }

  // 2. Bradley-Roth Adaptive Thresholding (Finds local contrast)
  const bin = bradleyRothThreshold(gray, DW, DH)

  // 3. Extract blobs, get their convex hull & approx polygon
  const corners = findBestQuad(bin, DW, DH)

  if (!corners) return null

  // Scale back to video coordinates
  const sx = vw / DW
  const sy = vh / DH
  const scaled = corners.map(p => ({ x: p.x * sx, y: p.y * sy }))

  const area = quadArea(scaled)
  const confidence = Math.min(1, area / (vw * vh * 0.9))

  return { corners: scaled, confidence }
}

export function cropDocument(videoEl, corners) {
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  const src = makeCanvas(vw, vh)
  src.ctx.drawImage(videoEl, 0, 0, vw, vh)

  const outW = Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2])))
  const outH = Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2])))

  return warpPerspective(src.canvas, corners, outW, outH)
}

/* ────────────────────────────────────────────────────────────
   COMPUTER VISION PIPELINE
──────────────────────────────────────────────────────────── */

function bradleyRothThreshold(gray, w, h) {
  const s = Math.floor(w / 8)
  const t = 15 // 15% darker than average → black

  // Integral image
  const intImg = new Int32Array(w * h)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = 0; x < w; x++) {
      sum += gray[y * w + x]
      intImg[y * w + x] = sum + (y > 0 ? intImg[(y - 1) * w + x] : 0)
    }
  }

  const bin = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let x1 = Math.max(x - s, 0)
      let x2 = Math.min(x + s, w - 1)
      let y1 = Math.max(y - s, 0)
      let y2 = Math.min(y + s, h - 1)

      let count = (x2 - x1) * (y2 - y1)
      let sum = intImg[y2 * w + x2] - intImg[y1 * w + x2] - intImg[y2 * w + x1] + intImg[y1 * w + x1]

      // If pixel is X% darker than local average, it's black (edge/text). Otherwise white (page background).
      bin[y * w + x] = (gray[y * w + x] * count) < (sum * (100 - t) / 100) ? 0 : 255
    }
  }
  return bin
}

function findBestQuad(bin, w, h) {
  const visited = new Uint8Array(w * h)
  const q = new Int32Array(w * h)

  let bestQuad = null
  let bestArea = 0
  const minArea = w * h * 0.25 // at least 25% of screen

  for (let i = 0; i < w * h; i++) {
    // Only looking at white blobs (potential pages)
    if (bin[i] === 255 && visited[i] === 0) {
      let head = 0, tail = 0
      q[tail++] = i
      visited[i] = 1

      const pts = []
      let minX = w, maxX = 0, minY = h, maxY = 0

      while (head < tail) {
        let p = q[head++]
        let x = p % w, y = Math.floor(p / w)
        pts.push({ x, y })

        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y

        if (x > 0 && bin[p - 1] === 255 && visited[p - 1] === 0) { visited[p - 1] = 1; q[tail++] = p - 1 }
        if (x < w - 1 && bin[p + 1] === 255 && visited[p + 1] === 0) { visited[p + 1] = 1; q[tail++] = p + 1 }
        if (y > 0 && bin[p - w] === 255 && visited[p - w] === 0) { visited[p - w] = 1; q[tail++] = p - w }
        if (y < h - 1 && bin[p + w] === 255 && visited[p + w] === 0) { visited[p + w] = 1; q[tail++] = p + w }
      }

      // Quick bounding box area check
      const bbArea = (maxX - minX) * (maxY - minY)
      if (bbArea < minArea) continue

      // Downsample points to speed up convex hull (we don't need every internal pixel)
      const borderPts = []
      // Just keep points that touch a black pixel
      for (const pt of pts) {
        const p = pt.y * w + pt.x
        if (pt.x === 0 || pt.x === w - 1 || pt.y === 0 || pt.y === h - 1 ||
          bin[p - 1] === 0 || bin[p + 1] === 0 || bin[p - w] === 0 || bin[p + w] === 0) {
          borderPts.push(pt)
        }
      }

      if (borderPts.length < 4) continue

      const hull = convexHull(borderPts)
      const quad = getQuadrilateral(hull)

      if (quad && quad.length === 4) {
        // Enforce strict rectangle constraints
        const angles = getInternalAngles(quad)
        const isRect = angles.every(a => a > 70 && a < 110)

        if (isRect) {
          const area = quadArea(quad)
          const isFullscreen = (area > w * h * 0.95)
          if (area > bestArea && !isFullscreen) {
            bestArea = area
            bestQuad = quad
          }
        }
      }

    }
  }

  if (!bestQuad) {
    // If we missed a frame or two but had a quad recently, decay the smoothing
    lastSmoothed = null
    return null
  }

  const ordered = orderCorners(bestQuad)

  // Apply temporal smoothing (Exponential Moving Average)
  if (!lastSmoothed) {
    lastSmoothed = ordered
  } else {
    for (let i = 0; i < 4; i++) {
      // Find closest point to track consistently (since ordering might flip if rotation is weird)
      let closestDist = Infinity
      let matchIdx = i
      for (let j = 0; j < 4; j++) {
        const d = dist(ordered[i], lastSmoothed[j])
        if (d < closestDist) { closestDist = d; matchIdx = j }
      }

      lastSmoothed[matchIdx].x = lastSmoothed[matchIdx].x * (1 - SMOOTH_FACTOR) + ordered[i].x * SMOOTH_FACTOR
      lastSmoothed[matchIdx].y = lastSmoothed[matchIdx].y * (1 - SMOOTH_FACTOR) + ordered[i].y * SMOOTH_FACTOR
    }
    // Re-order the smoothed corners to ensure strict TL,TR,BR,BL
    lastSmoothed = orderCorners(lastSmoothed)
  }

  return lastSmoothed
}

function getInternalAngles(pts) {
  const angles = []
  for (let i = 0; i < 4; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % 4]
    const p3 = pts[(i + 2) % 4]

    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }

    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.hypot(v1.x, v1.y)
    const mag2 = Math.hypot(v2.x, v2.y)

    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI)
    angles.push(angle)
  }
  return angles
}


function convexHull(pts) {
  pts.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x)
  const lower = []
  for (let i = 0; i < pts.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop()
    lower.push(pts[i])
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop()
    upper.push(pts[i])
  }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function simplifyPoly(pts, tol) {
  if (pts.length <= 2) return pts
  let maxD = 0, maxIdx = 0
  const p0 = pts[0], p1 = pts[pts.length - 1]

  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDist(pts[i], p0, p1)
    if (d > maxD) { maxD = d; maxIdx = i }
  }

  if (maxD > tol) {
    const r1 = simplifyPoly(pts.slice(0, maxIdx + 1), tol)
    const r2 = simplifyPoly(pts.slice(maxIdx), tol)
    return r1.slice(0, r1.length - 1).concat(r2)
  } else {
    return [p0, p1]
  }
}

function pointLineDist(p, a, b) {
  const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x)
  const den = Math.hypot(b.y - a.y, b.x - a.x)
  return den === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : num / den
}

function getQuadrilateral(hull) {
  let tol = 2
  while (tol < Math.max(DW, DH)) {
    const simplified = simplifyPoly([...hull, hull[0]], tol)
    simplified.pop() // remove duplicate last
    if (simplified.length === 4) return simplified
    if (simplified.length < 4) break
    tol += 1
  }
  return null
}

function orderCorners(pts) {
  // Sort by Y to split into top and bottom pairs
  pts.sort((a, b) => a.y - b.y)
  const top = pts.slice(0, 2).sort((a, b) => a.x - b.x)
  const btm = pts.slice(2, 4).sort((a, b) => b.x - a.x) // bottom right, bottom left
  // Return TL, TR, BR, BL
  return [top[0], top[1], btm[0], btm[1]]
}

/* ────────────────────────────────────────────────────────────
   PERSPECTIVE WARP (BILINEAR)
──────────────────────────────────────────────────────────── */

function warpPerspective(srcCanvas, corners, outW, outH) {
  const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }]
  const H = computeHomography(dst, corners)

  const out = makeCanvas(outW, outH)
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  const srcImg = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)
  const outImg = out.ctx.createImageData(outW, outH)
  const sw = srcCanvas.width, sh = srcCanvas.height
  const sd = srcImg.data, od = outImg.data

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const xw = H[0] * dx + H[1] * dy + H[2]
      const yw = H[3] * dx + H[4] * dy + H[5]
      const w = H[6] * dx + H[7] * dy + H[8]
      const sx = xw / w, sy = yw / w

      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue

      const x0 = sx | 0, y0 = sy | 0, x1 = x0 + 1, y1 = y0 + 1
      const fx = sx - x0, fy = sy - y0
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy, w11 = fx * fy

      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4
      const oi = (dy * outW + dx) * 4

      for (let c = 0; c < 3; c++) {
        od[oi + c] = sd[i00 + c] * w00 + sd[i10 + c] * w10 + sd[i01 + c] * w01 + sd[i11 + c] * w11
      }
      od[oi + 3] = 255
    }
  }
  out.ctx.putImageData(outImg, 0, 0)
  return out.canvas
}

function computeHomography(src4, dst4) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const sx = src4[i].x, sy = src4[i].y, dx = dst4[i].x, dy = dst4[i].y
    A.push([-sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx])
    b.push(-dx)
    A.push([0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy])
    b.push(-dy)
  }
  return [...gaussElim(A, b), 1]
}

function gaussElim(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]])
  for (let col = 0; col < n; col++) {
    let max = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[max][col])) max = r
      ;[M[col], M[max]] = [M[max], M[col]]
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  const x = new Array(n)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

/* ────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────── */

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) }
}

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) }

function quadArea(pts) {
  const [a, b, c, d] = pts
  return 0.5 * Math.abs((a.x * b.y - b.x * a.y) + (b.x * c.y - c.x * b.y) + (c.x * d.y - d.x * c.y) + (d.x * a.y - a.x * d.y))
}
