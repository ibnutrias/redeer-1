<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Panel Admin">
    <div class="bg-base-200 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

      <-5.3#: command not founsh: sh:: command not found Header -->
      <div class="flex items-center justify-between px-6 py-4 bg-base-300 border-b border-base-content/10">
        <span class="text-lg font-bold flex items-center gap-2">⚙️ Panel Admin</span>
        <button @click="$emit('close')" class="btn btn-sm btn-circle btn-ghost" aria-label="Tutup panel admin">✕</button>
      </div>

      <div class="p-6 space-y-6">

        <-5.3#: command not founsh: sh:: command not found Puter Auth -->
        <div class="space-y-2">
          <label class="text-sm font-semibold opacity-70 uppercase tracking-wide">Akun Puter.js</label>
          <div v-if="isSignedIn" class="flex items-center justify-between alert alert-success">
            <span class="text-sm">✅ Masuk sebagai <strong>{{ username }}</strong></span>
            <button @click="signOut" class="btn btn-xs btn-error">Keluar</button>
          </div>
          <div v-else class="flex items-center justify-between alert alert-warning">
            <span class="text-sm">⚠ Belum masuk ke Puter</span>
            <button @click="signIn" class="btn btn-xs btn-primary">Masuk</button>
          </div>
        </div>

        <-5.3#: command not founsh: sh:: command not found AI Model Selection -->
        <div class="space-y-2">
          <label class="text-sm font-semibold opacity-70 uppercase tracking-wide">Model AI</label>
          <select v-model="localModel" class="select select-bordered w-full" aria-label="Pilih model AI">
            <option v-if="models.length === 0" value="google/gemini-flash-1-5">Google Gemini Flash (default)</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name || m.id }}</option>
          </select>
          <div v-if="loadingModels" class="flex items-center gap-2 text-sm opacity-60">
            <span class="loading loading-spinner loading-xs"></span> Memuat daftar model...
          </div>
        </div>

        <-5.3#: command not founsh: sh:: command not found Scan Delay -->
        <div class="space-y-2">
          <label class="text-sm font-semibold opacity-70 uppercase tracking-wide">
            Jeda Setelah Terdeteksi Stabil
            <span class="badge badge-primary badge-sm ml-2">{{ localDelay }}s</span>
          </label>
          <input type="range" min="1" max="8" step="1" v-model.number="localDelay"
            class="range range-primary w-full" aria-label="Jeda deteksi stabil" />
          <div class="flex justify-between text-xs opacity-40">
            <span>1s (Cepat)</span><span>4s</span><span>8s (Lambat)</span>
          </div>
        </div>

        <-5.3#: command not founsh: sh:: command not found TTS Speed -->
        <div class="space-y-2">
          <label class="text-sm font-semibold opacity-70 uppercase tracking-wide">
            Kecepatan Suara
            <span class="badge badge-secondary badge-sm ml-2">{{ localRate.toFixed(1) }}×</span>
          </label>
          <input type="range" min="0.6" max="1.8" step="0.1" v-model.number="localRate"
            class="range range-secondary w-full" aria-label="Kecepatan suara" />
        </div>

        <-5.3#: command not founsh: sh:: command not found Save -->
        <button @click="save" class="btn btn-primary w-full">💾 Simpan &amp; Tutup</button>

        <-5.3#: command not founsh: sh:: command not found Keyboard hint -->
        <p class="text-xs text-center opacity-40">Tekan <kbd class="kbd kbd-xs">Escape</kbd> untuk menutup</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import puter from '@heyputer/puter.js'

const props = defineProps({
  model: { type: String, default: 'google/gemini-flash-1-5' },
  delay: { type: Number, default: 3 },
  rate:  { type: Number, default: 1.0 },
})
const emit = defineEmits(['close', 'update:model', 'update:delay', 'update:rate'])

const isSignedIn = ref(false)
const username   = ref('')
const models     = ref([])
const loadingModels = ref(false)

const localModel = ref(props.model)
const localDelay = ref(props.delay)
const localRate  = ref(props.rate)

async function checkAuth() {
  try {
    isSignedIn.value = puter.auth.isSignedIn()
    if (isSignedIn.value) {
      const user = await puter.auth.getUser()
      username.value = user?.username ?? 'Pengguna'
    }
  } catch {}
}

async function fetchModels() {
  loadingModels.value = true
  try {
    const list = await puter.ai.listModels()
    models.value = list ?? []
  } catch { models.value = [] }
  finally { loadingModels.value = false }
}

async function signIn() {
  try { await puter.auth.signIn(); await checkAuth(); await fetchModels() } catch {}
}

async function signOut() {
  try { await puter.auth.signOut(); isSignedIn.value = false; username.value = '' } catch {}
}

function save() {
  emit('update:model', localModel.value)
  emit('update:delay', localDelay.value)
  emit('update:rate',  localRate.value)
  emit('close')
}

onMounted(async () => {
  await checkAuth()
  if (isSignedIn.value) await fetchModels()
})
</script>
