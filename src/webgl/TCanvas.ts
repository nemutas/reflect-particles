import * as THREE from 'three'
import { resolvePath } from '../scripts/utils'
import { gl } from './core/WebGL'
import { Particles } from './Particles'
import { Assets, loadAssets } from './utils/assetLoader'
import { controls } from './utils/OrbitControls'
import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'

export class TCanvas {
  private animeID?: number
  private particles!: Particles

  private assets: Assets = {
    bunny: { path: resolvePath('/resources/bunny.glb') },
    matcap: { path: resolvePath('/resources/matcap_1k.jpg') },
  }

  constructor(private parentNode: ParentNode) {
    loadAssets(this.assets).then(() => {
      this.init()
      this.createObjects()
      this.setAnimationFrame()
    })
  }

  private init() {
    gl.setup(this.parentNode.querySelector('.three-container')!)
    gl.scene.background = new THREE.Color('#fff')
    gl.camera.position.set(0, 0.5, 2.2)
  }

  private createObjects() {
    const bunny = (this.assets.bunny.data as any).scene.children[0] as THREE.Mesh

    // const geometry = new THREE.BoxGeometry()
    // const geometry = new THREE.TorusKnotGeometry(0.5, 0.2, 128, 32, 2, 1)
    const geometry = bunny.geometry
    const matrix4 = new THREE.Matrix4()
    geometry.applyMatrix4(matrix4.makeScale(1.5, 1.5, 1.5))
    geometry.applyMatrix4(matrix4.makeTranslation(0.1, -0.1, 0))
    geometry.computeBoundsTree()
    const material = new THREE.ShaderMaterial({
      uniforms: {
        tParticles: { value: null },
        tMatcap: { value: this.assets.matcap.data },
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    gl.scene.add(mesh)

    this.particles = new Particles(mesh)
    material.uniforms.tParticles.value = this.particles.texture
  }

  // ----------------------------------
  // animation frame
  private setAnimationFrame() {
    const anime = () => {
      const dt = gl.time.getDelta() * 0.3
      this.particles.render(dt)

      controls.update()
      gl.render()

      requestAnimationFrame(anime)
    }
    this.animeID = requestAnimationFrame(anime)
  }

  // ----------------------------------
  // dispose
  dispose() {
    this.animeID && cancelAnimationFrame(this.animeID)
    gl.dispose()
  }
}
