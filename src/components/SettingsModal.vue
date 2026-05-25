<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Pengaturan Aplikasi">
    <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 bg-gray-950 border-b border-gray-800">
        <span class="text-lg font-bold flex items-center gap-2">⚙️ Pengaturan ReadLens</span>
        <button @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost text-gray-400 hover:text-white" aria-label="Tutup pengaturan">✕</button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
        <!-- Puter.js Auth -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Koneksi Puter.js</label>
          <div v-if="isSignedIn" class="flex items-center justify-between alert bg-green-950/40 border border-green-800 text-green-300 rounded-xl p-3">
            <span class="text-sm">Masuk sebagai: <strong>{{ username }}</strong></span>
            <button @click="signOut" class="btn btn-xs btn-error">Keluar</button>
          </div>
          <div v-else class="flex items-center justify-between alert bg-yellow-950/40 border border-yellow-800 text-yellow-300 rounded-xl p-3">
            <span class="text-sm block">Belum masuk ke Puter.js</span>
            <button @click="signIn" class="btn btn-xs btn-primary font-bold">Masuk</button>
          </div>
        </div>

        <!-- AI Model -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Model Kecerdasan Buatan (AI)</label>
          <select v-model="aiModel" class="select select-bordered w-full bg-gray-950 border-gray-800 text-white focus:outline-none focus:border-primary" aria-label="Pilih model AI">
            <option value="google/gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Sangat Cepat)</option>
            <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="google/gemini-1.5-flash">Gemini 1.5 Flash (Default)</option>
            <option value="google/gemini-1.5-pro">Gemini 1.5 Pro (Akurat/Lambat)</option>
            <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.name || m.id }}</option>
          </select>
          <div v-if="loadingModels" class="flex items-center gap-2 text-xs text-gray-400 px-1">
            <span class="loading loading-spinner loading-xs text-primary"></span> Memuat daftar model...
          </div>
        </div>

        <!-- Text-to-Speech Engine Voice -->
        <div class="space-y-2">
          <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Suara Pembaca (TTS Voice)</label>
          <select v-model="speechVoiceName" class="select select-bordered w-full bg-gray-950 border-gray-800 text-white focus:outline-none focus:border-secondary" aria-label="Pilih suara pembaca">
            <option value="">Default Sistem (Indonesia)</option>
            <option v-for="v in voices" :key="v.name" :value="v.name">
              {{ v.name }} ({{ v.lang }})
            </option>
          </select>
        </div>

        <!-- Jeda Deteksi Stabil -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Jeda Scan Otomatis</label>
            <span class="badge badge-primary font-mono text-xs">{{ scanDelay }}s</span>
          </div>
          <input type="range" min="1" max="8" step="1" v-model.number="scanDelay"
            class="range range-primary w-full bg-gray-800" aria-label="Jeda deteksi stabil" />
          <div class="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span>1 detik (Cepat)</span>
            <span>4s</span>
            <span>8 detik (Statis)</span>
          </div>
        </div>

        <!-- Kecepatan Suara -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kecepatan Membaca (Speed)</label>
            <span class="badge badge-secondary font-mono text-xs">{{ speechRate.toFixed(1) }}×</span>
          </div>
          <input type="range" min="0.5" max="2.0" step="0.1" v-model.number="speechRate"
            class="range range-secondary w-full bg-gray-800" aria-label="Kecepatan suara" />
          <div class="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span>0.5× (Lambat)</span>
            <span>1.0× (Normal)</span>
            <span>2.0× (Cepat)</span>
          </div>
        </div>

        <!-- Nada Suara (Pitch) -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tinggi Nada (Pitch)</label>
            <span class="badge badge-accent font-mono text-xs">{{ speechPitch.toFixed(1) }}×</span>
          </div>
          <input type="range" min="0.5" max="1.5" step="0.1" v-model.number="speechPitch"
            class="range range-accent w-full bg-gray-800" aria-label="Tinggi nada suara" />
          <div class="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span>0.5× (Ngebass)</span>
            <span>1.0× (Normal)</span>
            <span>1.5× (Melengking)</span>
          </div>
        </div>

        <!-- Shortcut Guide snippet -->
        <div class="alert bg-gray-950/60 border border-gray-800 rounded-xl p-3 text-xs text-gray-400 space-y-1">
          <p class="font-semibold text-gray-300">💡 Aksesibilitas:</p>
          <p>Tekan <kbd class="kbd kbd-xs bg-gray-800 text-white">Esc</kbd> untuk menutup panel ini.</p>
          <p>Tekan <kbd class="kbd kbd-xs bg-gray-800 text-white">Ctrl + Shift + A</kbd> dari halaman manapun untuk membuka pengaturan.</p>
        </div>

        <button @click="save" class="btn btn-primary w-full text-white font-bold rounded-xl mt-4">
          💾 Simpan &amp; Tutup
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  aiModel,
  scanDelay,
  speechRate,
  speechPitch,
  speechVoiceName,
  isSignedIn,
  username,
  availableModels,
  loadingModels,
  checkAuth,
  fetchModels,
  signIn,
  signOut,
  getAvailableVoices,
  announce
} from '../utils/appState.js'

const emit = defineEmits(['close'])

const voices = ref([])

function loadVoices() {
  voices.value = getAvailableVoices()
}

function save() {
  announce('Pengaturan berhasil disimpan.')
  emit('close')
}

onMounted(async () => {
  await checkAuth()
  if (isSignedIn.value) {
    await fetchModels()
  }
  loadVoices()
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})
</script>
