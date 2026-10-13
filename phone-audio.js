'use strict'
// Воспроизведение звуков номера на общей сетке 120 BPM.
class PhoneSynth {
  constructor() {
    this.ctx = null
    this.playing = false
    this.token = 0
    this.voices = new Set()
    this.levels = Array(10).fill(0.65)
    this.counts = Array(10).fill(0)
    this.timer = null
    this.spacing = [47, 18, 31, 13, 0, 50, 50, 43, 28, 96]
    this.pairCounts = Array(10).fill(0)
    this.pairNextDue = Array(10).fill(0)
    this.pairLastStep = Array(10).fill(-1000)
    this.nextDue = Array(10).fill(0)
    this.lastStep = Array(10).fill(-1000)
  }
  init() {
    if (this.ctx) return
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) throw new Error('Этот браузер не поддерживает синтез звука')
    this.ctx = new Audio()
    const c = this.ctx
    this.master = c.createGain()
    this.master.gain.value = 0.45
    const compressor = c.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 5
    this.analyser = c.createAnalyser()
    this.analyser.fftSize = 512
    this.audioProbe = new Float32Array(512)
    this.master.connect(compressor)
    compressor.connect(this.analyser)
    this.analyser.connect(c.destination)
    c.onstatechange = () => {
      stage.dataset.audioContext = c.state
    }
    this.buses = Array.from({ length: 10 }, () => {
      const gain = c.createGain()
      gain.gain.value = 0
      gain.connect(this.master)
      return gain
    })
    this.noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  gainFor(digit) {
    return (
      this.levels[digit] *
      Math.min(1.5, Math.sqrt(this.counts[digit] + this.pairCounts[digit]))
    )
  }
  periodSteps(digit, pair = false) {
    const soundSteps = Math.max(
      1,
      Math.ceil(
        ((pair ? this.pairSamples : this.samples)?.[digit]?.duration || 0.2) /
          0.125
      )
    )
    const gap = Math.round((this.spacing[digit] / 100) ** 2 * 64)
    return soundSteps + gap
  }
  setIntervalValue(digit, value) {
    this.spacing[digit] = Math.max(0, Math.min(100, value))
    if (this.playing) {
      this.nextDue[digit] = Math.max(
        this.step,
        this.lastStep[digit] + this.periodSteps(digit)
      )
      this.pairNextDue[digit] = Math.max(
        this.step,
        this.pairLastStep[digit] + this.periodSteps(digit, true)
      )
    }
  }
  route(node, digit, time, duration, volume) {
    const c = this.ctx,
      g = c.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    node.connect(g)
    g.connect(this.buses[digit])
    this.voices.add(node)
    node.onended = () => {
      node.disconnect()
      g.disconnect()
      this.voices.delete(node)
    }
    node.start(time)
    node.stop(time + duration + 0.02)
  }
  tone(digit, time, freq, duration, volume, type = 'sine', endFreq = null) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, time)
    if (endFreq)
      o.frequency.exponentialRampToValueAtTime(endFreq, time + duration * 0.65)
    this.route(o, digit, time, duration, volume)
  }
  noise(digit, time, duration, volume, frequency, type = 'highpass') {
    const n = this.ctx.createBufferSource(),
      f = this.ctx.createBiquadFilter()
    n.buffer = this.noiseBuffer
    f.type = type
    f.frequency.value = frequency
    n.connect(f)
    const c = this.ctx,
      g = c.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.linearRampToValueAtTime(volume, time + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    f.connect(g)
    g.connect(this.buses[digit])
    this.voices.add(n)
    n.onended = () => {
      n.disconnect()
      f.disconnect()
      g.disconnect()
      this.voices.delete(n)
    }
    n.start(time)
    n.stop(time + duration + 0.02)
  }
  // Декодирование обычных звуков и звуков для пар цифр
  async loadSamples() {
    if (this.samples && this.pairSamples) return
    if (!this.samplesPromise) {
      const decode = (encoded) =>
        new Promise((resolve, reject) => {
          const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
          const result = this.ctx.decodeAudioData(bytes.buffer, resolve, reject)
          if (result?.then) result.then(resolve, reject)
        })
      const load = (bank) =>
        Promise.all(
          Object.entries(bank).map(async ([digit, encoded]) => [
            digit,
            await decode(encoded)
          ])
        )
      this.samplesPromise = Promise.all([
        load(PHONE_SAMPLES),
        load(PHONE_PAIR_SAMPLES)
      ])
        .then(([normal, pairs]) => {
          this.samples = Object.fromEntries(normal)
          this.pairSamples = Object.fromEntries(pairs)
          stage.dataset.audioSamples = '20'
        })
        .catch((error) => {
          this.samplesPromise = null
          throw error
        })
    }
    await this.samplesPromise
  }
  sample(digit, time, volume, pair = false) {
    const buffer = (pair ? this.pairSamples : this.samples)[digit]
    if (!buffer) return
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const gain = this.ctx.createGain(),
      end = time + buffer.duration
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(volume, time + 0.008)
    gain.gain.setValueAtTime(volume, Math.max(time + 0.01, end - 0.018))
    gain.gain.linearRampToValueAtTime(0, end)
    source.connect(gain)
    gain.connect(this.buses[digit])
    this.voices.add(source)
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      this.voices.delete(source)
    }
    source.start(time)
    source.stop(end + 0.01)
  }
  note(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12)
  }
  // Планирование повторений без обрыва текущих звуков
  schedule(step, time) {
    const volumes = [0.45, 0.85, 0.6, 0.2, 0.5, 0.38, 0.55, 0.27, 0.23, 0.5]
    for (let digit = 0; digit < 10; digit++) {
      if (this.counts[digit] && step >= this.nextDue[digit]) {
        this.sample(digit, time, volumes[digit])
        this.lastStep[digit] = step
        this.nextDue[digit] = step + this.periodSteps(digit)
      }
      if (this.pairCounts[digit] && step >= this.pairNextDue[digit]) {
        this.sample(digit, time, 0.5, true)
        this.pairLastStep[digit] = step
        this.pairNextDue[digit] = step + this.periodSteps(digit, true)
      }
    }
  }
  // 555 разбирается как одна пара 55 и одна обычная цифра 5.
  parseNumber(sequence) {
    this.counts.fill(0)
    this.pairCounts.fill(0)
    for (let i = 0; i < sequence.length; i++) {
      const digit = Number(sequence[i])
      if (
        i + 1 < sequence.length &&
        String(sequence[i]) === String(sequence[i + 1])
      ) {
        this.pairCounts[digit]++
        i++
      } else this.counts[digit]++
    }
  }
  async start(sequence) {
    this.stop()
    const token = this.token
    this.init()
    await this.ctx.resume()
    await this.loadSamples()
    if (token !== this.token) return false
    if (this.ctx.state !== 'running')
      throw new Error('Браузер пока не разрешил воспроизведение')
    this.parseNumber(sequence)
    this.buses.forEach((bus, d) => {
      bus.gain.cancelScheduledValues(this.ctx.currentTime)
      bus.gain.setValueAtTime(this.gainFor(d), this.ctx.currentTime)
    })
    this.nextDue = [0, 0, 4, 0, 0, 0, 0, 2, 2, 0]
    this.lastStep.fill(-1000)
    this.pairNextDue.fill(0)
    this.pairLastStep.fill(-1000)
    this.playing = true
    this.step = 0
    this.next = this.ctx.currentTime + 0.055
    stage.dataset.audioPeak = '0'
    const pump = () => {
      if (!this.playing) return
      this.analyser.getFloatTimeDomainData(this.audioProbe)
      const peak = Math.max(...this.audioProbe.map(Math.abs))
      stage.dataset.audioPeak = String(
        Math.max(Number(stage.dataset.audioPeak) || 0, peak)
      )
      stage.dataset.audioContext = this.ctx.state
      if (this.next < this.ctx.currentTime - 0.1)
        this.next = this.ctx.currentTime + 0.025
      while (this.next < this.ctx.currentTime + 0.12) {
        this.schedule(this.step++, this.next)
        this.next += 0.125
      }
    }
    pump()
    this.timer = setInterval(pump, 25)
    return true
  }
  stop() {
    this.token++
    this.playing = false
    clearInterval(this.timer)
    this.timer = null
    if (this.ctx) {
      this.buses.forEach((bus) => {
        bus.gain.cancelScheduledValues(this.ctx.currentTime)
        bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.012)
      })
      this.voices.forEach((node) => {
        try {
          node.stop(this.ctx.currentTime + 0.04)
        } catch {}
      })
    }
  }
}
// Связь звукового движка с трубкой, набором и ползунками
const phoneSynth = new PhoneSynth()
const handsetButton = document.getElementById('handset-play')
const audioLabel = document.getElementById('phone-audio-label')
function updateAudioButton() {
  handsetButton.setAttribute('aria-pressed', String(phoneSynth.playing))
  handsetButton.setAttribute(
    'aria-label',
    phoneSynth.playing ? 'Остановить звук номера' : 'Проиграть набранный номер'
  )
  stage.classList.toggle('phone-playing', phoneSynth.playing)
  audioLabel.textContent = phoneSynth.playing
    ? 'Играет номер · нажми трубку, чтобы остановить'
    : 'Набери номер и нажми трубку'
}
function stopPhoneSound() {
  phoneSynth.stop()
  updateAudioButton()
}
handsetButton.addEventListener('click', async () => {
  if (!open) return
  if (phoneSynth.playing) {
    stopPhoneSound()
    status.textContent = 'Воспроизведение остановлено'
    return
  }
  if (!digits.length) {
    status.textContent = 'Сначала набери хотя бы одну цифру'
    audioLabel.textContent = 'Сначала набери номер'
    return
  }
  try {
    const started = await phoneSynth.start([...digits])
    updateAudioButton()
    if (started) status.textContent = 'Играет номер ' + digits.join('')
  } catch (error) {
    console.error('Phone audio:', error)
    stage.dataset.audioError = error.message || String(error)
    stopPhoneSound()
    audioLabel.textContent = 'Не удалось включить звук. Нажми трубку ещё раз.'
    status.textContent = audioLabel.textContent
  }
})
stage.addEventListener('phone:digit-setting', (event) =>
  phoneSynth.setIntervalValue(Number(event.detail.digit), event.detail.value)
)
stage.addEventListener('instrument:reset', stopPhoneSound)
stage.addEventListener('instrument:sequence', () => {
  if (phoneSynth.playing) stopPhoneSound()
})

addEventListener('pagehide', stopPhoneSound)
for (let d = 0; d < 10; d++) phoneSynth.setIntervalValue(d, digitSettings[d])
updateAudioButton()
