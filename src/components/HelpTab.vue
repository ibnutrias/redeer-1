<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-950 p-6 text-white">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-xl font-bold text-white flex items-center gap-2">♿ Pusat Bantuan &amp; Aksesibilitas</h2>
      <p class="text-xs text-gray-400">Panduan tombol pintas keyboard dan uji diagnostik fitur perangkat Anda.</p>
    </div>

    <!-- Scrollable Grid content -->
    <div class="flex-1 overflow-y-auto space-y-6">
      <!-- Keyboard shortcuts & diagnostics grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Keyboard shortcuts card -->
        <div class="bg-gray-900 border border-gray-850 p-5 rounded-2xl shadow-lg space-y-4">
          <h3 class="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">⌨️ Pintasan Keyboard (Shortcuts)</h3>
          
          <div class="space-y-2.5">
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Pindah Halaman Menu Utama</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">↑ Up</kbd>
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">↓ Down</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Auto-Scan / Jeda Kamera</span>
              <kbd class="kbd kbd-sm bg-gray-950 text-white font-mono border-gray-850">Space</kbd>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Scan Manual / Ambil Foto</span>
              <kbd class="kbd kbd-sm bg-gray-950 text-white font-mono border-gray-850">Enter</kbd>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Jeda / Lanjutkan Membaca</span>
              <kbd class="kbd kbd-sm bg-gray-950 text-white font-mono border-gray-850">P</kbd>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Ulangi Membaca Teks</span>
              <kbd class="kbd kbd-sm bg-gray-950 text-white font-mono border-gray-850">R</kbd>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Hentikan Pembacaan</span>
              <kbd class="kbd kbd-sm bg-gray-950 text-white font-mono border-gray-850">S</kbd>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Buka Panel Pengaturan</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">Ctrl</kbd>
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">Shift</kbd>
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">A</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center pb-2 border-b border-gray-850">
              <span class="text-xs text-gray-300">Kurangi Kecepatan Suara</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">Ctrl</kbd>
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">← Left</kbd>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-300">Tambah Kecepatan Suara</span>
              <div class="flex gap-1">
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">Ctrl</kbd>
                <kbd class="kbd kbd-xs bg-gray-950 text-white font-mono border-gray-850">Right →</kbd>
              </div>
            </div>
          </div>
        </div>

        <!-- Hardware diagnostics card -->
        <div class="bg-gray-900 border border-gray-850 p-5 rounded-2xl shadow-lg space-y-4">
          <h3 class="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">🛠️ Uji Diagnostik Sistem</h3>
          
          <div class="space-y-4">
            <!-- Speech API test -->
            <div class="space-y-2">
              <p class="text-xs font-semibold text-gray-300">1. Uji Suara (Text-to-Speech)</p>
              <div class="flex gap-2">
                <button @click="testSpeech" class="btn btn-sm btn-secondary text-white font-semibold flex-1 rounded-xl">
                  🔊 Uji Suara
                </button>
                <button @click="stopTestSpeech" class="btn btn-sm btn-ghost text-red-500 rounded-xl" :disabled="!isSpeaking">
                  ✕ Stop
                </button>
              </div>
              <p class="text-[10px] text-gray-500 leading-relaxed">Ketuk tombol di atas untuk memastikan browser Anda dapat memproses suara pembaca.</p>
            </div>

            <!-- Camera API test -->
            <div class="space-y-2">
              <p class="text-xs font-semibold text-gray-300">2. Uji Status Kamera</p>
              <button @click="testCamera" class="btn btn-sm btn-outline btn-secondary w-full font-semibold rounded-xl">
                📷 Periksa Kamera
              </button>
              <div v-if="cameraLogs" class="alert bg-gray-950 border-gray-850 p-2.5 rounded-xl font-mono text-[9px] text-gray-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                {{ cameraLogs }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TTS Voices Listing card -->
      <div class="bg-gray-900 border border-gray-850 p-5 rounded-2xl shadow-lg space-y-4">
        <h3 class="text-sm font-bold text-accent uppercase tracking-wider flex items-center gap-2">🗣️ Daftar Suara Sistem Terdeteksi ({{ systemVoices.length }})</h3>
        <p class="text-xs text-gray-400">Berikut adalah suara Text-to-Speech (TTS) yang tersedia secara lokal pada perangkat Anda.</p>
        
        <div class="max-h-[250px] overflow-y-auto border border-gray-850 rounded-xl divide-y divide-gray-850">
          <div v-for="voice in systemVoices" :key="voice.name" class="p-3 bg-gray-950/40 flex justify-between items-center text-xs">
            <div>
              <p class="font-semibold text-gray-200">{{ voice.name }}</p>
              <p class="text-[10px] text-gray-500 font-mono">Kode Bahasa: {{ voice.lang }} · Status: {{ voice.localService ? 'Lokal' : 'Layanan Cloud' }}</p>
            </div>
            <button @click="testVoice(voice)" class="btn btn-xs btn-outline btn-accent rounded-lg">Uji Suara Ini</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  isSpeaking,
  playTTS,
  stopTTS,
  announce,
  getAvailableVoices,
  warmUpTTS
} from '../utils/appState.js'

const cameraLogs = ref('')
const systemVoices = ref([])

function loadVoices() {
  systemVoices.value = getAvailableVoices()
}

function testSpeech() {
  warmUpTTS()
  playTTS('Halo! Uji suara berhasil. Aplikasi ReadLens siap digunakan untuk membantu Anda membaca buku.', {
    onEnd: () => announce('Uji suara selesai.')
  })
}

function stopTestSpeech() {
  stopTTS()
}

async function testCamera() {
  cameraLogs.value = 'Memeriksa perangkat video...'
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = devices.filter(d => d.kind === 'videoinput')
    
    if (videoDevices.length === 0) {
      cameraLogs.value = '❌ Tidak ditemukan perangkat kamera video input.'
      announce('Uji kamera: tidak ada kamera terdeteksi.')
      return
    }

    let logText = `✅ Kamera Terdeteksi (${videoDevices.length}):\n`
    videoDevices.forEach((dev, idx) => {
      logText += `[${idx + 1}] ${dev.label || 'Kamera Generik'} (ID: ${dev.deviceId.slice(0, 10)}...)\n`
    })

    // Try request permissions
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    logText += `\n✅ Akses kamera berhasil diberikan.`
    stream.getTracks().forEach(t => t.stop())
    cameraLogs.value = logText
    announce('Kamera berhasil terdeteksi dan diuji.')
  } catch (err) {
    cameraLogs.value = `❌ Gagal membuka kamera:\nError: ${err.message}`
    announce('Gagal memverifikasi kamera.')
  }
}

function testVoice(voice) {
  warmUpTTS()
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance('Halo! Saya adalah pengisi suara dari ' + voice.name)
  u.lang = voice.lang
  u.voice = voice
  window.speechSynthesis.speak(u)
}

onMounted(() => {
  loadVoices()
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>
