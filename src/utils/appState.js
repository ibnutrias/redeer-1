import { ref, reactive, computed, watch } from 'vue'
import puter from '@heyputer/puter.js'

// ── SETTINGS STATE ──────────────────────────────────────────
export const aiModel = ref(localStorage.getItem('bacakan_model') ?? 'google/gemini-2.0-flash-lite')
export const scanDelay = ref(Number(localStorage.getItem('bacakan_delay') ?? 2))
export const speechRate = ref(Number(localStorage.getItem('bacakan_rate') ?? 1.0))
export const speechPitch = ref(Number(localStorage.getItem('bacakan_pitch') ?? 1.0))
export const speechVoiceName = ref(localStorage.getItem('bacakan_voice') ?? '')

// Watch settings and sync with localStorage
watch(aiModel, (val) => localStorage.setItem('bacakan_model', val))
watch(scanDelay, (val) => localStorage.setItem('bacakan_delay', val))
watch(speechRate, (val) => localStorage.setItem('bacakan_rate', val.toString()))
watch(speechPitch, (val) => localStorage.setItem('bacakan_pitch', val.toString()))
watch(speechVoiceName, (val) => localStorage.setItem('bacakan_voice', val))

// ── PUTER AUTH STATE ────────────────────────────────────────
export const isSignedIn = ref(false)
export const username = ref('')
export const availableModels = ref([])
export const loadingModels = ref(false)

export async function checkAuth() {
  try {
    isSignedIn.value = puter.auth.isSignedIn()
    if (isSignedIn.value) {
      const user = await puter.auth.getUser()
      username.value = user?.username ?? 'Pengguna'
    } else {
      username.value = ''
    }
  } catch (e) {
    console.error('Error checking auth:', e)
  }
}

export async function fetchModels() {
  loadingModels.value = true
  try {
    const list = await puter.ai.listModels()
    availableModels.value = list ?? []
  } catch (e) {
    console.error('Error listing models:', e)
    availableModels.value = []
  } finally {
    loadingModels.value = false
  }
}

export async function signIn() {
  try {
    await puter.auth.signIn()
    await checkAuth()
    if (isSignedIn.value) {
      await fetchModels()
      announce('Berhasil masuk ke akun Puter.')
    }
  } catch (e) {
    announce('Gagal masuk ke Puter.')
  }
}

export async function signOut() {
  try {
    await puter.auth.signOut()
    isSignedIn.value = false
    username.value = ''
    announce('Berhasil keluar dari akun Puter.')
  } catch (e) {
    announce('Gagal keluar dari Puter.')
  }
}

// ── TTS ENGINE ──────────────────────────────────────────────
export const isSpeaking = ref(false)
export const isPaused = ref(false)
export const currentText = ref('')
let ttsChain = []
let ttsKillSwitch = false
let ttsWarmedUp = false

export function warmUpTTS() {
  if (ttsWarmedUp) return
  // Requires synchronous call in user gesture
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
  ttsWarmedUp = true
}

export function getAvailableVoices() {
  return window.speechSynthesis.getVoices()
}

function getVoice() {
  const voices = getAvailableVoices()
  if (speechVoiceName.value) {
    const found = voices.find(v => v.name === speechVoiceName.value)
    if (found) return found
  }
  // Fallbacks: Indonesian language
  return voices.find(v => v.lang === 'id-ID')
      ?? voices.find(v => v.lang.startsWith('id'))
      ?? voices.find(v => v.lang.startsWith('en')) // final fallback
      ?? null
}

export function playTTS(text, { onEnd } = {}) {
  window.speechSynthesis.cancel()
  ttsChain = []
  ttsKillSwitch = false
  isSpeaking.value = true
  isPaused.value = false
  currentText.value = text

  const voice = getVoice()
  // Split on sentence boundaries to prevent mobile cutoffs
  const chunks = text.match(/[^.!?\n]{1,300}[.!?\n]*/g) ?? [text]

  ttsChain = chunks.map(c => {
    const u = new SpeechSynthesisUtterance(c.trim())
    u.lang = 'id-ID'
    u.rate = speechRate.value
    u.pitch = speechPitch.value
    if (voice) u.voice = voice
    return u
  })

  function next(i) {
    if (ttsKillSwitch || i >= ttsChain.length) {
      isSpeaking.value = false
      isPaused.value = false
      onEnd?.()
      return
    }
    const u = ttsChain[i]
    u.onend = () => next(i + 1)
    u.onerror = (e) => {
      console.error('Utterance error:', e)
      isSpeaking.value = false
      onEnd?.()
    }
    window.speechSynthesis.speak(u)
  }

  // A small delay after cancel() lets browser clear the audio queue
  setTimeout(() => next(0), 120)
}

export function pauseTTS() {
  window.speechSynthesis.pause()
  isPaused.value = true
  announce('Bacaan dijeda.')
}

export function resumeTTS() {
  window.speechSynthesis.resume()
  isPaused.value = false
  announce('Melanjutkan bacaan.')
}

export function stopTTS() {
  ttsKillSwitch = true
  window.speechSynthesis.cancel()
  isSpeaking.value = false
  isPaused.value = false
}

export function announce(text, onEnd = null) {
  if (!text) return
  window.speechSynthesis.cancel()

  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'id-ID'
  u.rate = speechRate.value
  u.pitch = speechPitch.value
  const voice = getVoice()
  if (voice) u.voice = voice

  if (onEnd) {
    u.onend = () => onEnd()
    u.onerror = () => onEnd()
  }

  setTimeout(() => window.speechSynthesis.speak(u), 100)
}

// ── LIBRARY / HISTORY STATE ─────────────────────────────────
export const libraryItems = ref(JSON.parse(localStorage.getItem('readlens_library') ?? '[]'))

function saveLibrary() {
  localStorage.setItem('readlens_library', JSON.stringify(libraryItems.value))
}

export function saveToLibrary(title, text) {
  if (!text || !text.trim()) return
  const id = Date.now().toString()
  const timestamp = new Date().toISOString()
  const newItem = {
    id,
    title: title && title.trim() ? title.trim() : `Scan ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`,
    text: text.trim(),
    timestamp,
    charCount: text.trim().length
  }
  libraryItems.value.unshift(newItem)
  saveLibrary()
  announce('Bacaan disimpan ke perpustakaan.')
  return newItem
}

export function removeFromLibrary(id) {
  const index = libraryItems.value.findIndex(item => item.id === id)
  if (index !== -1) {
    libraryItems.value.splice(index, 1)
    saveLibrary()
    announce('Bacaan dihapus.')
  }
}

export function renameLibraryItem(id, newTitle) {
  const item = libraryItems.value.find(item => item.id === id)
  if (item && newTitle && newTitle.trim()) {
    item.title = newTitle.trim()
    saveLibrary()
    announce('Judul bacaan diubah.')
  }
}
