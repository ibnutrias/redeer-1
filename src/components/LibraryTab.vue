<template>
  <div class="h-full flex flex-col overflow-hidden bg-gray-950 p-6 text-white">
    <!-- Header -->
    <div class="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-white flex items-center gap-2">📚 Perpustakaan &amp; Riwayat</h2>
        <p class="text-xs text-gray-400">Daftar buku atau halaman dokumen yang pernah Anda simpan.</p>
      </div>
      <!-- Search -->
      <div class="relative w-full md:w-72">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari judul..."
          class="input input-sm input-bordered w-full pl-8 bg-gray-900 border-gray-800 focus:outline-none focus:border-primary text-gray-200"
          aria-label="Cari di perpustakaan"
        />
        <span class="absolute left-2.5 top-2 text-gray-500 text-xs">🔍</span>
      </div>
    </div>

    <!-- Main Section Split -->
    <div class="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
      <!-- Left side: List -->
      <div class="flex-1 flex flex-col bg-gray-900 border border-gray-850 rounded-2xl overflow-hidden shadow-xl min-h-0">
        <div class="px-4 py-3 bg-gray-950 border-b border-gray-850 flex items-center justify-between">
          <span class="text-xs font-bold text-primary uppercase tracking-wider">Koleksi Bacaan ({{ filteredItems.length }})</span>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          <div v-if="filteredItems.length === 0" class="h-full flex flex-col items-center justify-center text-center text-gray-500 py-10">
            <div class="text-5xl mb-3">📚</div>
            <p class="text-sm font-semibold text-gray-400">Perpustakaan kosong</p>
            <p class="text-xs max-w-xs mx-auto mt-1">Gunakan tab Kamera Scanner atau Papan Baca untuk menyimpan dokumen baru di sini.</p>
          </div>

          <div
            v-for="item in filteredItems"
            :key="item.id"
            @click="selectItem(item)"
            class="flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 bg-gray-950/40 hover:bg-gray-800/30"
            :class="selectedItem?.id === item.id ? 'border-primary bg-primary/5' : 'border-gray-850'"
          >
            <div class="overflow-hidden mr-2">
              <h3 class="text-sm font-semibold text-gray-200 truncate">{{ item.title }}</h3>
              <div class="flex items-center gap-3 text-[10px] text-gray-500 font-mono mt-1">
                <span>📅 {{ formatDate(item.timestamp) }}</span>
                <span>🔤 {{ item.charCount }} karakter</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button @click.stop="quickPlay(item)" class="btn btn-xs btn-circle btn-primary" title="Putar Cepat">▶</button>
              <button @click.stop="deleteItem(item.id)" class="btn btn-xs btn-circle btn-ghost text-red-400 hover:bg-red-950/20" title="Hapus">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Selected Item Detail Reader -->
      <div class="w-full md:w-96 flex flex-col bg-gray-900 border border-gray-850 rounded-2xl overflow-hidden shadow-xl">
        <div class="px-4 py-3 bg-gray-950 border-b border-gray-850 flex items-center justify-between">
          <span class="text-xs font-bold text-secondary uppercase tracking-wider">Detail Dokumen</span>
          <div v-if="selectedItem" class="flex gap-1.5">
            <button @click="downloadTxt(selectedItem)" class="btn btn-xs btn-outline btn-secondary text-[10px]" title="Unduh File Teks">📥 Ekspor</button>
            <button @click="deleteItem(selectedItem.id)" class="btn btn-xs btn-error text-[10px] text-white">Hapus</button>
          </div>
        </div>

        <div class="flex-1 p-4 overflow-y-auto min-h-[200px] md:min-h-0">
          <div v-if="selectedItem" class="space-y-4">
            <!-- Edit Title -->
            <div class="flex gap-2">
              <input
                v-model="editTitle"
                type="text"
                class="input input-sm input-bordered flex-1 bg-gray-950 border-gray-800 focus:outline-none focus:border-secondary text-xs text-white"
                placeholder="Ubah judul..."
                aria-label="Ubah judul dokumen"
              />
              <button @click="updateTitle" class="btn btn-xs btn-secondary h-8 px-3 font-semibold rounded-lg">Ubah</button>
            </div>

            <!-- Content text block -->
            <div class="bg-gray-950/50 border border-gray-850 rounded-xl p-3.5 text-xs text-gray-300 leading-relaxed font-sans max-h-96 overflow-y-auto whitespace-pre-wrap select-text">
              {{ selectedItem.text }}
            </div>
          </div>

          <div v-else class="h-full flex flex-col items-center justify-center text-center text-gray-500 py-10">
            <div class="text-4xl mb-2">📖</div>
            <p class="text-xs">Pilih dokumen di sebelah kiri untuk membaca secara detail dan memutarnya.</p>
          </div>
        </div>

        <!-- TTS Control Panel -->
        <div v-if="selectedItem" class="p-4 bg-gray-950 border-t border-gray-850 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <button @click="playCurrent" class="btn btn-sm btn-secondary text-white flex-1 font-semibold rounded-lg">
              🔊 Bacakan Buku
            </button>
            
            <template v-if="isSpeaking">
              <button v-if="!isPaused" @click="pauseReading" class="btn btn-sm btn-warning text-white rounded-lg px-3">⏸ Jeda</button>
              <button v-else          @click="resumeReading" class="btn btn-sm btn-success text-white rounded-lg px-3">▶ Lanjut</button>
              <button @click="stopReading" class="btn btn-sm btn-ghost text-red-500 rounded-lg">⏹ Stop</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  libraryItems,
  removeFromLibrary,
  renameLibraryItem,
  isSpeaking,
  isPaused,
  playTTS,
  pauseTTS,
  resumeTTS,
  stopTTS,
  announce,
  warmUpTTS
} from '../utils/appState.js'

const searchQuery = ref('')
const selectedItem = ref(null)
const editTitle = ref('')

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return libraryItems.value
  return libraryItems.value.filter(item => item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query))
})

// Auto select first item if available and none selected
watch(libraryItems, (newVal) => {
  if (selectedItem.value) {
    // If selected item was deleted, clear selection
    const exists = newVal.some(i => i.id === selectedItem.value.id)
    if (!exists) {
      selectedItem.value = null
      editTitle.value = ''
    }
  }
}, { deep: true })

function selectItem(item) {
  warmUpTTS()
  selectedItem.value = item
  editTitle.value = item.title
  announce(`Membuka dokumen ${item.title}`)
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function quickPlay(item) {
  warmUpTTS()
  selectedItem.value = item
  editTitle.value = item.title
  playTTS(item.text, {
    onEnd: () => announce('Selesai membaca perpustakaan.')
  })
}

function playCurrent() {
  if (selectedItem.value) {
    playTTS(selectedItem.value.text, {
      onEnd: () => announce('Selesai membaca perpustakaan.')
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

function updateTitle() {
  if (selectedItem.value && editTitle.value.trim()) {
    renameLibraryItem(selectedItem.value.id, editTitle.value)
  }
}

function deleteItem(id) {
  removeFromLibrary(id)
}

function downloadTxt(item) {
  try {
    const blob = new Blob([item.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    announce('File berhasil diekspor.')
  } catch (err) {
    announce('Gagal mengekspor file.')
  }
}

onUnmounted(() => {
  stopReading()
})
</script>
