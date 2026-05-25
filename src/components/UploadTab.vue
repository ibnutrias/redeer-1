<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-950 p-6 text-white">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-xl font-bold text-white flex items-center gap-2">📂 Unggah Dokumen</h2>
      <p class="text-xs text-gray-400">Unggah foto halaman buku (JPG, PNG) untuk diekstraksi teksnya oleh AI.</p>
    </div>

    <!-- Main Container -->
    <div class="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
      <!-- Left side: Dropzone / Preview -->
      <div class="flex-1 flex flex-col gap-4 overflow-hidden">
        <!-- Dropzone -->
        <div
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
          class="flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 bg-gray-900/40 relative overflow-hidden"
          :class="[
            isDragging ? 'border-primary bg-primary/5' : 'border-gray-800 hover:border-gray-600',
            previewUrl ? 'min-h-[200px] max-h-[300px]' : ''
          ]"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileSelect"
          />

          <div v-if="!previewUrl" class="space-y-3 pointer-events-none">
            <div class="text-6xl">📤</div>
            <p class="text-sm font-semibold text-gray-300">Tarik &amp; lepas gambar di sini, atau ketuk untuk memilih</p>
            <p class="text-xs text-gray-500">Mendukung file gambar PNG, JPG, JPEG hingga 10MB</p>
          </div>

          <div v-else class="w-full h-full flex items-center justify-center relative group">
            <img :src="previewUrl" alt="Preview Dokumen" class="max-w-full max-h-full object-contain rounded-xl shadow-lg" />
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-xl">
              <span class="text-xs font-bold text-white bg-red-650 px-3 py-1.5 rounded-lg">Ganti Gambar</span>
            </div>
          </div>
        </div>

        <!-- File Metadata & Extract Trigger -->
        <div v-if="previewUrl" class="flex items-center justify-between bg-gray-900 border border-gray-850 p-4 rounded-xl">
          <div class="overflow-hidden mr-2">
            <p class="text-sm font-semibold text-gray-200 truncate">{{ fileName }}</p>
            <p class="text-[10px] text-gray-500 font-mono">{{ fileSize }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="clearFile" class="btn btn-sm btn-ghost text-red-400">Hapus</button>
            <button @click="runOCR" :disabled="isProcessing" class="btn btn-sm btn-primary text-white font-bold px-4">
              <span v-if="isProcessing" class="loading loading-spinner loading-xs"></span>
              {{ isProcessing ? 'Membaca...' : '🤖 Baca dengan AI' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right side: OCR Result Panel -->
      <div class="w-full lg:w-96 flex flex-col bg-gray-900 border border-gray-850 rounded-2xl overflow-hidden shadow-xl">
        <div class="px-4 py-3 bg-gray-950 border-b border-gray-850 flex items-center justify-between">
          <span class="text-xs font-bold text-primary uppercase tracking-wider">Hasil Ekstraksi</span>
          <button
            v-if="ocrResult"
            @click="saveResult"
            class="btn btn-xs btn-outline btn-primary text-[10px] rounded-lg"
          >
            💾 Simpan ke Perpustakaan
          </button>
        </div>

        <!-- Result Text Area -->
        <div class="flex-1 p-4 overflow-y-auto min-h-[150px] lg:min-h-0">
          <div v-if="isProcessing" class="h-full flex flex-col items-center justify-center gap-3 py-10">
            <span class="loading loading-ring loading-md text-primary"></span>
            <p class="text-xs text-gray-400 animate-pulse text-center">Sedang memproses OCR gambar...</p>
          </div>
          <p v-else-if="ocrResult" class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
            {{ ocrResult }}
          </p>
          <div v-else class="h-full flex flex-col items-center justify-center text-center text-gray-500 py-10">
            <div class="text-4xl mb-2">📄</div>
            <p class="text-xs">Unggah gambar di kiri kemudian klik tombol "Baca dengan AI" untuk melihat hasil teks.</p>
          </div>
        </div>

        <!-- Audio Player Controls -->
        <div v-if="ocrResult" class="p-4 bg-gray-950 border-t border-gray-850 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <button @click="repeatReading" class="btn btn-sm btn-info text-white flex-1 font-semibold rounded-lg">
              🔁 Replay
            </button>
            <template v-if="isSpeaking">
              <button v-if="!isPaused" @click="pauseReading" class="btn btn-sm btn-warning text-white font-semibold rounded-lg px-3">⏸ Jeda</button>
              <button v-else          @click="resumeReading" class="btn btn-sm btn-success text-white font-semibold rounded-lg px-3">▶ Lanjut</button>
              <button @click="stopReading" class="btn btn-sm btn-ghost text-red-500 rounded-lg">⏹ Stop</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import puter from '@heyputer/puter.js'
import {
  aiModel,
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

const fileInput = ref(null)
const isDragging = ref(false)
const previewUrl = ref(null)
const fileName = ref('')
const fileSize = ref('')
const fileDataUrl = ref(null)

const isProcessing = ref(false)
const ocrResult = ref('')

function triggerFileInput() {
  warmUpTTS()
  fileInput.value?.click()
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) loadFile(file)
}

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    announce('Hanya file gambar yang didukung.')
    return
  }
  fileName.value = file.name
  fileSize.value = (file.size / 1024 / 1024).toFixed(2) + ' MB'

  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target.result
    fileDataUrl.value = e.target.result
    announce('Gambar berhasil dimuat. Siap dibaca dengan AI.')
  }
  reader.readAsDataURL(file)
}

function clearFile() {
  previewUrl.value = null
  fileName.value = ''
  fileSize.value = ''
  fileDataUrl.value = null
  ocrResult.value = ''
  stopReading()
  announce('Berkas dihapus.')
}

async function runOCR() {
  if (!fileDataUrl.value || isProcessing.value) return
  isProcessing.value = true
  ocrResult.value = ''
  announce('Memulai ekstraksi AI.')

  try {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: fileDataUrl.value } },
        { type: 'text', text:
          `Kamu adalah asisten pembaca halaman buku untuk tunanetra.
Ekstrak seluruh tulisan yang ada pada gambar dokumen/buku ini secara lengkap dan akurat.
Bacakan secara berurutan. Berikan hasil pembacaan langsung tanpa ada sapaan pembuka.` }
      ]
    }]

    const response = await puter.ai.chat(messages, { model: aiModel.value })

    const text = typeof response === 'string'
      ? response
      : (Array.isArray(response?.message?.content)
          ? response.message.content.map(c => c?.text ?? '').join('')
          : null)
        ?? response?.message?.content
        ?? response?.text
        ?? JSON.stringify(response)

    ocrResult.value = text
    isProcessing.value = false

    playTTS(text, {
      onEnd: () => {
        announce('Selesai membaca berkas.')
      }
    })
  } catch (err) {
    console.error('File OCR error:', err)
    isProcessing.value = false
    announce('Gagal mengekstrak teks. Silakan coba kembali.')
  }
}

function saveResult() {
  if (ocrResult.value) {
    saveToLibrary(fileName.value.split('.')[0], ocrResult.value)
  }
}

// Playback controls
function repeatReading() {
  if (ocrResult.value) {
    playTTS(ocrResult.value, {
      onEnd: () => announce('Selesai membaca berkas.')
    })
  }
}

function pauseReading() {
  pauseTTS()
}

function resumeReading() {
  resumeTTS()
}

function stopReading() {
  stopTTS()
}

onUnmounted(() => {
  stopReading()
})
</script>
