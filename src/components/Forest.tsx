import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Tree } from '@dgreenheck/ez-tree';
import { BirdAudio } from '../lib/BirdAudio';
import { AmbientAudio } from '../lib/AmbientAudio';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Forest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<BirdAudio | null>(null);
  const ambientAudioRef = useRef<AmbientAudio | null>(null);
  const controlsRef = useRef({
    lookUp: false,
    lookDown: false,
    lookLeft: false,
    lookRight: false,
    moveForward: false,
    moveBackward: false,
  });

  useEffect(() => {
    if (!started || !mountRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    mountRef.current.appendChild(renderer.domElement);

    // --- Lighting ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffee, 1.5);
    sunLight.position.set(300, 400, 200);
    sunLight.castShadow = false;
    scene.add(sunLight);

    const sunGeo = new THREE.SphereGeometry(30, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunLight.position);
    
    // Sun Glare (Glow Effect)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const glowTexture = new THREE.CanvasTexture(canvas);
    const glowMaterial = new THREE.SpriteMaterial({ 
      map: glowTexture, 
      blending: THREE.AdditiveBlending, 
      transparent: true, 
      depthWrite: false 
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(400, 400, 1);
    sunMesh.add(glowSprite);
    
    scene.add(sunMesh);

    // --- Terrain ---
    function getElevation(x: number, z: number) {
      let y = 0;
      y += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 15;
      y += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
      y += Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
      return y;
    }

    const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 50, 50);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getElevation(x, z));
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9, flatShading: true });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // --- Wind Uniforms ---
    const customUniforms = {
      time: { value: 0 },
      windStrength: { value: 0.2 }
    };

    const treeShaderInject = (shader: any) => {
      shader.uniforms.time = customUniforms.time;
      shader.uniforms.windStrength = customUniforms.windStrength;

      shader.vertexShader = `
        uniform float time;
        uniform float windStrength;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float heightFactor = max(0.0, position.y + 2.0);
        
        float sway = sin(time * 2.0 + instanceWorldPos.x * 0.05 + instanceWorldPos.z * 0.05) * windStrength;
        transformed.x += sway * heightFactor * 0.15;
        transformed.z += cos(time * 1.5 + instanceWorldPos.z * 0.05) * windStrength * heightFactor * 0.15;
        `
      );
    };

    const grassShaderInject = (shader: any) => {
      shader.uniforms.time = customUniforms.time;
      shader.uniforms.windStrength = customUniforms.windStrength;

      shader.vertexShader = `
        uniform float time;
        uniform float windStrength;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        
        vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float heightFactor = max(0.0, position.y); // Grass origin is at bottom
        
        float sway = sin(time * 3.0 + instanceWorldPos.x * 0.1 + instanceWorldPos.z * 0.1) * windStrength;
        transformed.x += sway * heightFactor * 0.4;
        transformed.z += cos(time * 2.5 + instanceWorldPos.z * 0.1) * windStrength * heightFactor * 0.4;
        `
      );
    };

    // --- Trees ---
    const pineCount = 1200;
    const oakCount = 800;
    const ashCount = 500;
    const treeCount = pineCount + oakCount + ashCount;
    
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 1.0 });
    trunkMat.onBeforeCompile = treeShaderInject;

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    leafMat.onBeforeCompile = treeShaderInject;

    // Generate Pine
    const pineTree = new Tree();
    pineTree.loadPreset('Pine Small');
    pineTree.options.branch.segments[0] = 3;
    pineTree.options.branch.segments[1] = 3;
    pineTree.options.branch.segments[2] = 3;
    pineTree.options.branch.segments[3] = 3;
    pineTree.options.branch.sections[0] = 2;
    pineTree.options.branch.sections[1] = 2;
    pineTree.options.branch.sections[2] = 2;
    pineTree.options.branch.sections[3] = 2;
    pineTree.generate();
    const pineTrunkGeo = pineTree.branchesMesh.geometry;
    const pineLeafGeo = pineTree.leavesMesh.geometry;
    
    const pineTrunkMesh = new THREE.InstancedMesh(pineTrunkGeo, trunkMat, pineCount);
    const pineLeafMesh = new THREE.InstancedMesh(pineLeafGeo, leafMat, pineCount);
    pineTrunkMesh.castShadow = false; pineTrunkMesh.receiveShadow = false;
    pineLeafMesh.castShadow = false; // Disabled for performance

    // Generate Oak
    const oakTree = new Tree();
    oakTree.loadPreset('Oak Small');
    oakTree.options.branch.segments[0] = 3;
    oakTree.options.branch.segments[1] = 3;
    oakTree.options.branch.segments[2] = 3;
    oakTree.options.branch.segments[3] = 3;
    oakTree.options.branch.sections[0] = 2;
    oakTree.options.branch.sections[1] = 2;
    oakTree.options.branch.sections[2] = 2;
    oakTree.options.branch.sections[3] = 2;
    oakTree.generate();
    const oakTrunkGeo = oakTree.branchesMesh.geometry;
    const oakLeafGeo = oakTree.leavesMesh.geometry;

    const oakTrunkMesh = new THREE.InstancedMesh(oakTrunkGeo, trunkMat, oakCount);
    const oakLeafMesh = new THREE.InstancedMesh(oakLeafGeo, leafMat, oakCount);
    oakTrunkMesh.castShadow = false; oakTrunkMesh.receiveShadow = false;
    oakLeafMesh.castShadow = false; // Disabled for performance

    // Generate Ash
    const ashTree = new Tree();
    ashTree.loadPreset('Ash Small');
    ashTree.options.branch.segments[0] = 3;
    ashTree.options.branch.segments[1] = 3;
    ashTree.options.branch.segments[2] = 3;
    ashTree.options.branch.segments[3] = 3;
    ashTree.options.branch.sections[0] = 2;
    ashTree.options.branch.sections[1] = 2;
    ashTree.options.branch.sections[2] = 2;
    ashTree.options.branch.sections[3] = 2;
    ashTree.generate();
    const ashTrunkGeo = ashTree.branchesMesh.geometry;
    const ashLeafGeo = ashTree.leavesMesh.geometry;

    const ashTrunkMesh = new THREE.InstancedMesh(ashTrunkGeo, trunkMat, ashCount);
    const ashLeafMesh = new THREE.InstancedMesh(ashLeafGeo, leafMat, ashCount);
    ashTrunkMesh.castShadow = false; ashTrunkMesh.receiveShadow = false;
    ashLeafMesh.castShadow = false; // Disabled for performance

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const treePositions: {x: number, z: number, radius: number}[] = [];

    let pineIdx = 0;
    let oakIdx = 0;
    let ashIdx = 0;

    for (let i = 0; i < treeCount; i++) {
      const x = (Math.random() - 0.5) * 1800;
      const z = (Math.random() - 0.5) * 1800;
      const y = getElevation(x, z);
      const scale = 0.5 + Math.random() * 1.5;
      
      treePositions.push({ x, z, radius: scale * 1.5 });

      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();

      const shade = 0.6 + Math.random() * 0.4;
      color.setRGB(shade, shade, shade);

      if (i < pineCount) {
        pineTrunkMesh.setMatrixAt(pineIdx, dummy.matrix);
        pineLeafMesh.setMatrixAt(pineIdx, dummy.matrix);
        pineLeafMesh.setColorAt(pineIdx, color);
        pineIdx++;
      } else if (i < pineCount + oakCount) {
        oakTrunkMesh.setMatrixAt(oakIdx, dummy.matrix);
        oakLeafMesh.setMatrixAt(oakIdx, dummy.matrix);
        oakLeafMesh.setColorAt(oakIdx, color);
        oakIdx++;
      } else {
        ashTrunkMesh.setMatrixAt(ashIdx, dummy.matrix);
        ashLeafMesh.setMatrixAt(ashIdx, dummy.matrix);
        ashLeafMesh.setColorAt(ashIdx, color);
        ashIdx++;
      }
    }
    
    if (pineLeafMesh.instanceColor) pineLeafMesh.instanceColor.needsUpdate = true;
    if (oakLeafMesh.instanceColor) oakLeafMesh.instanceColor.needsUpdate = true;
    if (ashLeafMesh.instanceColor) ashLeafMesh.instanceColor.needsUpdate = true;

    scene.add(pineTrunkMesh);
    scene.add(pineLeafMesh);
    scene.add(oakTrunkMesh);
    scene.add(oakLeafMesh);
    scene.add(ashTrunkMesh);
    scene.add(ashLeafMesh);

    // --- External 3D Models (GLTF/GLB) ---
    // Uncomment and use this function to load real 3D models from the internet
    /*
    const loadExternalTree = (url: string, position: THREE.Vector3, scale: number) => {
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        const model = gltf.scene;
        model.position.copy(position);
        model.scale.set(scale, scale, scale);
        
        // Enable shadows for the model
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        scene.add(model);
      }, undefined, (error) => {
        console.error('Error loading 3D model:', error);
      });
    };
    
    // Example usage:
    // loadExternalTree('https://example.com/tree.glb', new THREE.Vector3(0, 0, -10), 1.5);
    */

    // --- Grass ---
    const grassCount = 2000;
    const grassGeo = new THREE.PlaneGeometry(0.4, 2.0, 1, 3);
    grassGeo.translate(0, 1.0, 0); // Move origin to bottom
    const grassMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      roughness: 0.8, 
      side: THREE.DoubleSide 
    });
    grassMat.onBeforeCompile = grassShaderInject;
    const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    grassMesh.receiveShadow = true;
    
    const grassDummy = new THREE.Object3D();
    const grassColor = new THREE.Color();
    for (let i = 0; i < grassCount; i++) {
      const x = (Math.random() - 0.5) * 1800;
      const z = (Math.random() - 0.5) * 1800;
      const y = getElevation(x, z);
      
      grassDummy.position.set(x, y, z);
      grassDummy.rotation.y = Math.random() * Math.PI;
      const scale = 0.5 + Math.random() * 0.8;
      grassDummy.scale.set(scale, scale, scale);
      grassDummy.updateMatrix();
      grassMesh.setMatrixAt(i, grassDummy.matrix);
      
      const shade = 0.6 + Math.random() * 0.4;
      grassColor.setRGB(shade, shade, shade);
      grassMesh.setColorAt(i, grassColor);
    }
    if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
    scene.add(grassMesh);

    // --- Clouds ---
    const cloudCount = 50;
    const cloudGeo = new THREE.SphereGeometry(15, 5, 5);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.9 });
    const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount * 5);

    let cloudIdx = 0;
    for (let i = 0; i < cloudCount; i++) {
      const cx = (Math.random() - 0.5) * 2000;
      const cy = 200 + Math.random() * 100;
      const cz = (Math.random() - 0.5) * 2000;

      for (let j = 0; j < 5; j++) {
        const x = cx + (Math.random() - 0.5) * 30;
        const y = cy + (Math.random() - 0.5) * 15;
        const z = cz + (Math.random() - 0.5) * 30;
        const scale = 0.5 + Math.random() * 1.5;

        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        cloudMesh.setMatrixAt(cloudIdx++, dummy.matrix);
      }
    }
    scene.add(cloudMesh);

    // --- Birds ---
    const birdCount = 40;
    const birdGeo = new THREE.ConeGeometry(1.5, 4, 3);
    birdGeo.rotateX(Math.PI / 2); // Point forward
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const birdMesh = new THREE.InstancedMesh(birdGeo, birdMat, birdCount);
    birdMesh.castShadow = true;
    const birdData: {x: number, y: number, z: number, speed: number, angle: number, flap: number}[] = [];
    
    for(let i=0; i<birdCount; i++) {
      birdData.push({
        x: (Math.random() - 0.5) * 1500,
        y: 150 + Math.random() * 100,
        z: (Math.random() - 0.5) * 1500,
        speed: 20 + Math.random() * 20,
        angle: Math.random() * Math.PI * 2,
        flap: Math.random() * Math.PI * 2
      });
    }
    scene.add(birdMesh);
    
    // --- Controls & Movement ---
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();
    
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    // Desktop Mouse Look
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === document.body) {
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= event.movementX * 0.002;
        euler.x -= event.movementY * 0.002;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
      }
    };

    // Desktop Keyboard Move
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
      }
    };

    // Mobile Touch Controls
    let touchLookId: number | null = null;
    let touchMoveId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const joystickDelta = new THREE.Vector2();

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth / 2) {
          // Right side: Look
          touchLookId = touch.identifier;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        } else {
          // Left side: Move
          touchMoveId = touch.identifier;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchLookId) {
          const deltaX = touch.clientX - lastTouchX;
          const deltaY = touch.clientY - lastTouchY;
          
          euler.setFromQuaternion(camera.quaternion);
          euler.y -= deltaX * 0.005;
          euler.x -= deltaY * 0.005;
          euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
          camera.quaternion.setFromEuler(euler);
          
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        } else if (touch.identifier === touchMoveId) {
          const centerX = window.innerWidth / 4;
          const centerY = window.innerHeight / 2;
          joystickDelta.x = (touch.clientX - centerX) / (window.innerWidth / 4);
          joystickDelta.y = (touch.clientY - centerY) / (window.innerHeight / 2);
          
          joystickDelta.x = Math.max(-1, Math.min(1, joystickDelta.x));
          joystickDelta.y = Math.max(-1, Math.min(1, joystickDelta.y));
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchLookId) {
          touchLookId = null;
        } else if (touch.identifier === touchMoveId) {
          touchMoveId = null;
          joystickDelta.set(0, 0);
        }
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
    renderer.domElement.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // --- Animation Loop ---
    let prevTime = performance.now();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = performance.now();
      const delta = (time - prevTime) / 1000;

      customUniforms.time.value = time / 1000;

      // Static Day Lighting
      sunMesh.position.set(300, 400, 200);
      sunLight.position.copy(sunMesh.position);
      sunLight.color.setHex(0xffffee);
      sunLight.intensity = 1.5;

      scene.background = new THREE.Color(0x87CEEB);
      (scene.fog as THREE.FogExp2).color.copy(scene.background);
      
      hemiLight.intensity = 0.6;
      glowMaterial.opacity = 1.0;

      // Static Colors
      leafMat.color.setHex(0x228b22);
      terrainMat.color.setHex(0x2e8b57);
      grassMat.color.setHex(0x2e8b57);
      
      let windIntensity = 0.2;
      customUniforms.windStrength.value = windIntensity;

      // Update Ambient Audio
      if (ambientAudioRef.current) {
        ambientAudioRef.current.update(delta, windIntensity);
      }

      // Birds animation
      for(let i=0; i<birdCount; i++) {
        const b = birdData[i];
        b.x += Math.cos(b.angle) * b.speed * delta;
        b.z += Math.sin(b.angle) * b.speed * delta;
        b.y += Math.sin(time * 0.001 + i) * 10 * delta; // slight bobbing
        b.flap += delta * 20;

        // Wrap around
        if (b.x > 1000) b.x = -1000;
        if (b.x < -1000) b.x = 1000;
        if (b.z > 1000) b.z = -1000;
        if (b.z < -1000) b.z = 1000;

        dummy.position.set(b.x, b.y, b.z);
        // Rotate to face movement direction, and add flapping roll
        dummy.rotation.set(0, -b.angle + Math.PI/2, Math.sin(b.flap) * 0.5, 'YXZ');
        dummy.scale.set(1, 0.2, 1); // Flatten cone to look like wings
        dummy.updateMatrix();
        birdMesh.setMatrixAt(i, dummy.matrix);
      }
      birdMesh.instanceMatrix.needsUpdate = true;

      // Cloud movement
      cloudMesh.rotation.y += 0.02 * delta;

      // Button Look Controls
      let lookChanged = false;
      const lookSpeed = 1.5 * delta;
      if (controlsRef.current.lookUp) { euler.x += lookSpeed; lookChanged = true; }
      if (controlsRef.current.lookDown) { euler.x -= lookSpeed; lookChanged = true; }
      if (controlsRef.current.lookLeft) { euler.y += lookSpeed; lookChanged = true; }
      if (controlsRef.current.lookRight) { euler.y -= lookSpeed; lookChanged = true; }
      
      if (lookChanged) {
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
      }

      // Physics / Movement
      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;

      const isMovingForward = moveForward || controlsRef.current.moveForward;
      const isMovingBackward = moveBackward || controlsRef.current.moveBackward;

      direction.z = Number(isMovingForward) - Number(isMovingBackward) - joystickDelta.y;
      direction.x = Number(moveRight) - Number(moveLeft) + joystickDelta.x;
      direction.normalize();

      const speed = 150.0;
      if (isMovingForward || isMovingBackward || joystickDelta.y !== 0) velocity.z -= direction.z * speed * delta;
      if (moveLeft || moveRight || joystickDelta.x !== 0) velocity.x -= direction.x * speed * delta;

      // Calculate next position
      const currentPos = camera.position.clone();
      camera.translateX(velocity.x * delta);
      camera.translateZ(velocity.z * delta);
      
      const nextX = camera.position.x;
      const nextZ = camera.position.z;
      
      // Tree Collision Detection
      let collision = false;
      const playerRadius = 1.5;
      
      for (let i = 0; i < treePositions.length; i++) {
        const tree = treePositions[i];
        const dx = nextX - tree.x;
        const dz = nextZ - tree.z;
        const distSq = dx * dx + dz * dz;
        const minDistance = playerRadius + tree.radius;
        
        if (distSq < minDistance * minDistance) {
          collision = true;
          break;
        }
      }
      
      if (collision) {
        // Revert to current position if colliding
        camera.position.copy(currentPos);
        velocity.x = 0;
        velocity.z = 0;
      }

      // Keep camera above terrain (Ground Collision)
      const terrainHeight = getElevation(camera.position.x, camera.position.z);
      // Smoothly interpolate Y to avoid sudden jumps, keeping it at least 6 units above ground
      const targetY = terrainHeight + 6;
      camera.position.y += (targetY - camera.position.y) * 0.1;
      
      // Hard floor to prevent clipping through ground
      if (camera.position.y < terrainHeight + 2) {
        camera.position.y = terrainHeight + 2;
      }

      // Keep within bounds
      camera.position.x = Math.max(-900, Math.min(900, camera.position.x));
      camera.position.z = Math.max(-900, Math.min(900, camera.position.z));

      renderer.render(scene, camera);
      prevTime = time;
    };

    animate();

    // --- Resize Handler ---
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onWindowResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', onTouchEnd);
      
      if ((window as any)._pointerLockClick) {
        document.body.removeEventListener('click', (window as any)._pointerLockClick);
      }
      if (audioRef.current) {
        audioRef.current.stop();
      }
      if (ambientAudioRef.current) {
        ambientAudioRef.current.stop();
      }
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [started]);

  const handleStart = () => {
    setStarted(true);
    
    // Init Audio
    if (!audioRef.current) {
      audioRef.current = new BirdAudio();
      audioRef.current.init();
    }
    if (!ambientAudioRef.current) {
      ambientAudioRef.current = new AmbientAudio();
      ambientAudioRef.current.init();
    }

    // Request Pointer Lock for Desktop
    if (!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) {
      document.body.requestPointerLock();
      
      const onClick = () => {
        if (document.pointerLockElement !== document.body) {
          document.body.requestPointerLock();
        }
      };
      
      document.body.addEventListener('click', onClick);
      
      // Store cleanup function in a ref or just let it be since the app is single-page
      // But for correctness, we can attach it to window to clean it up later if needed
      (window as any)._pointerLockClick = onClick;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-sky-300">
      {!started && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <h1 className="text-4xl font-bold text-white mb-6 text-center">Floresta Interativa 3D</h1>
          <p className="text-white/80 mb-8 text-center max-w-md px-4">
            Desktop: Use WASD para mover e o Mouse para olhar.<br/><br/>
            Mobile: Use a metade esquerda da tela para mover e a direita para olhar (funciona na horizontal).
          </p>
          <button 
            onClick={handleStart}
            className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold text-xl transition-transform hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
          >
            Entrar na Floresta
          </button>
        </div>
      )}
      
      {/* Controls Overlay */}
      {started && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Left Move Controls (Mobile only) */}
          <div className="absolute bottom-10 left-10 flex flex-col gap-4 pointer-events-auto sm:hidden">
            <button 
              className="w-16 h-16 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.moveForward = true; }}
              onPointerUp={() => controlsRef.current.moveForward = false}
              onPointerLeave={() => controlsRef.current.moveForward = false}
              onPointerCancel={() => controlsRef.current.moveForward = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowUp size={32} /></button>
            <button 
              className="w-16 h-16 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.moveBackward = true; }}
              onPointerUp={() => controlsRef.current.moveBackward = false}
              onPointerLeave={() => controlsRef.current.moveBackward = false}
              onPointerCancel={() => controlsRef.current.moveBackward = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowDown size={32} /></button>
          </div>
          
          {/* Right Look D-Pad */}
          <div className="absolute bottom-10 right-10 grid grid-cols-3 gap-2 pointer-events-auto">
            <div />
            <button 
              className="w-12 h-12 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.lookUp = true; }}
              onPointerUp={() => controlsRef.current.lookUp = false}
              onPointerLeave={() => controlsRef.current.lookUp = false}
              onPointerCancel={() => controlsRef.current.lookUp = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowUp size={24} /></button>
            <div />
            <button 
              className="w-12 h-12 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.lookLeft = true; }}
              onPointerUp={() => controlsRef.current.lookLeft = false}
              onPointerLeave={() => controlsRef.current.lookLeft = false}
              onPointerCancel={() => controlsRef.current.lookLeft = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowLeft size={24} /></button>
            <button 
              className="w-12 h-12 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.lookDown = true; }}
              onPointerUp={() => controlsRef.current.lookDown = false}
              onPointerLeave={() => controlsRef.current.lookDown = false}
              onPointerCancel={() => controlsRef.current.lookDown = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowDown size={24} /></button>
            <button 
              className="w-12 h-12 bg-black/30 hover:bg-black/50 active:bg-black/70 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 text-white transition-colors"
              onPointerDown={(e) => { e.stopPropagation(); controlsRef.current.lookRight = true; }}
              onPointerUp={() => controlsRef.current.lookRight = false}
              onPointerLeave={() => controlsRef.current.lookRight = false}
              onPointerCancel={() => controlsRef.current.lookRight = false}
              onClick={(e) => e.stopPropagation()}
            ><ArrowRight size={24} /></button>
          </div>
        </div>
      )}

      <div ref={mountRef} className="absolute inset-0 z-0" />
    </div>
  );
}
