import * as THREE from './vendor/three-0.180.0/three.module.min.js';
import { loadIPhonePro } from './work-iphone-model.js';

// Progressive enhancement: the existing DOM phone remains the accessible fallback.
export async function createPhone3D({ element, layers, angles, getSelected, reduced, onError }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'work-phone-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const events = new AbortController();
  const geometries = new Set();
  const materials = new Set();
  const modelTextures = new Set();
  let modelCredit;
  let renderer, environment, texture, shadowTexture, resizeObserver, intersectionObserver;
  let frame = 0;
  let destroyed = false;
  let allowed = false;
  let inViewport = true;
  let dirty = true;
  let lastTime = 0;

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    events.abort();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    modelTextures.forEach(value => value.dispose());
    environment?.dispose();
    texture?.dispose();
    shadowTexture?.dispose();
    renderer?.dispose();
    element.classList.remove('has-3d');
    canvas.remove();
    modelCredit?.remove();
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, .5, .1, 60);
    const device = new THREE.Group();
    scene.add(device);

    // Local studio lighting, without an external HDR download.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x99958e);
    function softbox(width, height, position, strength) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(strength, strength, strength), side: THREE.DoubleSide }));
      panel.position.set(...position);
      panel.lookAt(0, 0, 0);
      studio.add(panel);
    }
    softbox(3, 9, [-5, 3, 5], 4);
    softbox(2, 7, [5, 1, 3], 2.2);
    softbox(6, 2, [0, 7, -2], 3);
    const pmrem = new THREE.PMREMGenerator(renderer);
    try { environment = pmrem.fromScene(studio, .045); }
    finally {
      pmrem.dispose();
      studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    }
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xfffaf0, 0x555b61, 1.4));
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 3.5);
    keyLight.position.set(-4, 7, 6);
    scene.add(keyLight);
    const fill = new THREE.DirectionalLight(0xe6edf7, 1.5);
    fill.position.set(4, 1, 5);
    scene.add(fill);

    function mesh(geometry, material, position = [0, 0, 0], parent = device) {
      geometries.add(geometry);
      materials.add(material);
      const object = new THREE.Mesh(geometry, material);
      object.position.set(...position);
      parent.add(object);
      return object;
    }
    const model = await loadIPhonePro();
    model.root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [].concat(object.material || [])) {
        materials.add(material);
        Object.values(material).forEach(value => { if (value?.isTexture) modelTextures.add(value); });
      }
    });
    device.add(model.root);

    // Composite the existing videos/posters onto one screen texture. No extra decoders.
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 390;
    screenCanvas.height = 844;
    const context = screenCanvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Screen compositor unavailable');
    texture = new THREE.CanvasTexture(screenCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const screenMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    materials.add(screenMaterial);
    model.display.material = screenMaterial;
    // A feathered contact shadow fades out before the canvas boundary.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const shadowContext = shadowCanvas.getContext('2d');
    if (!shadowContext) throw new Error('Shadow compositor unavailable');
    const gradient = shadowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(30,32,28,.24)');
    gradient.addColorStop(.3, 'rgba(30,32,28,.14)');
    gradient.addColorStop(.65, 'rgba(30,32,28,.045)');
    gradient.addColorStop(1, 'rgba(30,32,28,0)');
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 128, 128);
    shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    shadowTexture.colorSpace = THREE.SRGBColorSpace;
    const floor = mesh(new THREE.PlaneGeometry(3.65, 1.8), new THREE.MeshBasicMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false
    }), [0, -3.32, 0], scene);
    floor.rotation.x = -Math.PI / 2;

    let selected = getSelected();
    function pose(key) { return (angles[key] || angles.payments).map(THREE.MathUtils.degToRad); }
    let target = pose(selected);
    const rotation = [...target];
    const velocity = [0, 0, 0];
    const weights = layers.map(layer => layer.key === selected ? 1 : 0);
    let blendFrom = [...weights];
    let blendStart = -Infinity;
    const previousTimes = layers.map(() => -1);
    device.rotation.set(...rotation);

    function paintScreen() {
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.fillStyle = '#000';
      context.fillRect(0, 0, 390, 844);
      context.globalCompositeOperation = 'lighter';
      layers.forEach((layer, index) => {
        previousTimes[index] = layer.video.currentTime;
        if (weights[index] < .001) return;
        context.globalAlpha = weights[index];
        const source = layer.video.readyState >= 2 && layer.video.videoWidth ? layer.video : layer.poster;
        const width = source.videoWidth || source.naturalWidth;
        const height = source.videoHeight || source.naturalHeight;
        if (!width || !height) {
          context.fillStyle = '#f5f4ef';
          context.fillRect(0, 0, 390, 844);
          return;
        }
        const scale = Math.max(390 / width, 844 / height);
        const cropWidth = 390 / scale, cropHeight = 844 / scale;
        context.drawImage(source, (width - cropWidth) / 2, (height - cropHeight) / 2, cropWidth, cropHeight, 0, 0, 390, 844);
      });
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      texture.needsUpdate = true;
    }

    function wake() {
      if (!frame && !destroyed && allowed && inViewport && !document.hidden) frame = requestAnimationFrame(tick);
    }
    function invalidate() { dirty = true; wake(); }
    function tick(now) {
      frame = 0;
      if (destroyed || !allowed || !inViewport || document.hidden) { lastTime = 0; return; }
      try {
        const dt = Math.min(.05, lastTime ? (now - lastTime) / 1000 : 1 / 60);
        lastTime = now;
        let moving = false;
        // Analytic critically damped spring: preserve angular velocity across interruptions.
        for (let axis = 0; axis < 3; axis++) {
          const displacement = rotation[axis] - target[axis];
          if (reduced() || (Math.abs(displacement) < .0001 && Math.abs(velocity[axis]) < .0005)) {
            rotation[axis] = target[axis];
            velocity[axis] = 0;
            continue;
          }
          const omega = 8.5, decay = Math.exp(-omega * dt);
          const step = (velocity[axis] + omega * displacement) * dt;
          rotation[axis] = target[axis] + (displacement + step) * decay;
          velocity[axis] = (velocity[axis] - omega * step) * decay;
          moving = true;
        }
        device.rotation.set(...rotation);
        const progress = reduced() ? 1 : THREE.MathUtils.clamp((now - blendStart - 120) / 480, 0, 1);
        const blend = progress * progress * (3 - 2 * progress);
        const blending = progress < 1;
        weights.forEach((_, index) => {
          weights[index] = THREE.MathUtils.lerp(blendFrom[index], layers[index].key === selected ? 1 : 0, blend);
        });
        const videoChanged = layers.some((layer, index) => weights[index] > .001 && layer.video.readyState >= 2 && layer.video.currentTime !== previousTimes[index]);
        if (dirty || blending || videoChanged) paintScreen();
        if (dirty || moving || blending || videoChanged) {
          renderer.render(scene, camera);
        }
        dirty = false;
        const playing = layers.some((layer, index) => weights[index] > .001 && !layer.video.paused && !layer.video.ended);
        if (moving || blending || playing) wake();
        else lastTime = 0;
      } catch { destroy(); onError?.(); }
    }
    function resize() {
      const width = element.clientWidth || 300;
      const height = width * 6.4 / 3;
      renderer.setSize(Math.round(width * 1.16), Math.round(height * 1.1), false);
      camera.aspect = (width * 1.16) / (height * 1.1);
      const halfFov = Math.tan(THREE.MathUtils.degToRad(14));
      camera.position.set(0, .03, Math.max(7 / (2 * halfFov), 3.45 / (2 * halfFov * camera.aspect)));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      invalidate();
    }
    function select(key, immediate = false) {
      if (destroyed) return;
      selected = key;
      target = pose(key);
      blendFrom = [...weights];
      blendStart = performance.now();
      if (immediate || reduced()) {
        target.forEach((value, axis) => { rotation[axis] = value; velocity[axis] = 0; });
        weights.forEach((_, index) => { weights[index] = layers[index].key === key ? 1 : 0; });
        blendFrom = [...weights];
        blendStart = -Infinity;
      }
      invalidate();
    }
    function setVisible(value) {
      allowed = value;
      if (!value) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else invalidate();
    }

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      destroy();
      onError?.();
    }, { signal: events.signal });
    layers.forEach(layer => {
      ['playing', 'pause', 'loadeddata', 'seeked', 'error'].forEach(name => layer.video.addEventListener(name, invalidate, { signal: events.signal }));
      layer.poster.addEventListener('load', invalidate, { signal: events.signal });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else invalidate();
    }, { signal: events.signal });
    window.addEventListener('pagehide', event => { if (!event.persisted) destroy(); }, { signal: events.signal });
    resize();
    paintScreen();
    await renderer.compileAsync(scene, camera);
    if (destroyed) return null;
    renderer.render(scene, camera);
    element.append(canvas);
    element.classList.add('has-3d');
    modelCredit = document.createElement('small');
    modelCredit.className = 'work-preview-meta work-model-credit';
    modelCredit.title = 'iPhone model adapted with live project previews, custom lighting, and motion.';
    modelCredit.append('iPhone by ');
    const author = document.createElement('a');
    author.href = 'https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7';
    author.textContent = 'polyman';
    author.target = '_blank';
    author.rel = 'noopener noreferrer';
    const license = document.createElement('a');
    license.href = 'https://creativecommons.org/licenses/by/4.0/';
    license.textContent = 'CC BY 4.0';
    license.target = '_blank';
    license.rel = 'noopener noreferrer';
    modelCredit.append(author, ' / ', license);
    element.closest('.work-preview')?.querySelector('figcaption')?.append(modelCredit);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    intersectionObserver = new IntersectionObserver(entries => {
      inViewport = entries[0].isIntersecting;
      if (!inViewport) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else invalidate();
    });
    intersectionObserver.observe(element);
    return { select, setVisible, invalidate, destroy };
  } catch {
    destroy();
    return null;
  }
}
