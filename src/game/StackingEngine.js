import * as THREE from 'three';

const LAYER_HEIGHT = 0.54;
const BASE_SIZE = { x: 2.86, y: LAYER_HEIGHT, z: 1.08 };
const PERFECT_TOLERANCE = 0.085;
const MISS_TOLERANCE = 0.08;
const DECK_FOLLOW_OFFSET = 2.55;
const EARLY_CAMERA_FOLLOW = 0.76;
const ACTIVE_LAYER_CAMERA_OFFSET = 1.66;

function readBestScore(storageKey) {
  const value = Number.parseInt(window.localStorage.getItem(storageKey) || '0', 10);
  return Number.isFinite(value) ? value : 0;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.userData.disposeMaterial && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose();
        }
        material.dispose();
      });
    }
  });
}

function cloneSize(size) {
  return { x: size.x, y: size.y, z: size.z };
}

function resizeRendererToDisplaySize(renderer, camera, canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = renderer.getPixelRatio();
  const needsResize = canvas.width !== Math.floor(width * pixelRatio)
    || canvas.height !== Math.floor(height * pixelRatio);

  if (needsResize) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function getCameraTargetY(layerY) {
  const deckFollow = Math.max(0, layerY - DECK_FOLLOW_OFFSET) * EARLY_CAMERA_FOLLOW;
  const activeLayerCeiling = Math.max(0, layerY - ACTIVE_LAYER_CAMERA_OFFSET);
  return Math.max(deckFollow, activeLayerCeiling);
}

export class StackingEngine {
  constructor({ canvas, theme, onStateChange, onEvent, onPlaySound }) {
    this.canvas = canvas;
    this.theme = theme;
    this.onStateChange = onStateChange;
    this.onEvent = onEvent;
    this.onPlaySound = onPlaySound;

    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.camera = new THREE.PerspectiveCamera(35, 9 / 16, 0.1, 120);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.textureLoader = new THREE.TextureLoader();
    this.materialSets = new Map();
    this.loadedTextures = new Map();
    this.stack = [];
    this.offcuts = [];
    this.active = null;
    this.craneCable = null;
    this.craneSpreader = null;
    this.craneSlings = null;
    this.storageKey = theme.storageKey || `${theme.id || 'stacker'}.best-score`;
    this.best = readBestScore(this.storageKey);
    this.score = 0;
    this.status = 'menu';
    this.perfectStreak = 0;
    this.movementSpeed = 2.05;
    this.movementBound = 3.05;
    this.cameraLookAt = new THREE.Vector3(0, 1.34, 0.05);
    this.cameraTargetY = 0;
    this.animationFrame = null;
    this.destroyed = false;

    this.configureRenderer();
    this.addEnvironment();
    this.emitState();
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  configureRenderer() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera.position.set(5.4, 6.05, 13.2);
    this.camera.lookAt(this.cameraLookAt);
  }

  addEnvironment() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    this.scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xdff7ff, 0x244365, 2.35);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 3.85);
    sun.position.set(-4.8, 7.7, 4.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -5;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x92d7ff, 1.2);
    fill.position.set(5, 3, 6);
    this.scene.add(fill);

    this.craneCable = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 8, 0), new THREE.Vector3(0, 1, 0)]),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(this.theme.scene?.craneColor || '#1b3659'),
        transparent: true,
        opacity: 0.76,
      }),
    );
    this.scene.add(this.craneCable);

    const rigMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.theme.scene?.craneColor || '#1b3659'),
    });
    this.craneSpreader = new THREE.Group();
    this.craneSpreader.add(new THREE.Mesh(new THREE.BoxGeometry(BASE_SIZE.x * 0.82, 0.06, 0.08), rigMaterial));
    this.scene.add(this.craneSpreader);

    this.craneSlings = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(this.theme.scene?.craneColor || '#1b3659'),
        transparent: true,
        opacity: 0.82,
      }),
    );
    this.scene.add(this.craneSlings);
  }

  loadTexture(path, options = {}) {
    const cacheKey = `${path}|${options.repeatX || 1}|${options.repeatY || 1}`;
    if (this.loadedTextures.has(cacheKey)) {
      return this.loadedTextures.get(cacheKey);
    }

    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    if (options.repeatX || options.repeatY) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(options.repeatX || 1, options.repeatY || 1);
    }

    this.loadedTextures.set(cacheKey, texture);
    return texture;
  }

  getVariant(variantIndex) {
    return this.theme.containers[variantIndex % this.theme.containers.length];
  }

  getMaterialSet(variantIndex) {
    const variant = this.getVariant(variantIndex);

    if (this.materialSets.has(variant.id)) {
      return this.materialSets.get(variant.id);
    }

    const makeMaterial = (texturePath) => new THREE.MeshBasicMaterial({
      map: this.loadTexture(texturePath),
      color: 0xffffff,
    });

    const side = makeMaterial(variant.textures.side);
    const top = makeMaterial(variant.textures.top);
    const end = makeMaterial(variant.textures.end);
    const set = [end, end, top, top, side, side];
    this.materialSets.set(variant.id, set);
    return set;
  }

  createContainer(size, position, variantIndex, options = {}) {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geometry, this.getMaterialSet(variantIndex));
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edges = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: 0x071a2c,
        transparent: true,
        opacity: options.edgeOpacity ?? this.theme.scene?.edgeOpacity ?? 0.28,
      }),
    );
    edges.userData.disposeMaterial = true;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(edges);
    group.position.copy(position);
    group.userData.size = cloneSize(size);
    group.userData.variantIndex = variantIndex;
    this.scene.add(group);

    return {
      group,
      size: cloneSize(size),
      variantIndex,
    };
  }

  clearRunObjects() {
    [...this.stack, ...this.offcuts.map((offcut) => offcut.block)].forEach((block) => {
      this.scene.remove(block.group);
      disposeObject(block.group);
    });

    if (this.active) {
      this.scene.remove(this.active.group);
      disposeObject(this.active.group);
    }

    this.stack = [];
    this.offcuts = [];
    this.active = null;
  }

  startGame() {
    this.clearRunObjects();
    this.status = 'playing';
    this.score = 0;
    this.perfectStreak = 0;
    this.movementSpeed = 2.05;
    this.movementBound = 3.05;
    this.cameraTargetY = 0;
    this.camera.position.set(5.4, 6.05, 13.2);
    this.cameraLookAt.set(0, 1.34, 0.05);

    const base = this.createContainer(BASE_SIZE, new THREE.Vector3(0, LAYER_HEIGHT / 2, 0), 0);
    this.stack.push(base);
    this.spawnNextLayer();
    this.emitState();
  }

  spawnNextLayer() {
    const previous = this.stack[this.stack.length - 1];
    const previousPosition = previous.group.position;
    const axes = this.theme.gameplay?.axes || ['x', 'z'];
    const axis = axes[(this.stack.length - 1) % axes.length];
    const direction = Math.random() > 0.5 ? 1 : -1;
    const position = previousPosition.clone();
    position.y += LAYER_HEIGHT;
    position[axis] += direction * this.movementBound;

    const block = this.createContainer(cloneSize(previous.size), position, this.stack.length % this.theme.containers.length);
    this.active = {
      ...block,
      axis,
      direction: -direction,
      bounds: {
        min: previousPosition[axis] - this.movementBound,
        max: previousPosition[axis] + this.movementBound,
      },
    };
  }

  togglePause() {
    if (this.status === 'playing') {
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'playing';
    }

    this.emitState();
  }

  handleTap() {
    if (this.status === 'menu' || this.status === 'gameOver') {
      this.startGame();
      this.onPlaySound?.('button');
      return;
    }

    if (this.status !== 'playing') {
      return;
    }

    this.placeActiveLayer();
  }

  placeActivePerfectly() {
    if (this.status !== 'playing' || !this.active) {
      return;
    }

    const previous = this.stack[this.stack.length - 1];
    this.active.group.position[this.active.axis] = previous.group.position[this.active.axis];
    this.placeActiveLayer();
  }

  placeActiveLayer() {
    if (!this.active) {
      return;
    }

    const current = this.active;
    const previous = this.stack[this.stack.length - 1];
    const axis = current.axis;
    const delta = current.group.position[axis] - previous.group.position[axis];
    let overlap = previous.size[axis] - Math.abs(delta);

    this.onPlaySound?.('tap');

    if (overlap <= MISS_TOLERANCE) {
      this.convertActiveToFallingBlock(delta || 1);
      this.finishGame();
      return;
    }

    const isPerfect = Math.abs(delta) <= PERFECT_TOLERANCE;
    const placedSize = cloneSize(current.size);
    const placedPosition = current.group.position.clone();

    if (isPerfect) {
      placedPosition[axis] = previous.group.position[axis];
      overlap = previous.size[axis];
      this.perfectStreak += 1;
    } else {
      placedSize[axis] = overlap;
      placedPosition[axis] = previous.group.position[axis] + delta / 2;
      this.perfectStreak = 0;
    }

    this.scene.remove(current.group);
    disposeObject(current.group);

    const placed = this.createContainer(placedSize, placedPosition, current.variantIndex);
    this.stack.push(placed);
    this.active = null;
    this.score += 1;
    this.best = Math.max(this.best, this.score);
    window.localStorage.setItem(this.storageKey, String(this.best));
    this.movementSpeed = Math.min(5.4, 2.05 + this.score * 0.075);
    this.movementBound = Math.min(4.08, 3.05 + this.score * 0.022);
    this.cameraTargetY = getCameraTargetY(placedPosition.y);

    if (isPerfect) {
      this.onPlaySound?.('perfect');
      this.onEvent?.({ type: 'perfect', streak: this.perfectStreak });
    } else {
      this.createOffcut(current, placedSize, placedPosition, delta);
      this.onPlaySound?.('slice');
      this.onEvent?.({ type: 'slice' });
    }

    this.onPlaySound?.('thud');
    this.onEvent?.({ type: 'impact' });
    this.spawnNextLayer();
    this.emitState();
  }

  createOffcut(current, placedSize, placedPosition, delta) {
    const axis = current.axis;
    const direction = Math.sign(delta) || 1;
    const offcutSize = cloneSize(current.size);
    offcutSize[axis] = current.size[axis] - placedSize[axis];

    if (offcutSize[axis] <= 0.04) {
      return;
    }

    const offcutPosition = placedPosition.clone();
    offcutPosition[axis] += direction * ((placedSize[axis] / 2) + (offcutSize[axis] / 2));
    const block = this.createContainer(offcutSize, offcutPosition, current.variantIndex, { edgeOpacity: 0.22 });

    const velocity = new THREE.Vector3(0, 0.35, 0);
    velocity[axis] = direction * (1.1 + this.score * 0.012);
    velocity.z += axis === 'x' ? 0.25 : direction * 0.35;

    this.offcuts.push({
      block,
      velocity,
      angular: new THREE.Vector3(
        (Math.random() - 0.5) * 3.2,
        direction * 2.2,
        (Math.random() - 0.5) * 3.2,
      ),
      splashed: false,
    });
  }

  convertActiveToFallingBlock(delta) {
    const direction = Math.sign(delta) || 1;
    const block = {
      group: this.active.group,
      size: this.active.size,
      variantIndex: this.active.variantIndex,
    };

    this.offcuts.push({
      block,
      velocity: new THREE.Vector3(direction * 1.45, 0.15, 0.35),
      angular: new THREE.Vector3(1.7, direction * 2.7, -1.1),
      splashed: false,
    });

    this.active = null;
  }

  finishGame() {
    this.status = 'gameOver';
    this.onPlaySound?.('gameOver');
    this.onEvent?.({ type: 'gameOver' });
    this.emitState();
  }

  updateActive(deltaTime) {
    if (!this.active || this.status !== 'playing') {
      return;
    }

    const activePosition = this.active.group.position;
    const axis = this.active.axis;
    activePosition[axis] += this.active.direction * this.movementSpeed * deltaTime;

    if (activePosition[axis] > this.active.bounds.max) {
      activePosition[axis] = this.active.bounds.max;
      this.active.direction = -1;
    } else if (activePosition[axis] < this.active.bounds.min) {
      activePosition[axis] = this.active.bounds.min;
      this.active.direction = 1;
    }
  }

  updateOffcuts(deltaTime) {
    for (let index = this.offcuts.length - 1; index >= 0; index -= 1) {
      const offcut = this.offcuts[index];
      const group = offcut.block.group;
      offcut.velocity.y -= 5.7 * deltaTime;
      group.position.addScaledVector(offcut.velocity, deltaTime);
      group.rotation.x += offcut.angular.x * deltaTime;
      group.rotation.y += offcut.angular.y * deltaTime;
      group.rotation.z += offcut.angular.z * deltaTime;

      if (!offcut.splashed && group.position.y < -0.72) {
        offcut.splashed = true;
        this.onPlaySound?.('splash');
        this.onEvent?.({ type: 'splash' });
      }

      if (group.position.y < -5) {
        this.scene.remove(group);
        disposeObject(group);
        this.offcuts.splice(index, 1);
      }
    }
  }

  updateCamera() {
    const desiredPosition = new THREE.Vector3(5.4, 6.05 + this.cameraTargetY, 13.2);
    const desiredLookAt = new THREE.Vector3(0, 1.34 + this.cameraTargetY, 0.05);
    this.camera.position.lerp(desiredPosition, 0.075);
    this.cameraLookAt.lerp(desiredLookAt, 0.095);
    this.camera.lookAt(this.cameraLookAt);
  }

  updateCrane() {
    if (!this.craneCable || !this.craneSpreader || !this.craneSlings) {
      return;
    }

    const targetBlock = this.active || this.stack[this.stack.length - 1];
    const target = targetBlock?.group.position;
    if (!target) {
      return;
    }

    const containerTopY = target.y + (targetBlock.size.y / 2);
    const spreaderY = containerTopY + 0.14;
    const cableTop = new THREE.Vector3(target.x, spreaderY + 12, target.z);
    const cableBottom = new THREE.Vector3(target.x, spreaderY, target.z);
    this.craneCable.geometry.setFromPoints([cableTop, cableBottom]);

    this.craneSpreader.position.set(target.x, spreaderY, target.z);
    const slingInset = Math.min(targetBlock.size.x * 0.34, BASE_SIZE.x * 0.34);
    this.craneSlings.geometry.setFromPoints([
      new THREE.Vector3(target.x - slingInset, spreaderY, target.z),
      new THREE.Vector3(target.x - slingInset * 0.82, containerTopY + 0.01, target.z),
      new THREE.Vector3(target.x + slingInset, spreaderY, target.z),
      new THREE.Vector3(target.x + slingInset * 0.82, containerTopY + 0.01, target.z),
    ]);
  }

  animate() {
    if (this.destroyed) {
      return;
    }

    const deltaTime = Math.min(this.clock.getDelta(), 0.05);
    resizeRendererToDisplaySize(this.renderer, this.camera, this.canvas);
    this.updateActive(deltaTime);
    this.updateOffcuts(deltaTime);
    this.updateCamera();
    this.updateCrane();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  emitState() {
    this.onStateChange?.({
      status: this.status,
      score: this.score,
      best: this.best,
      perfectStreak: this.perfectStreak,
      cameraY: this.cameraTargetY,
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.clearRunObjects();
    this.materialSets.forEach((materials) => {
      materials.forEach((material) => {
        if (material.map) {
          material.map.dispose();
        }
        material.dispose();
      });
    });
    this.loadedTextures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
  }
}
