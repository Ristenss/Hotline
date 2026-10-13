'use strict'
// Элементы страницы и состояние телефона
const stage = document.getElementById('stage')
const instrument = document.getElementById('instrument')
const status = document.getElementById('status')
const phone = document.getElementById('phone')
let digits = []
let open = false
const slots = Array.from({ length: 10 }, () => {
  const slot = document.createElement('span')
  slot.className = 'slot'
  const glyph = document.createElement('span')
  glyph.className = 'digit'
  slot.append(glyph)
  document.getElementById('slots').append(slot)
  return slot
})
function resize() {
  stage.style.setProperty(
    '--scale',
    Math.min(innerWidth / 1512, innerHeight / 982)
  )
}
addEventListener('resize', resize)
resize()
const reduceMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches
// Отображение набранного номера
function render() {
  slots.forEach((slot, i) => {
    slot.firstElementChild.textContent = digits[i] ?? ''
  })
  document
    .getElementById('slots')
    .setAttribute(
      'aria-label',
      'Набранные цифры: ' + (digits.join(' ') || 'пусто')
    )
  stage.dispatchEvent(
    new CustomEvent('instrument:sequence', {
      detail: { sequence: [...digits] }
    })
  )
}
// Быстрые нажатия ставятся в очередь: диск завершает каждый поворот.
const dial = document.querySelector('#phone .dial-wheel')
let dialQueue = []
let dialGeneration = 0
let dialRunning = false
let dialAnimations = []
function stopDial() {
  dialGeneration++
  dialQueue = []
  dialRunning = false
  dialAnimations.forEach((animation) => animation.cancel())
  dialAnimations = []
}
async function turnDial(digit) {
  if (reduceMotion()) return
  dialQueue.push(Number(digit))
  if (dialRunning) return
  dialRunning = true
  const generation = dialGeneration
  while (dialQueue.length && open) {
    const number = dialQueue.shift()
    const steps = number === 0 ? 10 : number
    const angle = 35 + steps * 27
    const duration = 700 + steps * 40
    const frames = [
      {
        transform: 'rotate(0deg)',
        offset: 0,
        easing: 'cubic-bezier(.15,.65,.25,1)'
      },
      { transform: 'rotate(' + angle + 'deg)', offset: 0.28, easing: 'linear' },
      {
        transform: 'rotate(' + angle + 'deg)',
        offset: 0.34,
        easing: 'cubic-bezier(.25,0,.35,1)'
      },
      { transform: 'rotate(0deg)', offset: 1 }
    ]
    dialAnimations = [dial.animate(frames, { duration })]
    await Promise.all(
      dialAnimations.map((animation) => animation.finished.catch(() => {}))
    )
    if (generation !== dialGeneration) return
    dialAnimations = []
  }
  dialRunning = false
}
function enterDigit(digit) {
  if (!open) return
  if (digits.length === slots.length) {
    status.textContent = 'Все десять окошек заполнены. Можно сбросить цифры.'
    return
  }
  const key = document.querySelector('[data-digit="' + digit + '"]')
  clearTimeout(key.glowTimer)
  key.classList.add('lit')
  key.glowTimer = setTimeout(() => key.classList.remove('lit'), 300)
  digits.push(String(digit))
  render()
  turnDial(digit)
  status.textContent =
    'Цифра ' + digit + '. Заполнено ' + digits.length + ' из 10.'
  // Событие набора номера для остальных частей проекта.
  stage.dispatchEvent(
    new CustomEvent('instrument:digit', {
      detail: {
        instrument: 'Телефон',
        digit: String(digit),
        sequence: [...digits]
      }
    })
  )
}
function reset() {
  stopDial()
  document.querySelectorAll('.digit-key').forEach((key) => {
    clearTimeout(key.glowTimer)
    key.classList.remove('lit')
  })
  digits = []
  render()
  status.textContent = 'Цифры сброшены'
  stage.dispatchEvent(new CustomEvent('instrument:reset'))
}
// Координаты кнопок на диске
const phoneKeys = [
  [1, 856, 675],
  [2, 816, 628],
  [3, 757, 607],
  [4, 695, 618],
  [5, 646, 657],
  [6, 620, 714],
  [7, 622, 770],
  [8, 650, 818],
  [9, 696, 851],
  [0, 749, 861]
]
function buildKeys() {
  const keys = document.getElementById('keys')
  keys.replaceChildren()
  keys.setAttribute('aria-label', 'Цифры телефона')
  phoneKeys.forEach(([digit, x, y]) => {
    const button = document.createElement('button')
    button.className = 'digit-key'
    button.type = 'button'
    button.style.left = x + 'px'
    button.style.top = y + 'px'
    button.setAttribute('aria-label', 'Цифра ' + digit)
    const glow = document.createElement('span')
    glow.className = 'key-glow'
    glow.setAttribute('aria-hidden', 'true')
    button.append(glow)
    button.dataset.digit = digit
    button.addEventListener('click', () => enterDigit(digit))
    keys.append(button)
  })
}
// Открытие и закрытие телефона
function openInstrument() {
  if (open) return
  open = true
  instrument.hidden = false
  instrument.getAnimations().forEach((animation) => animation.cancel())
  instrument.setAttribute('aria-label', 'Телефон')
  document.getElementById('close').setAttribute('aria-label', 'Закрыть телефон')
  buildKeys()
  reset()
  stage.classList.add('is-open')
  document.querySelector('.digit-key').focus({ preventScroll: true })
}
function closeInstrument() {
  if (!open) return
  document
    .querySelectorAll('.phone-panel')
    .forEach((panel) => (panel.hidden = true))
  document
    .getElementById('phone-settings')
    .setAttribute('aria-expanded', 'false')
  open = false
  reset()
  stage.classList.remove('is-open')
  if (reduceMotion()) instrument.hidden = true
  else
    instrument
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 550,
        easing: 'ease-in-out'
      })
      .finished.then(() => {
        if (!open) instrument.hidden = true
      })
      .catch(() => {})
  phone.focus({ preventScroll: true })
}
// Управление мышью и клавиатурой
phone.addEventListener('click', openInstrument)
document.getElementById('reset').addEventListener('click', reset)
document.getElementById('close').addEventListener('click', closeInstrument)
addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target.closest('input,textarea,[contenteditable],.phone-panel'))
    return
  if (open && /^\d$/.test(event.key)) {
    event.preventDefault()
    enterDigit(event.key)
  } else if (open && event.key === 'Escape') {
    event.preventDefault()
    closeInstrument()
  } else if (open && event.key === 'Backspace') {
    event.preventDefault()
    digits.pop()
    render()
  } else if (open && event.key === 'Delete') {
    event.preventDefault()
    reset()
  }
})
render()

// Показываем сцену после загрузки изображений и шрифта.
Promise.all([
  ...Array.from(document.images, (image) => image.decode().catch(() => {})),
  document.fonts.ready
]).then(() => {
  resize()
  stage.style.visibility = 'visible'
})
