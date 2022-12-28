import { TCanvas } from './webgl/TCanvas'

const canvas = new TCanvas(document.body)

window.addEventListener('beforeunload', () => {
  canvas.dispose()
})
