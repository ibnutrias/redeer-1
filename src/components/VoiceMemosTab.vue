<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-950 p-6 text-white">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-xl font-bold text-white flex items-center gap-2">🎤 Perekam Catatan Suara</h2>
      <p class="text-xs text-gray-400">Rekam catatan buku, ringkasan, atau penanda halaman penting tanpa perlu mengetik.</p>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
      <!-- Left side: Large Recording Interface -->
      <div class="flex-1 flex flex-col items-center justify-center bg-gray-900 border border-gray-850 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <!-- Pulse ring animations during recording -->
        <div v-if="isRecording" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="absolute w-56 h-56 rounded-full bg-red-500/10 animate-ping duration-1000"></span>
          <span class="absolute w-40 h-40 rounded-full bg-red-500/20 animate-pulse duration-700"></span>
        </div>

        <div class="z-10 flex flex-col items-center gap-6 text-center">
          <!-- Timer Display -->
          <div class="font-mono text-4xl md:text-5xl font-black tracking-widest" :class="isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500'">
            {{ displayTime }}
          </div>

          <!-- Large Action Button -->
          <button
            @click="toggleRecording"
            class="w-32 h-32 md:w-36 md:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative border-4"
            :class="isRecording
              ? 'bg-red-650 hover:bg-red-700 border-red-500 active:scale-95 shadow-red-500/20'
              : 'bg-primary hover:bg-primary-focus border-primary/40 active:scale-95 shadow-primary/20'"
            :aria-label="isRecording ? 'Hentikan Rekaman' : 'Mulai Rekam Catatan Suara'"
          >
            <span class="text-4xl mb-1">{{ isRecording ? '⏹' : '🎤' }}</span>
            <span class="text-[10px] font-bold uppercase tracking-wider">{{ isRecording ? 'Selesai' : 'Mulai' }}</span>
          </button>

          <!-- Label Guide -->
          <div>
            <p class="text-sm font-semibold text-gray-300">
              {{ isRecording ? 'Sedang merekam suara Anda...' : 'Ketuk tombol besar di atas untuk merekam' }}
            </p>
            <p class="text-[11px] text-gray-500 mt-1">
              Catatan akan langsung tersimpan di daftar sebelah kanan.
            </p>
          </div>
        </div>
      </div>

      <!-- Right side: Registry logs -->
      <div class="w-full lg:w-96 flex flex-col bg-gray-900 border border-gray-850 rounded-2xl overflow-hidden shadow-xl">
        <div class="px-4 py-3 bg-gray-950 border-b border-gray-850 flex items-center justify-between">
          <span class="text-xs font-bold text-primary uppercase tracking-wider">Catatan Tersimpan ({{ memos.length }})</span>
        </div>

        <!-- Memos List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div v-if="memos.length === 0" class="h-full flex flex-col items-center justify-center text-center text-gray-500 py-10">
            <div class="text-5xl mb-3">🎙️</div>
            <p class="text-sm font-semibold text-gray-400">Belum ada rekaman</p>
            <p class="text-xs max-w-xs mx-auto mt-1">Suara rekaman Anda untuk ringkasan buku akan dicatat secara otomatis di sini.</p>
          </div>

          <div
            v-for="memo in memos"
            :key="memo.id"
            class="flex items-center justify-between p-3.5 rounded-xl border border-gray-850 bg-gray-950/40 hover:bg-gray-800/20 transition-all duration-200"
            :class="{ 'border-secondary bg-secondary/5': currentPlaying?.id === memo.id }"
          >
            <!-- Info block -->
            <div class="overflow-hidden mr-2">
              <h3 class="text-xs font-bold text-gray-200 truncate">{{ memo.title }}</h3>
              <div class="flex items-center gap-3 text-[9px] text-gray-500 font-mono mt-1">
                <span>⏱ {{ memo.duration }} detik</span>
                <span>📅 {{ formatTime(memo.timestamp) }}</span>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button
                @click="playMemo(memo)"
                class="btn btn-xs btn-circle text-white font-bold"
                :class="currentPlaying?.id === memo.id ? 'btn-warning' : 'btn-secondary'"
                :title="currentPlaying?.id === memo.id ? 'Pause/Stop' : 'Putar'"
              >
                {{ currentPlaying?.id === memo.id ? '⏸' : '▶' }}
              </button>
              <button
                @click="deleteMemo(memo.id)"
                class="btn btn-xs btn-circle btn-ghost text-red-400 hover:bg-red-950/20"
                title="Hapus"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { announce, warmUpTTS } from '../utils/appState.js'

// ── INDEXED DB UTILS ─────────────────────────────────────────
const DB_NAME = 'readlens_memos_db'
const STORE_NAME = 'memos'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = (e) => resolve(e.target.result)
    request.onerror = (e) => reject(e.target.error)
  })
}

async function getMemosFromDB() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.error('Failed to access IndexedDB:', err)
    return []
  }
}

async function saveMemoToDB(memo) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(memo)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function deleteMemoFromDB(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ── COMPONENT STATES ─────────────────────────────────────────
const memos = ref([])
const isRecording = ref(false)
const recordTime = ref(0)
let timerId = null

// Web Audio / MediaRecorder references
let mediaRecorder = null
let audioChunks = []

// Playback references
const currentPlaying = ref(null)
let activeAudio = null

// Display timer format (MM:SS)
const displayTime = computed(() => {
  const m = Math.floor(recordTime.value / 60).toString().padStart(2, '0')
  const s = (recordTime.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

async function loadMemos() {
  const list = await getMemosFromDB()
  // Sort descending by timestamp
  memos.value = list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

function formatTime(isoStr) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// ── RECORDING CONTROLS ───────────────────────────────────────
async function toggleRecording() {
  warmUpTTS()
  if (isRecording.value) {
    stopRecording()
  } else {
    await startRecording()
  }
}

async function startRecording() {
  stopPlayback()
  audioChunks = []
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      const m = Math.floor(recordTime.value / 60).toString().padStart(2, '0')
      const s = (recordTime.value % 60).toString().padStart(2, '0')
      const durationText = `${m}:${s}`

      const memo = {
        id: Date.now().toString(),
        title: `Catatan Suara ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
        blob: audioBlob,
        duration: durationText,
        timestamp: new Date().toISOString()
      }

      await saveMemoToDB(memo)
      await loadMemos()
      announce('Catatan suara berhasil disimpan.')
    }

    mediaRecorder.start()
    isRecording.value = true
    recordTime.value = 0
    timerId = setInterval(() => {
      recordTime.value++
    }, 1000)
    announce('Mulai merekam suara. Ketuk tombol lagi untuk berhenti.')
  } catch (err) {
    console.error('Mic access error:', err)
    announce('Gagal merekam. Izinkan akses mikrofon di browser Anda.')
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(t => t.stop())
    isRecording.value = false
    clearInterval(timerId)
    announce('Rekaman selesai.')
  }
}

// ── PLAYBACK CONTROLS ────────────────────────────────────────
function playMemo(memo) {
  warmUpTTS()
  if (currentPlaying.value?.id === memo.id) {
    if (activeAudio) {
      if (activeAudio.paused) {
        activeAudio.play()
        announce('Melanjutkan pemutaran.')
      } else {
        activeAudio.pause()
        announce('Pemutaran dijeda.')
      }
    }
    return
  }

  stopPlayback()

  currentPlaying.value = memo
  const url = URL.createObjectURL(memo.blob)
  activeAudio = new Audio(url)
  activeAudio.onended = () => {
    currentPlaying.value = null
    URL.revokeObjectURL(url)
  }
  activeAudio.play()
  announce(`Memutar rekaman ${memo.title}`)
}

function stopPlayback() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
  currentPlaying.value = null
}

async function deleteMemo(id) {
  if (currentPlaying.value?.id === id) {
    stopPlayback()
  }
  await deleteMemoFromDB(id)
  await loadMemos()
  announce('Catatan suara dihapus.')
}

onMounted(() => {
  loadMemos()
})

onUnmounted(() => {
  stopRecording()
  stopPlayback()
})
</script>
