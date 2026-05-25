<template>
  <div class="h-full flex flex-col overflow-hidden bg-black relative select-none">
    <!-- Camera Frame Area -->
    <div class="relative flex-1 bg-black overflow-hidden cursor-pointer" @click="handleTap" aria-label="Area scanner kamera. Ketuk untuk memindai.">
      <video ref="videoEl" autoplay playsinline muted
        class="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
        :class="{ 'opacity-0': !cameraActive }"
      ></video>

      <!-- Detection overlay canvas -->
      <canvas ref="overlayCanvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>

      <!-- No camera idle state -->
      <div v-if="!cameraActive && !isProcessing" class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-500">
        <div class="text-7xl animate-pulse">📷</div>
        <p class="text-md font-medium text-center px-6 text-gray-400">
          Sentuh layar atau tekan <kbd class="kbd kbd-sm bg-gray-800 text-white">Space</kbd> untuk mulai memindai
        </p>
      </div>

      <!-- Processing overlay -->
      <transition name="fade">
        <div v-if="isProcessing" class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/90 z-20">
          <span class="loading loading-ring loading-lg text-primary scale-125"></span>
          <p class="text-white text-base font-semibold animate-pulse text-center px-4">
            🤖 AI sedang menganalisis halaman...
          </p>
          <button @click.stop="cancelAI" class="btn btn-sm btn-outline btn-warning mt-2 rounded-xl">
            Batalkan
          </button>
        </div>
      </transition>

      <!-- Cropped preview thumbnail -->
      <transition name="fade">
        <div v-if="croppedPreview && !isProcessing"
          class="absolute top-4 right-4 w-36 rounded-xl overflow-hidden border-2 border-green-500 shadow-2xl z-10 bg-gray-950">
          <p class="text-[9px] text-center bg-green-500 text-black py-0.5 font-bold uppercase tracking-wider">Hasil Crop</p>
          <img :src="croppedPreview" alt="Dokumen Terpotong" class="w-full h-auto" />
        </div>
      </transition>

      <!-- AI result text overlay -->
      <transition name="slide-up">
        <div v-if="aiResult && isSpeaking"
          class="absolute bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-md border-t border-gray-800 max-h-[35%] overflow-y-auto p-4 z-10"
          aria-live="polite">
          <div class="flex justify-between items-start mb-1">
            <span class="text-xs font-semibold text-primary uppercase tracking-wider">Teks Terbaca:</span>
            <button @click.stop="saveCurrentScan" class="btn btn-xs btn-primary text-white">💾 Simpan ke Perpustakaan</button>
          </div>
          <p class="text-sm text-gray-200 leading-relaxed font-sans">{{ aiResult }}</p>
        </div>
      </transition>

      <!-- Detection badge -->
      <div v-if="autoScanActive && !isProcessing"
        class="absolute top-4 left-4 flex items-center gap-2 bg-black/70 border border-gray-800 rounded-full px-3 py-1.5 pointer-events-none z-10">
        <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse', docDetected ? 'bg-green-400' : 'bg-gray-400']"></span>
        <span class="text-xs text-white font-semibold">{{ docDetected ? 'Dokumen terdeteksi' : 'Mencari dokumen...' }}</span>
      </div>

      <!-- AI finished actions -->
      <div v-if="aiResult && !isSpeaking && !isProcessing && !autoScanActive"
        class="absolute bottom-6 left-0 right-0 flex justify-center gap-3 px-4 z-10">
        <button @click.stop="repeatReading" class="btn btn-sm btn-info rounded-xl text-white px-4 font-bold shadow-lg">
          🔁 Ulangi Bacaan
        </button>
        <button @click.stop="startAutoScan" class="btn btn-sm btn-primary rounded-xl text-white px-4 font-bold shadow-lg">
          ▶ Halaman Berikutnya
        </button>
      </div>
    </div>

    <!-- Scanner Bottom Controls -->
    <div class="p-4 bg-gray-950 border-t border-gray-850 flex-shrink-0">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <button @click.stop="toggleAutoScan" :class="['btn btn-md flex-1 text-white font-bold rounded-xl shadow', autoScanActive ? 'btn-error' : 'btn-primary']">
            {{ autoScanActive ? '⏹ Hentikan Auto-Scan' : '▶ Mulai Auto-Scan' }}
          </button>
          <button @click.stop="manualCapture" class="btn btn-md btn-secondary text-white rounded-xl shadow" :disabled="!cameraActive || isProcessing" title="Scan Manual">
            📸
          </button>
          
          <template v-if="isSpeaking">
            <button v-if="!isPaused" @click.stop="pauseReading" class="btn btn-md btn-warning text-white rounded-xl shadow">⏸</button>
            <button v-else          @click.stop="resumeReading" class="btn btn-md btn-info text-white rounded-xl shadow">▶</button>
            <button @click.stop="stopReading" class="btn btn-md btn-ghost text-red-500 rounded-xl">⏹</button>
          </template>
        </div>
        <p class="text-xs text-gray-500 text-center leading-relaxed">
          Pintasan: <kbd class="kbd kbd-xs bg-gray-900 text-gray-400">Space</kbd> Auto · <kbd class="kbd kbd-xs bg-gray-900 text-gray-400">Enter</kbd> Manual · <kbd class="kbd kbd-xs bg-gray-900 text-gray-400">P</kbd> Jeda · <kbd class="kbd kbd-xs bg-gray-900 text-gray-400">R</kbd> Ulangi
        </p>
      </div>
    </div>

    <canvas ref="captureCanvas" class="hidden"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import puter from '@heyputer/puter.js'
import { detectDocument, cropDocument } from '../utils/DocumentScanner.js'
import {
  aiModel,
  scanDelay,
  isSpeaking,
  isPaused,
  playTTS,
  pauseTTS,
  resumeTTS,
  stopTTS,
  announce,
  saveToLibrary,
  warmUpTTS
} from '../utils/appState.js'

// ── DOM Refs ────────────────────────────────────────────────
const videoEl = ref(null)
const overlayCanvas = ref(null)
const captureCanvas = ref(null)

// ── Local State ─────────────────────────────────────────────
let mediaStream = null
const cameraActive = ref(false)
const autoScanActive = ref(false)
const isProcessing = ref(false)
const docDetected = ref(false)
const aiResult = ref('')
const croppedPreview = ref(null)

// ── Audio Beep ──────────────────────────────────────────────
const beep = new Audio('/sounds/jbl_latency_sae.ogg')
beep.loop = true
let beepActive = false

function startBeep() {
  if (beepActive) return
  beepActive = true
  beep.play().catch(() => { beepActive = false })
}

function stopBeep() {
  beepActive = false
  beep.pause()
  beep.currentTime = 0
}

// ── Camera Access ───────────────────────────────────────────
async function startCamera() {
  if (cameraActive.value) return
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    if (videoEl.value) {
      videoEl.value.srcObject = mediaStream
      await new Promise(r => { videoEl.value.onloadedmetadata = r })
      cameraActive.value = true
    }
  } catch (e) {
    announce('Gagal membuka kamera. Pastikan akses diizinkan.')
  }
}

function stopCamera() {
  mediaStream?.getTracks().forEach(t => t.stop())
  mediaStream = null
  if (videoEl.value) videoEl.value.srcObject = null
  cameraActive.value = false
  stopLoop()
  stopBeep()
}

// ── Real-Time Detection Loop ──────────────────────────────
let animId = null
let stableFrames = 0
let lastTime = 0
let lastCorners = null

function startLoop() {
  stopLoop()
  loopStep()
}

function stopLoop() {
  if (animId) {
    cancelAnimationFrame(animId)
    animId = null
  }
}

function loopStep() {
  if (!autoScanActive.value || !cameraActive.value || isProcessing.value) return
  animId = requestAnimationFrame(loopStep)
  const now = Date.now()
  // Run scan roughly every 160ms (~6fps)
  if (now - lastTime < 160) return
  lastTime = now

  const vid = videoEl.value
  if (!vid || vid.readyState < 2) return

  const r = detectDocument(vid)
  if (r && r.confidence > 0.08) {
    docDetected.value = true
    lastCorners = r.corners
    stableFrames++
    drawOverlay(r.corners, stableFrames / (scanDelay.value * 6)) // estimate 6 frames per second

    if (stableFrames >= (scanDelay.value * 6) && !isProcessing.value) {
      stopLoop()
      isProcessing.value = true
      announce('Dokumen stabil, memproses gambar.', () => runAI(lastCorners))
    }
  } else {
    docDetected.value = false
    stableFrames = Math.max(0, stableFrames - 2)
    if (stableFrames === 0) clearOverlay()
  }
}

// ── Overlay Render ──────────────────────────────────────────
function drawOverlay(corners, progress) {
  const oc = overlayCanvas.value
  const vid = videoEl.value
  if (!oc || !vid) return
  oc.width = vid.clientWidth
  oc.height = vid.clientHeight
  const ctx = oc.getContext('2d')
  ctx.clearRect(0, 0, oc.width, oc.height)

  const sx = oc.width / vid.videoWidth
  const sy = oc.height / vid.videoHeight
  const s = Math.min(sx, sy)
  const ox = (oc.width - vid.videoWidth * s) / 2
  const oy = (oc.height - vid.videoHeight * s) / 2
  const pts = corners.map(p => ({ x: p.x * s + ox, y: p.y * s + oy }))

  const rdy = progress >= 1
  const sc = rdy ? '#22c55e' : '#3b82f6'

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
  ctx.closePath()
  ctx.fillStyle = rdy ? 'rgba(34,197,94,.18)' : 'rgba(59,130,246,.12)'
  ctx.fill()

  ctx.strokeStyle = sc
  ctx.lineWidth = 2.5
  ctx.setLineDash(rdy ? [] : [8, 4])
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])

  // Corner highlights
  const cs = 20
  ctx.lineWidth = 4
  ctx.strokeStyle = rdy ? '#4ade80' : '#60a5fa'
  const dirs = [[1, 1], [-1, 1], [-1, -1], [1, -1]]
  pts.forEach((p, i) => {
    const [dx, dy] = dirs[i]
    ctx.beginPath()
    ctx.moveTo(p.x + dx * cs, p.y)
    ctx.lineTo(p.x, p.y)
    ctx.lineTo(p.x, p.y + dy * cs)
    ctx.stroke()
  })
}

function clearOverlay() {
  const oc = overlayCanvas.value
  if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height)
}

// ── Capture Scaling ─────────────────────────────────────────
function captureScaled(vid, corners) {
  const MAX_W = 800
  if (corners) {
    try {
      const raw = cropDocument(vid, corners)
      const scale = Math.min(1, MAX_W / raw.width)
      const w = Math.round(raw.width * scale)
      const h = Math.round(raw.height * scale)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(raw, 0, 0, w, h)
      return c.toDataURL('image/jpeg', 0.85)
    } catch (err) {
      console.warn('Cropping error, falling back to full scale capture:', err)
    }
  }
  const vid_w = vid.videoWidth, vid_h = vid.videoHeight
  const scale = Math.min(1, MAX_W / vid_w)
  const w = Math.round(vid_w * scale)
  const h = Math.round(vid_h * scale)
  const cv = captureCanvas.value
  cv.width = w
  cv.height = h
  cv.getContext('2d').drawImage(vid, 0, 0, w, h)
  return cv.toDataURL('image/jpeg', 0.85)
}

// ── AI Model Call ───────────────────────────────────────────
let aiTimeoutId = null

async function runAI(corners) {
  const vid = videoEl.value
  if (!vid) {
    isProcessing.value = false
    stopBeep()
    return
  }
  croppedPreview.value = null

  const imageDataUrl = captureScaled(vid, corners)
  croppedPreview.value = imageDataUrl

  if (aiTimeoutId) clearTimeout(aiTimeoutId)
  // Set safety timeout (45s)
  aiTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isProcessing.value = false
      stopBeep()
      announce('Puter AI tidak merespons. Silakan coba kembali.')
    }
  }, 45000)

  try {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text:
          `Kamu adalah asisten pembaca buku untuk penyandang tunanetra.
Gambar mungkin diambil dari sudut/orientasi apapun — baca teks meski terlihat miring atau terbalik.

Tugasmu:
1. Bacakan SEMUA teks dari halaman ini secara lengkap dari atas ke bawah.
2. Sebutkan judul/subjudul dengan jelas sebelum isinya.
3. Jelaskan tabel, daftar, atau diagram secara naratif dan detail.
4. Berikan sedikit insight atau konteks di akhir jika perlu.
5. Jika terlalu panjang, rangkum secara sangat detail.
Gunakan bahasa Indonesia yang baik dan mengalir. Langsung mulai tanpa kata pembuka.` }
      ]
    }]

    const response = await puter.ai.chat(messages, { model: aiModel.value })
    clearTimeout(aiTimeoutId)
    aiTimeoutId = null

    const text = typeof response === 'string'
      ? response
      : (Array.isArray(response?.message?.content)
          ? response.message.content.map(c => c?.text ?? '').join('')
          : null)
        ?? response?.message?.content
        ?? response?.text
        ?? JSON.stringify(response)

    aiResult.value = text
    croppedPreview.value = null
    isProcessing.value = false
    stopBeep()

    playTTS(text, {
      onEnd: () => {
        announce('Selesai membaca.')
      }
    })
  } catch (e) {
    clearTimeout(aiTimeoutId)
    aiTimeoutId = null
    console.error('OCR AI error:', e)
    isProcessing.value = false
    stopBeep()
    const msg = e?.message ?? e?.error?.message ?? ''
    announce('Gagal memindai halaman. ' + (msg ? msg.slice(0, 60) : 'Periksa jaringan internet Anda.'))
  }
}

// ── Control Operations ──────────────────────────────────────
async function startAutoScan() {
  if (!cameraActive.value) await startCamera()
  if (!cameraActive.value) return
  autoScanActive.value = true
  isProcessing.value = false
  stableFrames = 0
  lastCorners = null
  docDetected.value = false
  aiResult.value = ''
  startBeep()
  startLoop()
}

function stopAutoScan() {
  autoScanActive.value = false
  docDetected.value = false
  isProcessing.value = false
  stopLoop()
  clearOverlay()
  stopBeep()
  stableFrames = 0
  lastCorners = null
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId)
    aiTimeoutId = null
  }
}

function toggleAutoScan() {
  if (autoScanActive.value) {
    stopAutoScan()
    announce('Pemindaian otomatis dihentikan.')
  } else {
    startAutoScan()
    announce('Mulai pemindaian otomatis. Arahkan kamera ke halaman buku.')
  }
}

function cancelAI() {
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId)
    aiTimeoutId = null
  }
  isProcessing.value = false
  stopBeep()
  announce('Proses analisis dibatalkan.')
}

async function manualCapture() {
  if (isProcessing.value) return
  if (!cameraActive.value) await startCamera()
  if (!cameraActive.value) return
  stopLoop()
  clearOverlay()
  isProcessing.value = true
  aiResult.value = ''
  startBeep()
  const r = detectDocument(videoEl.value)
  announce('Mengambil gambar.', () => runAI(r?.corners ?? null))
}

function saveCurrentScan() {
  if (aiResult.value) {
    saveToLibrary('', aiResult.value)
  }
}

// ── Playback Controls ───────────────────────────────────────
function pauseReading() {
  pauseTTS()
}

function resumeReading() {
  resumeTTS()
}

function stopReading() {
  stopTTS()
}

function repeatReading() {
  if (aiResult.value) {
    playTTS(aiResult.value, {
      onEnd: () => announce('Selesai membaca.')
    })
  }
}

function handleTap() {
  warmUpTTS()
  if (isSpeaking.value) {
    isPaused.value ? resumeReading() : pauseReading()
    return
  }
  if (isProcessing.value) {
    cancelAI()
    return
  }
  toggleAutoScan()
}

// Global keyboard hooks delegate
function onGlobalKeydown(e) {
  if (e.code === 'Space') {
    e.preventDefault()
    handleTap()
  } else if (e.code === 'Enter') {
    e.preventDefault()
    manualCapture()
  } else if (e.key === 'p' || e.key === 'P') {
    if (isSpeaking.value) {
      isPaused.value ? resumeReading() : pauseReading()
    }
  } else if (e.key === 's' || e.key === 'S') {
    stopReading()
    announce('Bacaan dihentikan.')
  } else if (e.key === 'r' || e.key === 'R') {
    repeatReading()
  }
}

// Expose keydown hook to AppShell
defineExpose({
  onGlobalKeydown
})

onMounted(() => {
  // Start camera on page entry for immersive experience
  startCamera()
})

onUnmounted(() => {
  stopAutoScan()
  stopCamera()
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: transform .25s, opacity .25s; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
