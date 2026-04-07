import re

with open('/Users/ibnufalah/dev/redeer/src/utils/DocumentScanner.js', 'r') as f:
    content = f.read()

# 1. Add temporal smoothing variables at top of file
content = re.sub(
    r'const DW = 192\nconst DH = 144',
    'const DW = 192\nconst DH = 144\n\n// Temporal smoothing state\nlet lastSmoothed = null\nconst SMOOTH_FACTOR = 0.35 // 0.0-1.0, higher means more responsive, lower means smoother',
    content
)

# 2. Add shape validation to findBestQuad
import textwrap
shape_validation = textwrap.dedent("""\
      if (quad && quad.length === 4) {
        // Enforce rough rectangle constraints
        const angles = getInternalAngles(quad)
        const isRect = angles.every(a => a > 50 && a < 130)
        
        if (isRect) {
          const area = quadArea(quad)
          const isFullscreen = (area > w * h * 0.95)
          if (area > bestArea && !isFullscreen) {
            bestArea = area
            bestQuad = quad
          }
        }
      }
""")

content = re.sub(
    r'      if \(quad && quad\.length === 4\) \{\s+const area = quadArea\(quad\)\s+// Checks to ensure it\'s a good quad[^}]+\s+const isFullscreen = \(area > w \* h \* 0\.95\)\s+if \(area > bestArea && !isFullscreen\) \{\s+bestArea = area\s+bestQuad = quad\s+\}\s+\}',
    shape_validation,
    content,
    flags=re.MULTILINE | re.DOTALL
)

# 3. Add getInternalAngles function, wrap temporal smoothing in detectDocument
apply_smoothing = textwrap.dedent("""\
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
      const p2 = pts[(i+1)%4]
      const p3 = pts[(i+2)%4]
      
      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y }
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
      
      const dot = v1.x*v2.x + v1.y*v2.y
      const mag1 = Math.hypot(v1.x, v1.y)
      const mag2 = Math.hypot(v2.x, v2.y)
      
      const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1*mag2)))) * (180 / Math.PI)
      angles.push(angle)
  }
  return angles
}
""")

content = re.sub(
    r'  if \(bestQuad\) return orderCorners\(bestQuad\)\n  return null\n\}',
    apply_smoothing,
    content
)

with open('/Users/ibnufalah/dev/redeer/src/utils/DocumentScanner.js', 'w') as f:
    f.write(content)
