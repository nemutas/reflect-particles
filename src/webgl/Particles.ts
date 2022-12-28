import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler'
import { gl } from './core/WebGL'

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

export class Particles {
  private scene = new THREE.Scene()
  private renderTarget = new THREE.WebGLRenderTarget(gl.size.width, gl.size.height, { encoding: THREE.sRGBEncoding })

  private readonly AMOUNT = 200

  private isAnimation = true
  private raycaster = new THREE.Raycaster()

  private particlesData: { velocity: THREE.Vector3 }[] = []
  private particlePositions = new Float32Array(this.AMOUNT * 3)
  private particleColors = new Float32Array(this.AMOUNT * 3)

  private linePositions = new Float32Array(this.AMOUNT * this.AMOUNT * 3)
  private lineColors = new Float32Array(this.AMOUNT * this.AMOUNT * 3)

  private lineColorMax = 0

  constructor(private constraintMesh: THREE.Mesh) {
    this.init()
    this.createParticles()
    this.addEvents()
  }

  private init() {
    this.scene.background = new THREE.Color('#000')
    this.raycaster.firstHitOnly = true
  }

  private createParticles() {
    // particles
    const randVelo = (scale = 1) => (Math.random() * 2 - 1) * scale

    const sampler = new MeshSurfaceSampler(this.constraintMesh).build()
    const targetPosition = new THREE.Vector3()
    const targetNormal = new THREE.Vector3()

    for (let i = 0; i < this.AMOUNT; i++) {
      const [ix, iy, iz] = [3 * i, 3 * i + 1, 3 * i + 2]
      sampler.sample(targetPosition, targetNormal)
      targetPosition.add(targetNormal.multiplyScalar(-1 * 0.05))

      this.particlePositions[ix] = targetPosition.x
      this.particlePositions[iy] = targetPosition.y
      this.particlePositions[iz] = targetPosition.z

      this.particlesData.push({
        velocity: targetNormal
          .clone()
          .normalize()
          .add(new THREE.Vector3(randVelo(), randVelo(), randVelo()))
          .normalize(),
      })
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    geometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3).setUsage(THREE.DynamicDrawUsage))

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 3,
      // blending: THREE.AdditiveBlending,
      transparent: true,
      sizeAttenuation: false,
    })

    const points = new THREE.Points(geometry, material)
    points.name = 'points'
    this.scene.add(points)

    // line
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3).setUsage(THREE.DynamicDrawUsage))

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
    })

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
    lines.name = 'lines'
    this.scene.add(lines)
  }

  // -----------------------------------------------------------
  // events
  private addEvents() {
    window.addEventListener('focus', this.handleFocus)
    window.addEventListener('blur', this.handleBlur)
  }

  private handleFocus = () => (this.isAnimation = true)

  private handleBlur = () => (this.isAnimation = false)

  // -----------------------------------------------------------
  // animation
  private getColor(src: THREE.Vector3) {
    const r = THREE.MathUtils.smoothstep(src.x, -1, 1)
    const g = THREE.MathUtils.smoothstep(src.y, -1, 1)
    const b = THREE.MathUtils.smoothstep(src.z, -1, 1)
    return [r, g, b]
  }

  private update(dt: number) {
    if (!this.isAnimation) return

    let linePosCounter = 0
    let lineColCounter = 0

    for (let i = 0; i < this.lineColorMax / 3; i++) {
      // clear lines
      this.lineColors[3 * i] = 0
      this.lineColors[3 * i + 1] = 0
      this.lineColors[3 * i + 2] = 0
    }

    for (let i = 0; i < this.AMOUNT; i++) {
      // draw particles
      const [ix, iy, iz] = [3 * i, 3 * i + 1, 3 * i + 2]

      const velocity = this.particlesData[i].velocity

      this.particlePositions[ix] += velocity.x * dt
      this.particlePositions[iy] += velocity.y * dt
      this.particlePositions[iz] += velocity.z * dt

      const color = this.getColor(velocity)
      this.particleColors[ix] = color[0]
      this.particleColors[iy] = color[1]
      this.particleColors[iz] = color[2]

      this.raycaster.ray.origin.set(this.particlePositions[ix], this.particlePositions[iy], this.particlePositions[iz])
      this.raycaster.ray.direction.copy(velocity)
      const hits = this.raycaster.intersectObject(this.constraintMesh)
      if (0 < hits.length) {
        if (hits[0].distance < dt * 2) velocity.reflect(hits[0].face!.normal)
      } else {
        this.particleColors[ix] = 0
        this.particleColors[iy] = 0
        this.particleColors[iz] = 0
      }

      // draw lines
      const posX = this.particlePositions[ix]
      const posY = this.particlePositions[iy]
      const posZ = this.particlePositions[iz]

      let lineCounter = 0

      for (let j = i + 1; j < this.AMOUNT; j++) {
        const [ixx, iyy, izz] = [3 * j, 3 * j + 1, 3 * j + 2]

        const nextVelocity = this.particlesData[j].velocity
        const nextPosX = this.particlePositions[ixx] + nextVelocity.x * dt
        const nextPosY = this.particlePositions[iyy] + nextVelocity.y * dt
        const nextPosZ = this.particlePositions[izz] + nextVelocity.z * dt

        const nextColor = this.getColor(nextVelocity)

        const distance = Math.sqrt((nextPosX - posX) ** 2 + (nextPosY - posY) ** 2 + (nextPosZ - posZ) ** 2)

        let alpha = 1 - THREE.MathUtils.smoothstep(distance, 0.1, 0.3)
        alpha *= 0.5

        this.linePositions[linePosCounter++] = posX
        this.linePositions[linePosCounter++] = posY
        this.linePositions[linePosCounter++] = posZ

        this.linePositions[linePosCounter++] = nextPosX
        this.linePositions[linePosCounter++] = nextPosY
        this.linePositions[linePosCounter++] = nextPosZ

        this.lineColors[lineColCounter++] = alpha * color[0]
        this.lineColors[lineColCounter++] = alpha * color[1]
        this.lineColors[lineColCounter++] = alpha * color[2]

        this.lineColors[lineColCounter++] = alpha * nextColor[0]
        this.lineColors[lineColCounter++] = alpha * nextColor[1]
        this.lineColors[lineColCounter++] = alpha * nextColor[2]

        if (0 < alpha && 20 <= ++lineCounter) {
          break
        }
      }
    }

    const points = this.scene.getObjectByName('points') as THREE.Mesh
    points.geometry.attributes.position.needsUpdate = true
    points.geometry.attributes.color.needsUpdate = true

    const lines = this.scene.getObjectByName('lines') as THREE.Mesh
    lines.geometry.attributes.position.needsUpdate = true
    lines.geometry.attributes.color.needsUpdate = true

    this.lineColorMax = lineColCounter
  }

  get texture() {
    return this.renderTarget.texture
  }

  render(dt: number) {
    this.update(dt)

    gl.renderer.setRenderTarget(this.renderTarget)
    gl.renderer.render(this.scene, gl.camera)
    gl.renderer.setRenderTarget(null)
  }

  dispose() {
    window.removeEventListener('focus', this.handleFocus)
    window.removeEventListener('blur', this.handleBlur)
  }
}
