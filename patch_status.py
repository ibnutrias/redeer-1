import re

with open('/Users/ibnufalah/dev/redeer/src/components/BookReader.vue', 'r') as f:
    c = f.read()

# 1. Remove countdown variables
c = re.sub(r'// Countdown\nconst countdown = ref\(0\)\nlet countdownTimer = null\n\n', '', c)

# 2. Modify playDetectionSound
c = c.replace(
    'if (autoScanActive.value && !isSpeaking.value) {',
    'if (autoScanActive.value && !isSpeaking.value && !isProcessing.value) {'
)

# 3. Clean up UI statuses
c = re.sub(r"  if \(countdown\.value > 0\) return '[^']+'\n", '', c)
c = re.sub(r"  if \(countdown\.value > 0\) return 'bg-green-600 text-black animate-pulse'\n", '', c)

# 4. Fix specific string returns
c = c.replace("return ' AI Memproses'", "return '🤖 AI Memindai'")
c = c.replace("return 'bg-yellow-600 text-black'", "return 'bg-yellow-600 text-black animate-pulse'")
c = c.replace("return docDetected.value ? '📄 Stabil...' : '🔍 Mendeteksi'", "return docDetected.value ? '📄 Terdeteksi' : '🔍 Mencari'")

# 5. Add globalUtt
c = c.replace(
"""const isSpeaking = ref(false)
const isPaused   = ref(false)
const speechRate = ref(Number(localStorage.getItem('bacakan_rate') ?? 1.0))""",
"""const isSpeaking = ref(false)
const isPaused   = ref(false)
const speechRate = ref(Number(localStorage.getItem('bacakan_rate') ?? 1.0))
let globalUtt    = null"""
)

with open('/Users/ibnufalah/dev/redeer/src/components/BookReader.vue', 'w') as f:
    f.write(c)
