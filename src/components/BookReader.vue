<template>
  <div
    class="bacakan-app h-screen w-screen flex flex-col overflow-hidden bg-gray-950 text-white select-none"
    data-theme="dark"
  >
    <!-- TOP BAR -->
    <div class="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0 z-10">
      <div class="flex items-center gap-3">
        <span class="text-2xl">📖</span>
        <div>
          <p class="font-bold leading-tight text-white">BacaKan</p>
          <p class="text-xs text-gray-400">Pembaca Buku untuk Tunanetra</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span :class="['px-3 py-1 rounded-full text-xs font-bold transition-colors duration-300', statusClass]"
              role="status" aria-live="polite">
          {{ statusLabel }}
        </span>
        <button @click.stop="openAdmin" class="btn btn-ghost btn-xs text-gray-500 hover:text-white" title="Admin (Ctrl+Shift+A)">⚙</button>
      </div>
    </div>

    <!-- CAMERA AREA -->
    <div class="relative flex-1 bg-black overflow-hidden" @click="handleTap">
      <video ref="videoEl" autoplay playsinline muted
        class="absolute inset-0 w-full h-full object-contain"
        :class="{ 'opacity-0': !cameraActive }"
      ></video>

      <!-- Detection overlay canvas -->
      <canvas ref="overlayCanvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>

      <!-- No camera idle state -->
      <div v-if="!cameraActive && !isProcessing" class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-500">
        <div class="text-8xl">📷</div>
        <p class="text-lg font-medium text-center px-6">Sentuh layar atau tekan <kbd class="kbd kbd-sm bg-gray-800 text-white">Space</kbd> untuk mulai</p>
      </div>

      <!-- Processing overlay -->
      <transition name="fade">
        <div v-if="isProcessing" class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/80">
          <span class="loading loading-ring loading-lg text-primary"></span>
          <p class="text-white text-base font-semibold animate-pulse text-center px-4">AI sedang membaca halaman...</p>
          <button @click.stop="cancelAI" class="btn btn-sm btn-outline btn-warning mt-2">Batalkan</button>
        </div>
      </transition>

      <!-- Cropped preview thumbnail -->
      <transition name="fade">
        <div v-if="croppedPreview && !isProcessing"
          class="absolute top-2 right-2 w-32 rounded-lg overflow-hidden border-2 border-green-400 shadow-xl">
          <img :src="croppedPreview" alt="Crop" class="w-full h-auto" />
        </div>
      </transition>

      <!-- AI result text overlay -->
      <transition name="slide-up">
        <div v-if="aiResult && isSpeaking"
          class="absolute bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur-sm border-t border-gray-700 max-h-36 overflow-y-auto p-3"
          aria-live="polite">
          <p class="text-sm text-gray-200 leading-relaxed">{{ aiResult }}</p>
        </div>
      </transition>

      <!-- Detection badge -->
      <div v-if="autoScanActive && !isProcessing"
        class="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 pointer-events-none">
        <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse', docDetected ? 'bg-green-400' : 'bg-gray-400']"></span>
        <span class="text-xs text-white font-medium">{{ docDetected ? 'Dokumen terdeteksi' : 'Mencari...' }}</span>
      </div>

      <!-- AI finished: replay / next page prompt -->
      <div v-if="aiResult && !isSpeaking && !isProcessing && !autoScanActive"
        class="absolute bottom-20 left-0 right-0 flex justify-center gap-3 px-4">
        <button @click.stop="repeatReading" class="btn btn-sm btn-info">🔁 Ulangi</button>
        <button @click.stop="startAutoScan" class="btn btn-sm btn-primary">▶ Halaman berikutnya</button>
      </div>
    </div>

    <!-- BOTTOM BAR -->
    <div class="flex flex-col gap-1 px-4 py-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
      <div class="flex items-center gap-2">
        <button @click.stop="handleTap" :class="['btn btn-sm flex-1', autoScanActive ? 'btn-error' : 'btn-primary']">
          {{ autoScanActive ? '⏹ Stop' : '▶ Auto-Scan' }}
        </button>
        <button @click.stop="manualCapture" class="btn btn-sm btn-secondary" :disabled="!cameraActive || isProcessing">📸</button>
        <template v-if="isSpeaking">
          <button v-if="!isPaused" @click.stop="pauseReading" class="btn btn-sm btn-warning">⏸</button>
          <button v-else          @click.stop="resumeReading" class="btn btn-sm btn-info">▶</button>
          <button @click.stop="stopReading" class="btn btn-sm btn-ghost">⏹</button>
        </template>
      </div>
      <p class="text-xs text-gray-600 text-center pt-0.5 leading-snug">
        Tap/Space=Auto · 📸=Scan manual · P=Jeda · R=Ulangi
      </p>
    </div>

    <AdminPanel v-if="showAdmin"
      v-model:model="aiModel" v-model:delay="scanDelay" v-model:rate="speechRate"
      @close="showAdmin = false" />

    <canvas ref="captureCanvas" class="hidden"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import puter from '@heyputer/puter.js'
import AdminPanel from './AdminPanel.vue'
import { detectDocument, cropDocument } from '../utils/DocumentScanner.js'

// ── DOM Refs ────────────────────────────────────────────────
const videoEl       = ref(null)
const overlayCanvas = ref(null)
const captureCanvas = ref(null)

// ── App State ───────────────────────────────────────────────
let mediaStream      = null
const cameraActive   = ref(false)
const autoScanActive = ref(false)
const isProcessing   = ref(false)
const docDetected    = ref(false)
const isSpeaking     = ref(false)
const isPaused       = ref(false)
const aiResult       = ref('')
const croppedPreview = ref(null)
const showAdmin      = ref(false)

// ── Settings ─────────────────────────────────────────────────
const aiModel    = ref(localStorage.getItem('bacakan_model') ?? 'google/gemini-2.0-flash-lite')
const scanDelay  = ref(Number(localStorage.getItem('bacakan_delay') ?? 2))
const speechRate = ref(Number(localStorage.getItem('bacakan_rate') ?? 1.0))

// ── Status ───────────────────────────────────────────────────
const statusLabel = computed(() => {
  if (isProcessing.value  ) return '🤖 Menganalisis'
  if (isSpeaking.value && !isPaused.value) return '🔊 Membaca'
  if (isPaused.value      ) return '⏸ Dijeda'
  if (autoScanActive.value) return docDetected.value ? '📄 Terdeteksi' : '🔍 Mencari'
  if (cameraActive.value  ) return '📷 Aktif'
  return '⏸ Siap'
})
const statusClass = computed(() => {
  if (isProcessing.value  ) return 'bg-yellow-500 text-black animate-pulse'
  if (isSpeaking.value    ) return 'bg-blue-600 text-white'
  if (docDetected.value   ) return 'bg-green-600 text-white'
  if (autoScanActive.value) return 'bg-indigo-600 text-white'
  if (cameraActive.value  ) return 'bg-red-700 text-white'
  return 'bg-gray-700 text-gray-300'
})

// ── Audio ────────────────────────────────────────────────────
// Plays during detection+analysis. Stops when AI result arrives.
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

// ── TTS ──────────────────────────────────────────────────────
//
// Mobile iOS/Android notes:
//  - iOS requires speak() be inside a synchronous user-gesture call stack.
//    We call a silent utterance in handleTap() to "warm up" the audio engine.
//    After that first warm-up, async calls work for the session.
//  - Chrome Android has a 15-second TTS cutoff bug – we chunk text into sentences
//    and pipe them sequentially to avoid this.
//  - Keep all utterance objects alive in an array to prevent GC dropping them.

let ttsWarmedUp = false
let ttsKillSwitch = false
let ttsChain = []  // keep utterance refs alive (prevents iOS garbage collection)

function warmUpTTS() {
  // MUST be called synchronously inside a user gesture handler.
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
  ttsWarmedUp = true
}

function getVoice() {
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang === 'id-ID')
      ?? voices.find(v => v.lang.startsWith('id'))
      ?? null
}

// Plays text out loud. Chunks it for mobile. Calls onEnd when done.
function playTTS(text, { onEnd } = {}) {
  window.speechSynthesis.cancel()
  ttsChain = []
  ttsKillSwitch = false
  isSpeaking.value = true
  isPaused.value   = false

  const voice  = getVoice()
  // Split on sentence boundaries so no chunk exceeds ~200 chars (mobile safe)
  const chunks = text.match(/[^.!?\n]{1,300}[.!?\n]*/g) ?? [text]

  ttsChain = chunks.map(c => {
    const u    = new SpeechSynthesisUtterance(c.trim())
    u.lang     = 'id-ID'
    u.rate     = speechRate.value
    if (voice) u.voice = voice
    return u
  })

  function next(i) {
    if (ttsKillSwitch || i >= ttsChain.length) {
      isSpeaking.value = false
      isPaused.value   = false
      onEnd?.()
      return
    }
    const u   = ttsChain[i]
    u.onend   = () => next(i + 1)
    u.onerror = () => { isSpeaking.value = false; onEnd?.() }
    window.speechSynthesis.speak(u)
  }

  // A small delay after cancel() lets mobile browser clear its audio queue
  setTimeout(() => next(0), 120)
}

// Quick announcement. Does NOT set isSpeaking.
function announce(text, onEnd = null) {
  if (!text) return
  window.speechSynthesis.cancel()

  const u    = new SpeechSynthesisUtterance(text)
  u.lang     = 'id-ID'
  u.rate     = speechRate.value
  const voice = getVoice(); if (voice) u.voice = voice
  if (onEnd) { u.onend = onEnd; u.onerror = () => onEnd() }

  // Give cancel() time to flush, then speak
  setTimeout(() => window.speechSynthesis.speak(u), 100)
}

// ── Camera ────────────────────────────────────────────────────
async function startCamera() {
  if (cameraActive.value) return
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    videoEl.value.srcObject = mediaStream
    await new Promise(r => { videoEl.value.onloadedmetadata = r })
    cameraActive.value = true
  } catch (e) {
    announce('Gagal buka kamera: ' + e.message)
  }
}

function stopCamera() {
  mediaStream?.getTracks().forEach(t => t.stop())
  mediaStream = null
  if (videoEl.value) videoEl.value.srcObject = null
  cameraActive.value = false
  stopLoop()
}

// ── Detection Loop ─────────────────────────────────────────────
let animId       = null
let stableFrames = 0
let lastTime     = 0
let lastCorners  = null
const NEED       = 15   // ~2.5 seconds at ~6fps

function startLoop() { stopLoop(); loopStep() }
function stopLoop()  { if (animId) { cancelAnimationFrame(animId); animId = null } }

function loopStep() {
  if (!autoScanActive.value || !cameraActive.value || isProcessing.value) return
  animId = requestAnimationFrame(loopStep)
  const now = Date.now()
  if (now - lastTime < 160) return
  lastTime = now

  const vid = videoEl.value
  if (!vid || vid.readyState < 2) return

  const r = detectDocument(vid)
  if (r && r.confidence > 0.08) {
    docDetected.value = true
    lastCorners = r.corners
    stableFrames++
    drawOverlay(r.corners, stableFrames / NEED)

    if (stableFrames >= NEED && !isProcessing.value) {
      stopLoop()
      isProcessing.value = true
      // beep continues during AI analysis (started in startAutoScan)
      announce('Dokumen terdeteksi, memindai.', () => runAI(lastCorners))
    }
  } else {
    docDetected.value = false
    stableFrames = Math.max(0, stableFrames - 2)
    if (stableFrames === 0) clearOverlay()
  }
}

// ── Overlay ────────────────────────────────────────────────────
function drawOverlay(corners, progress) {
  const oc  = overlayCanvas.value
  const vid = videoEl.value
  if (!oc || !vid) return
  oc.width  = vid.clientWidth
  oc.height = vid.clientHeight
  const ctx = oc.getContext('2d')
  ctx.clearRect(0, 0, oc.width, oc.height)

  const sx = oc.width  / vid.videoWidth
  const sy = oc.height / vid.videoHeight
  const s  = Math.min(sx, sy)
  const ox = (oc.width  - vid.videoWidth  * s) / 2
  const oy = (oc.height - vid.videoHeight * s) / 2
  const pts = corners.map(p => ({ x: p.x * s + ox, y: p.y * s + oy }))

  const rdy = progress >= 1
  const sc  = rdy ? '#22c55e' : '#818cf8'

  // Quad fill
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath()
  ctx.fillStyle = rdy ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.12)'; ctx.fill()

  // Quad border
  ctx.strokeStyle = sc; ctx.lineWidth = 2
  ctx.setLineDash(rdy ? [] : [8,4])
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke()
  ctx.setLineDash([])

  // Corner brackets
  const cs = 20; ctx.lineWidth = 3.5; ctx.strokeStyle = rdy ? '#4ade80' : '#a5b4fc'
  const dirs = [[1,1],[-1,1],[-1,-1],[1,-1]]
  pts.forEach((p, i) => {
    const [dx, dy] = dirs[i]
    ctx.beginPath()
    ctx.moveTo(p.x + dx*cs, p.y); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x, p.y + dy*cs)
    ctx.stroke()
  })
}

function clearOverlay() {
  const oc = overlayCanvas.value
  if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height)
}

// ── Image Capture ──────────────────────────────────────────────
// Scale down image to max 800px wide before sending to AI.
// This dramatically reduces payload size on mobile.
function captureScaled(vid, corners) {
  const MAX_W = 800
  if (corners) {
    try {
      const raw = cropDocument(vid, corners)
      const scale = Math.min(1, MAX_W / raw.width)
      const w = Math.round(raw.width  * scale)
      const h = Math.round(raw.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(raw, 0, 0, w, h)
      return c.toDataURL('image/jpeg', 0.85)
    } catch { /* fall through */ }
  }
  // Fallback: full frame scaled
  const vid_w = vid.videoWidth, vid_h = vid.videoHeight
  const scale = Math.min(1, MAX_W / vid_w)
  const w = Math.round(vid_w * scale), h = Math.round(vid_h * scale)
  const cv = captureCanvas.value
  cv.width = w; cv.height = h
  cv.getContext('2d').drawImage(vid, 0, 0, w, h)
  return cv.toDataURL('image/jpeg', 0.85)
}

// ── AI Analysis ────────────────────────────────────────────────
let aiAbort = null   // AbortController
let aiTimeoutId = null

async function runAI(corners) {
  const vid = videoEl.value
  if (!vid) { isProcessing.value = false; stopBeep(); return }
  croppedPreview.value = null

  const imageDataUrl = captureScaled(vid, corners)
  croppedPreview.value = imageDataUrl   // show preview

  // Safety timeout: 45s max
  if (aiTimeoutId) clearTimeout(aiTimeoutId)
  aiTimeoutId = setTimeout(() => {
    if (isProcessing.value) {
      isProcessing.value = false
      stopBeep()
      announce('AI tidak merespons. Coba lagi.')
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

    clearTimeout(aiTimeoutId); aiTimeoutId = null

    const text = typeof response === 'string'
      ? response
      : (Array.isArray(response?.message?.content)
          ? response.message.content.map(c => c?.text ?? '').join('')
          : null)
        ?? response?.message?.content
        ?? response?.text
        ?? JSON.stringify(response)

    aiResult.value       = text
    croppedPreview.value = null
    isProcessing.value   = false
    stopBeep()   // ← beep stops exactly here, when AI result is ready

    playTTS(text, {
      onEnd: () => {
        announce('Selesai. Gunakan tombol untuk lanjutkan.')
      }
    })
  } catch (e) {
    clearTimeout(aiTimeoutId); aiTimeoutId = null
    console.error('[BacaKan] AI error:', e)
    isProcessing.value = false
    stopBeep()
    const msg = e?.message ?? e?.error?.message ?? ''
    announce('Gagal memindai. ' + (msg ? msg.slice(0, 60) : 'Periksa koneksi lalu coba lagi.'))
  }
}

// ── Scan Controls ──────────────────────────────────────────────
async function startAutoScan() {
  if (!cameraActive.value) await startCamera()
  if (!cameraActive.value) return
  autoScanActive.value = true
  isProcessing.value   = false
  stableFrames = 0; lastCorners = null; docDetected.value = false
  aiResult.value = ''
  startBeep()   // starts here, runs through detection AND analysis
  startLoop()
}

function stopAutoScan() {
  autoScanActive.value = false
  docDetected.value    = false
  isProcessing.value   = false
  stopLoop(); clearOverlay(); stopBeep()
  stableFrames = 0; lastCorners = null
  if (aiTimeoutId) { clearTimeout(aiTimeoutId); aiTimeoutId = null }
}

function cancelAI() {
  if (aiTimeoutId) { clearTimeout(aiTimeoutId); aiTimeoutId = null }
  isProcessing.value = false
  stopBeep()
  announce('Analisis dibatalkan. Tap untuk coba lagi.')
}

async function manualCapture() {
  if (isProcessing.value) return
  if (!cameraActive.value) await startCamera()
  if (!cameraActive.value) return
  stopLoop(); clearOverlay()
  isProcessing.value = true
  aiResult.value = ''
  startBeep()
  const r = detectDocument(videoEl.value)
  announce('Memindai.', () => runAI(r?.corners ?? null))
}

// ── TTS Controls ───────────────────────────────────────────────
function pauseReading()  { window.speechSynthesis.pause();  isPaused.value = true  }
function resumeReading() { window.speechSynthesis.resume(); isPaused.value = false }
function stopReading()   {
  ttsKillSwitch = true
  window.speechSynthesis.cancel()
  isSpeaking.value = false; isPaused.value = false
}
function repeatReading() {
  if (!aiResult.value) return
  playTTS(aiResult.value, {
    onEnd: () => announce('Selesai.')
  })
}

// ── Tap / Keyboard ─────────────────────────────────────────────
function handleTap() {
  // ALWAYS warm-up TTS synchronously on every tap (required for iOS Safari)
  warmUpTTS()

  if (showAdmin.value) return

  if (isSpeaking.value) {
    isPaused.value ? resumeReading() : pauseReading()
    return
  }
  if (isProcessing.value) {
    cancelAI()
    return
  }
  autoScanActive.value ? stopAutoScan() : startAutoScan()
}

function openAdmin() { warmUpTTS(); showAdmin.value = true }

function handleKeydown(e) {
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return
  switch (true) {
    case e.code === 'Space':         e.preventDefault(); handleTap(); break
    case e.code === 'Enter':         e.preventDefault(); manualCapture(); break
    case e.key === 'p'||e.key==='P': isSpeaking.value && !isPaused.value ? pauseReading() : resumeReading(); break
    case e.key === 's'||e.key==='S': stopReading(); break
    case e.key === 'r'||e.key==='R': repeatReading(); break
    case e.key === 'Escape':         showAdmin.value ? (showAdmin.value = false) : stopAutoScan(); break
    case e.key === 'A' && e.ctrlKey && e.shiftKey: e.preventDefault(); openAdmin(); break
    case e.key === 'ArrowLeft':
      speechRate.value = Math.max(0.5, +(speechRate.value-.1).toFixed(1))
      announce('Kecepatan ' + speechRate.value.toFixed(1)); break
    case e.key === 'ArrowRight':
      speechRate.value = Math.min(2.5, +(speechRate.value+.1).toFixed(1))
      announce('Kecepatan ' + speechRate.value.toFixed(1)); break
  }
}

// ── Lifecycle ───────────────────────────────────────────────────
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // Trigger voice list load (Android needs this explicit call)
  window.speechSynthesis.getVoices()
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  }
})
onUnmounted(() => {
  stopAutoScan(); stopCamera(); stopReading()
  window.removeEventListener('keydown', handleKeydown)
  if (aiTimeoutId) clearTimeout(aiTimeoutId)
})
</script>

<style scoped>
.bacakan-app { font-family: system-ui, sans-serif; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: transform .25s, opacity .25s; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>