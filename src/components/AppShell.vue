<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-gray-950 text-white font-sans select-none" data-theme="dark">
    <!-- Navbar (Header) -->
    <header class="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-850 flex-shrink-0 z-20 shadow-md">
      <div class="flex items-center gap-3">
        <span class="text-2xl animate-pulse">📖</span>
        <div>
          <h1 class="font-black text-white text-base md:text-lg leading-tight tracking-wide">ReadLens</h1>
          <p class="text-[10px] text-gray-400 font-medium">Pembaca Buku Pintar untuk Tunanetra</p>
        </div>
      </div>

      <!-- Header actions & state badges -->
      <div class="flex items-center gap-3">
        <!-- Status Indicator Badge -->
        <span :class="['px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 shadow-sm border border-black/10', statusClass]"
              role="status" aria-live="polite">
          {{ statusLabel }}
        </span>

        <!-- Settings Button -->
        <button
          @click="openSettings"
          class="btn btn-sm btn-ghost bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-xl flex items-center gap-1.5 px-3 py-1"
          title="Pengaturan Aplikasi (Ctrl+Shift+A)"
        >
          <span>⚙️</span>
          <span class="hidden sm:inline text-xs font-bold">Atur</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Area -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Desktop Sidebar (Left side, hidden on mobile) -->
      <nav class="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-850 p-4 space-y-2.5 flex-shrink-0">
        <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-2">Navigasi Fitur</p>
        
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="switchTab(tab.id)"
          class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 w-full text-left"
          :class="activeTab === tab.id
            ? 'bg-primary text-white shadow-lg shadow-primary/20'
            : 'text-gray-400 hover:text-white hover:bg-gray-850/50'"
        >
          <span class="text-lg">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Active Tab Panel Content -->
      <main class="flex-1 overflow-hidden relative bg-gray-950">
        <keep-alive>
          <component
            :is="currentTabComponent"
            ref="activeTabRef"
          />
        </keep-alive>
      </main>
    </div>

    <!-- Mobile Navigation Tab-Bar (Bottom screen navigation) -->
    <nav class="md:hidden flex justify-around bg-gray-900 border-t border-gray-850 py-2.5 px-2 flex-shrink-0 z-20">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="switchTab(tab.id)"
        class="flex flex-col items-center justify-center gap-1 text-[9px] font-bold py-1 px-2.5 rounded-lg transition-all"
        :class="activeTab === tab.id ? 'text-primary scale-105' : 'text-gray-500'"
      >
        <span class="text-xl">{{ tab.icon }}</span>
        <span>{{ tab.shortLabel }}</span>
      </button>
    </nav>

    <!-- Settings Modal container -->
    <transition name="fade">
      <SettingsModal
        v-if="showSettingsModal"
        @close="showSettingsModal = false"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  isSpeaking,
  isPaused,
  speechRate,
  playTTS,
  pauseTTS,
  resumeTTS,
  stopTTS,
  announce,
  warmUpTTS
} from '../utils/appState.js'

// Import components
import ScannerTab from './ScannerTab.vue'
import UploadTab from './UploadTab.vue'
import VoiceMemosTab from './VoiceMemosTab.vue'
import LibraryTab from './LibraryTab.vue'
import HelpTab from './HelpTab.vue'
import SettingsModal from './SettingsModal.vue'

// Ref to active tab component
const activeTabRef = ref(null)

const activeTab = ref('scanner')
const showSettingsModal = ref(false)

const tabs = [
  { id: 'scanner', label: 'Scanner Kamera', shortLabel: 'Kamera', icon: '📷', component: ScannerTab },
  { id: 'upload', label: 'Unggah Berkas', shortLabel: 'Berkas', icon: '📂', component: UploadTab },
  { id: 'text', label: 'Catatan Suara', shortLabel: 'Catatan', icon: '🎤', component: VoiceMemosTab },
  { id: 'library', label: 'Perpustakaan', shortLabel: 'Library', icon: '📚', component: LibraryTab },
  { id: 'help', label: 'Pusat Bantuan & A11y', shortLabel: 'Bantuan', icon: '♿', component: HelpTab },
]

const currentTabComponent = computed(() => {
  const t = tabs.find(item => item.id === activeTab.value)
  return t ? t.component : ScannerTab
})

// ── Global App Status Badging ──────────────────────────────
const statusLabel = computed(() => {
  if (isSpeaking.value && !isPaused.value) return '🔊 Sedang Membaca'
  if (isPaused.value) return '⏸ Bacaan Dijeda'
  if (activeTab.value === 'scanner') {
    return '📷 Kamera Aktif'
  }
  return '⏸ Siap'
})

const statusClass = computed(() => {
  if (isSpeaking.value && !isPaused.value) return 'bg-blue-600 text-white border-blue-500 animate-pulse'
  if (isPaused.value) return 'bg-yellow-500 text-black border-yellow-400'
  if (activeTab.value === 'scanner') return 'bg-red-700 text-white border-red-650'
  return 'bg-gray-800 text-gray-300 border-gray-750'
})

// Switch tab handler
function switchTab(tabId) {
  warmUpTTS()
  activeTab.value = tabId
  const t = tabs.find(item => item.id === tabId)
  if (t) {
    announce(`Membuka menu ${t.label}`)
  }
}

function openSettings() {
  warmUpTTS()
  showSettingsModal.value = true
  announce('Membuka pengaturan.')
}

// ── Keyboard Shortcuts (A11y centric) ───────────────────────
function handleGlobalKeydown(e) {
  // If keyboard inputs are active, don't trigger shortcuts
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
    if (e.key === 'Escape') {
      showSettingsModal.value = false
    }
    return
  }

  // Ctrl+Shift+A -> Settings
  if (e.key === 'A' && e.ctrlKey && e.shiftKey) {
    e.preventDefault()
    openSettings()
    return
  }

  // Esc -> Close settings
  if (e.key === 'Escape') {
    if (showSettingsModal.value) {
      showSettingsModal.value = false
      announce('Pengaturan ditutup.')
    }
    return
  }

  // Tab cycling via ArrowUp / ArrowDown
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const currentIndex = tabs.findIndex(t => t.id === activeTab.value)
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
    switchTab(tabs[prevIndex].id)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const currentIndex = tabs.findIndex(t => t.id === activeTab.value)
    const nextIndex = (currentIndex + 1) % tabs.length
    switchTab(tabs[nextIndex].id)
    return
  }

  // Playback speeds (Ctrl + ArrowLeft / Ctrl + ArrowRight)
  if (e.key === 'ArrowLeft' && e.ctrlKey) {
    e.preventDefault()
    speechRate.value = Math.max(0.5, +(speechRate.value - 0.1).toFixed(1))
    announce('Kecepatan ' + speechRate.value.toFixed(1) + ' kali.')
    return
  }
  if (e.key === 'ArrowRight' && e.ctrlKey) {
    e.preventDefault()
    speechRate.value = Math.min(2.0, +(speechRate.value + 0.1).toFixed(1))
    announce('Kecepatan ' + speechRate.value.toFixed(1) + ' kali.')
    return
  }

  // Standard TTS overrides
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    isSpeaking.value && !isPaused.value ? pauseTTS() : resumeTTS()
    return
  }
  if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    stopTTS()
    announce('Membaca dihentikan.')
    return
  }

  // Forward specific keyboard signals to active components
  if (activeTab.value === 'scanner' && activeTabRef.value && activeTabRef.value.onGlobalKeydown) {
    activeTabRef.value.onGlobalKeydown(e)
  } else {
    // If not in scanner tab, Space and Enter should route to Scanner Tab automatically
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      switchTab('scanner')
      setTimeout(() => {
        if (activeTabRef.value && activeTabRef.value.onGlobalKeydown) {
          activeTabRef.value.onGlobalKeydown(e)
        }
      }, 300)
    }
  }
}

// ── Focusin screen reader announcer ────────────────────────
function handleFocusIn(e) {
  const el = e.target
  if (!el) return

  let typeLabel = ''
  if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
    typeLabel = 'Tombol'
  } else if (el.tagName === 'SELECT') {
    typeLabel = 'Pilihan'
  } else if (el.tagName === 'INPUT' && el.type === 'range') {
    typeLabel = 'Geser'
  } else if (el.tagName === 'INPUT') {
    typeLabel = 'Isian'
  } else if (el.tagName === 'TEXTAREA') {
    typeLabel = 'Kotak teks'
  }

  let labelText = el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || ''
  labelText = labelText.replace(/[\n\r]+/g, ' ').trim()

  if (labelText) {
    if (el.tagName === 'INPUT' && el.type === 'range') {
      // Find parent labels or text indicators
      const parentText = el.parentElement?.textContent || ''
      const cleanedParent = parentText.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim()
      announce(`Geser, ${cleanedParent || labelText}, nilai saat ini ${el.value}`)
    } else {
      announce(`${typeLabel ? typeLabel + ', ' : ''}${labelText}`)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('focusin', handleFocusIn)
  // Warm up voices
  window.speechSynthesis.getVoices()
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('focusin', handleFocusIn)
  stopTTS()
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
