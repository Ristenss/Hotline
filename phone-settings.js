'use strict'
// Окна настроек телефона
const phonePanels = [
  document.getElementById('digit-settings'),
  document.getElementById('number-book')
]
const settingsButton = document.getElementById('phone-settings')
let panelStack = 32
settingsButton.addEventListener('click', () => {
  if (!open) return
  // Независимое закрытие и перетаскивание окон
  phonePanels.forEach((panel) => {
    panel.hidden = false
    panel.style.zIndex = ++panelStack
  })
  settingsButton.setAttribute('aria-expanded', 'true')
})
function sceneScale() {
  return stage.getBoundingClientRect().width / 1512
}
phonePanels.forEach((panel) => {
  panel.addEventListener('pointerdown', () => {
    panel.style.zIndex = ++panelStack
  })
  panel.querySelector('.panel-close').addEventListener('click', () => {
    panel.hidden = true
    settingsButton.setAttribute(
      'aria-expanded',
      String(phonePanels.some((other) => !other.hidden))
    )
    settingsButton.focus({ preventScroll: true })
  })
  const header = panel.querySelector('.panel-header')
  let drag = null
  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
    drag = {
      x: event.clientX,
      y: event.clientY,
      left: panel.offsetLeft,
      top: panel.offsetTop,
      scale: sceneScale()
    }
    header.setPointerCapture(event.pointerId)
    event.preventDefault()
  })
  header.addEventListener('pointermove', (event) => {
    if (!drag) return
    panel.style.left =
      Math.max(
        0,
        Math.min(
          1512 - panel.offsetWidth,
          drag.left + (event.clientX - drag.x) / drag.scale
        )
      ) + 'px'
    panel.style.top =
      Math.max(
        0,
        Math.min(
          982 - panel.offsetHeight,
          drag.top + (event.clientY - drag.y) / drag.scale
        )
      ) + 'px'
  })
  const end = () => {
    drag = null
  }
  header.addEventListener('pointerup', end)
  header.addEventListener('pointercancel', end)
  header.addEventListener('lostpointercapture', end)
})
// Начальные паузы между повторениями звуков
const digitSettings = [47, 18, 31, 13, 0, 50, 50, 43, 28, 96]
;[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((digit, index) => {
  const row = document.createElement('div')
  row.className = 'slider-row'
  row.style.top = 91 + index * 78.49 + 'px'
  const label = document.createElement('span')
  label.className = 'slider-label'
  label.textContent = digit
  const slider = document.createElement('div')
  slider.className = 'digit-slider'
  slider.tabIndex = 0
  slider.setAttribute('role', 'slider')
  slider.setAttribute('aria-label', 'Интервал цифры ' + digit)
  slider.setAttribute('aria-valuemin', '0')
  slider.setAttribute('aria-valuemax', '100')
  slider.innerHTML =
    '<span class="slider-line"></span><span class="slider-thumb"><img src="assets/images/slider-thumb.svg" alt=""></span>'
  const thumb = slider.querySelector('.slider-thumb')
  function setValue(value) {
    const v = Math.round(Math.max(0, Math.min(100, value)))
    digitSettings[digit] = v
    thumb.style.left = -11 + (v / 100) * 514.5 + 'px'
    slider.setAttribute('aria-valuenow', String(v))
    const pause = Math.round((v / 100) ** 2 * 64) * 0.125
    slider.setAttribute(
      'aria-valuetext',
      'Пауза между звуками: ' + pause + ' секунд'
    )
    stage.dispatchEvent(
      new CustomEvent('phone:digit-setting', {
        detail: { digit: String(digit), value: v }
      })
    )
  }
  let dragging = false
  function fromPointer(event) {
    const r = slider.getBoundingClientRect()
    setValue((((event.clientX - r.left) / sceneScale() - 15) / 514.5) * 100)
  }
  slider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    dragging = true
    slider.setPointerCapture(event.pointerId)
    slider.focus({ preventScroll: true })
    fromPointer(event)
    event.preventDefault()
  })
  slider.addEventListener('pointermove', (event) => {
    if (dragging) fromPointer(event)
  })
  ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) =>
    slider.addEventListener(type, () => (dragging = false))
  )
  slider.addEventListener('keydown', (event) => {
    const keys = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10
    }
    if (event.key in keys) {
      event.preventDefault()
      setValue(digitSettings[digit] + keys[event.key])
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setValue(event.key === 'Home' ? 0 : 100)
    }
  })
  setValue(digitSettings[digit])
  row.append(label, slider)
  document.getElementById('digit-sliders').append(row)
})
// В полях номерной книжки допускаются только цифры.
document.querySelectorAll('.book-number').forEach((input, index) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10)
    stage.dispatchEvent(
      new CustomEvent('phone:number-book', {
        detail: { index, value: input.value }
      })
    )
  })
})
