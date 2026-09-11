import * as THREE from './vendor/three-0.180.0/three.module.min.js';
import { GLTFLoader } from './vendor/three-0.180.0/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/three-0.180.0/addons/loaders/DRACOLoader.js';

// Apple iPhone 15 Pro Max Black by polyman, CC BY 4.0.
// Full provenance and adaptation notes: media/work/models/ATTRIBUTION.md.
export async function loadIPhonePro() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('./vendor/three-0.180.0/draco/', import.meta.url).href);
  draco.setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let root;
  try {
    const asset = await loader.loadAsync(new URL('./media/work/models/iphone-15-pro-max.glb', import.meta.url).href);
    root = asset.scene;
    const display = root.getObjectByName('xXDHkMplTIDAXLN');
    if (!display?.isMesh) throw new Error('iPhone screen mesh unavailable');

    // The source faces -Z. Preserve all authored proportions and materials.
    root.rotation.y += Math.PI;
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    root.scale.multiplyScalar(6.24 / size.y);
    root.updateMatrixWorld(true);
    bounds.setFromObject(root);
    root.position.sub(bounds.getCenter(new THREE.Vector3()));
    root.updateMatrixWorld(true);

    // Map the live preview to the model's actual rounded display, not a floating plane.
    const screenBounds = new THREE.Box3().setFromObject(display);
    const screenSize = screenBounds.getSize(new THREE.Vector3());
    const positions = display.geometry.attributes.position;
    const uv = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 2), 2);
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(display.matrixWorld);
      uv.setXY(i, (vertex.x - screenBounds.min.x) / screenSize.x, (vertex.y - screenBounds.min.y) / screenSize.y);
    }
    display.geometry.setAttribute('uv', uv);
    return { root, display };
  } catch (error) {
    const textures = new Set();
    const materials = new Set();
    const geometries = new Set();
    root?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [].concat(object.material || [])) {
        materials.add(material);
        Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
      }
    });
    geometries.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    throw error;
  } finally {
    draco.dispose();
  }
}
