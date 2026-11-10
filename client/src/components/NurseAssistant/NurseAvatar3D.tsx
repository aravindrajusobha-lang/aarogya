import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AnimationState, NurseExpression, NurseGesture } from './types';
import { ANIMATION_PROFILES, AnimationProfile } from './SemanticAnimationEngine';

interface NurseAvatar3DProps {
  animationState: AnimationState;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  expression?: NurseExpression;
  gesture?: NurseGesture;
  mode?: 'portrait' | 'full';
  className?: string;
  width?: number | string;
  height?: number | string;
  onCanvasClick?: () => void;
}

// UV Coordinate calculation for the official 1024x682 reference sheet
// Top half (Y 0 to 0.5): 8 body turnarounds (X: 0 to 7)
// Bottom half (Y 0.5 to 1.0): 9 emotion / gesture busts (X: 0 to 8)
const getExpressionUVOffset = (index: number) => {
  const safeIndex = Math.max(0, Math.min(8, index));
  const uWidth = 1.0 / 9.0;
  const u = safeIndex * uWidth;
  // In Three.js texture coordinate system, Y=0 is bottom, Y=1 is top.
  // The bottom half of our image corresponds to Y from 0.0 to 0.5 in Three.js UV
  return { uOffset: u, vOffset: 0.0, uScale: uWidth, vScale: 0.5 };
};

export const NurseAvatar3D: React.FC<NurseAvatar3DProps> = ({
  animationState,
  isSpeaking,
  isListening,
  isThinking,
  expression,
  gesture,
  mode = 'portrait',
  className = '',
  width,
  height,
  onCanvasClick,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [characterLoaded, setCharacterLoaded] = useState<boolean>(false);
  const [viewAngle, setViewAngle] = useState<'portrait' | 'full'>(mode);

  // Animation interpolation state refs
  const profileRef = useRef<AnimationProfile>(ANIMATION_PROFILES[animationState] || ANIMATION_PROFILES.idle);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const isListeningRef = useRef<boolean>(isListening);
  const isThinkingRef = useRef<boolean>(isThinking);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const userRotationRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMouseXRef = useRef<number>(0);

  // Update refs when props change
  useEffect(() => {
    const base = ANIMATION_PROFILES[animationState] || ANIMATION_PROFILES.idle;
    profileRef.current = {
      ...base,
      expression: expression || base.expression,
      gesture: gesture || base.gesture,
    };
  }, [animationState, expression, gesture]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    setViewAngle(mode);
  }, [mode]);

  // Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 340;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    const targetCameraPos = viewAngle === 'portrait' ? new THREE.Vector3(0, 0.42, 2.3) : new THREE.Vector3(0, 0.15, 3.4);
    camera.position.copy(targetCameraPos);
    camera.lookAt(viewAngle === 'portrait' ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(0, 0.1, 0));

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 4. Lighting System
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc9e7f3, 0.7);
    fillLight.position.set(-2, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffdfd0, 0.9);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // 5. Build Rigged 3D Character Model Hierarchy
    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // Materials
    const uniformWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xfffefa,
      roughness: 0.45,
      metalness: 0.05,
    });

    const borderBlueMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
    });

    const stethoscopeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2,
    });

    const metallicSilverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1,
    });

    const skinToneMat = new THREE.MeshStandardMaterial({
      color: 0xfbd0b4,
      roughness: 0.6,
    });

    const redCrossMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

    // Torso / Jacket
    const torsoGroup = new THREE.Group();
    characterRoot.add(torsoGroup);

    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.68, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, uniformWhiteMat);
    torsoMesh.position.y = 0.08;
    torsoGroup.add(torsoMesh);

    // Blue collar borders
    const collarBorderGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 24, Math.PI);
    const collarBorder = new THREE.Mesh(collarBorderGeo, borderBlueMat);
    collarBorder.rotation.x = Math.PI / 2;
    collarBorder.position.set(0, 0.41, 0.06);
    torsoGroup.add(collarBorder);

    // Stethoscope around neck
    const stethGroup = new THREE.Group();
    torsoGroup.add(stethGroup);

    const stethCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 0.44, 0.0),
      new THREE.Vector3(-0.14, 0.2, 0.18),
      new THREE.Vector3(0.0, 0.06, 0.22),
      new THREE.Vector3(0.14, 0.2, 0.18),
      new THREE.Vector3(0.16, 0.44, 0.0),
    ]);
    const stethGeo = new THREE.TubeGeometry(stethCurve, 24, 0.012, 8, false);
    const stethMesh = new THREE.Mesh(stethGeo, stethoscopeMat);
    stethGroup.add(stethMesh);

    // Stethoscope chest piece
    const chestPieceGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16);
    const chestPiece = new THREE.Mesh(chestPieceGeo, metallicSilverMat);
    chestPiece.rotation.x = Math.PI / 2;
    chestPiece.position.set(0.0, 0.06, 0.24);
    stethGroup.add(chestPiece);

    // Neck & Head Group
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.42, 0);
    torsoGroup.add(neckGroup);

    const neckGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12);
    const neckMesh = new THREE.Mesh(neckGeo, skinToneMat);
    neckMesh.position.y = 0.06;
    neckGroup.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.14, 0);
    neckGroup.add(headGroup);

    // 3D Head Base
    const headGeo = new THREE.SphereGeometry(0.25, 24, 24);
    headGeo.scale(1.0, 1.15, 1.0);
    const headMesh = new THREE.Mesh(headGeo, skinToneMat);
    headGroup.add(headMesh);

    // Nurse Cap
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.24, -0.04);
    headGroup.add(capGroup);

    const capGeo = new THREE.ConeGeometry(0.24, 0.18, 16, 1, true, 0, Math.PI);
    const capMesh = new THREE.Mesh(capGeo, uniformWhiteMat);
    capMesh.rotation.x = 0.2;
    capGroup.add(capMesh);

    // Cap Blue Brim
    const capBrimGeo = new THREE.TorusGeometry(0.22, 0.012, 6, 24, Math.PI);
    const capBrim = new THREE.Mesh(capBrimGeo, borderBlueMat);
    capBrim.rotation.x = Math.PI / 2 + 0.2;
    capBrim.position.set(0, -0.04, 0.04);
    capGroup.add(capBrim);

    // Red Cross Emblem
    const crossVertGeo = new THREE.BoxGeometry(0.016, 0.05, 0.005);
    const crossHorizGeo = new THREE.BoxGeometry(0.05, 0.016, 0.005);
    const crossV = new THREE.Mesh(crossVertGeo, redCrossMat);
    const crossH = new THREE.Mesh(crossHorizGeo, redCrossMat);
    crossV.position.set(0, 0.05, 0.16);
    crossH.position.set(0, 0.05, 0.16);
    capGroup.add(crossV);
    capGroup.add(crossH);

    // Hair bun behind cap
    const bunGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const bunMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const bunMesh = new THREE.Mesh(bunGeo, bunMat);
    bunMesh.position.set(0, 0.12, -0.22);
    headGroup.add(bunMesh);

    // Dynamic Facial Expression Projection Plane (Mapped from Reference Sheet!)
    let facePlaneMesh: THREE.Mesh | null = null;
    let faceTexture: THREE.Texture | null = null;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/assets/nurse/nurse-reference-sheet.png',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        faceTexture = tex;

        // Plane for expression bust projection
        const planeGeo = new THREE.PlaneGeometry(0.64, 0.64);
        const planeMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.98,
          side: THREE.DoubleSide,
          depthTest: false,
        });

        // Initial UV mapping to frame 0
        const { uOffset, vOffset, uScale, vScale } = getExpressionUVOffset(0);
        tex.offset.set(uOffset, vOffset);
        tex.repeat.set(uScale, vScale);

        facePlaneMesh = new THREE.Mesh(planeGeo, planeMat);
        facePlaneMesh.position.set(0, 0.04, 0.23);
        headGroup.add(facePlaneMesh);
        setCharacterLoaded(true);
      },
      undefined,
      (err) => {
        console.warn('Could not load nurse texture sheet; using 3D procedural features', err);
        setCharacterLoaded(true);
      }
    );

    // Procedural Arms with Joint Hierarchy
    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.28, 0.38, 0);
    torsoGroup.add(leftArmGroup);

    const upperArmGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.28, 12);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, uniformWhiteMat);
    leftUpperArm.position.y = -0.14;
    leftArmGroup.add(leftUpperArm);

    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.set(0, -0.28, 0);
    leftArmGroup.add(leftForearmGroup);

    const forearmGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.26, 12);
    const leftForearm = new THREE.Mesh(forearmGeo, skinToneMat);
    leftForearm.position.y = -0.13;
    leftForearmGroup.add(leftForearm);

    // Right Arm (Gesture Arm)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.28, 0.38, 0);
    torsoGroup.add(rightArmGroup);

    const rightUpperArm = new THREE.Mesh(upperArmGeo, uniformWhiteMat);
    rightUpperArm.position.y = -0.14;
    rightArmGroup.add(rightUpperArm);

    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.set(0, -0.28, 0);
    rightArmGroup.add(rightForearmGroup);

    const rightForearm = new THREE.Mesh(forearmGeo, skinToneMat);
    rightForearm.position.y = -0.13;
    rightForearmGroup.add(rightForearm);

    // Clipboard accessory for right arm in demonstration/pointing poses
    const clipboardGroup = new THREE.Group();
    clipboardGroup.position.set(0.08, -0.18, 0.12);
    clipboardGroup.rotation.set(0.2, -0.3, 0.1);
    rightForearmGroup.add(clipboardGroup);

    const boardGeo = new THREE.BoxGeometry(0.18, 0.26, 0.015);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    clipboardGroup.add(boardMesh);

    const paperGeo = new THREE.BoxGeometry(0.15, 0.22, 0.005);
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const paperMesh = new THREE.Mesh(paperGeo, paperMat);
    paperMesh.position.z = 0.01;
    clipboardGroup.add(paperMesh);

    // Legs & Feet (Visible in full-body view)
    const legsGroup = new THREE.Group();
    legsGroup.position.set(0, -0.26, 0);
    characterRoot.add(legsGroup);

    const legGeo = new THREE.CylinderGeometry(0.085, 0.07, 0.65, 12);
    const leftLeg = new THREE.Mesh(legGeo, uniformWhiteMat);
    leftLeg.position.set(-0.11, -0.32, 0);
    legsGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, uniformWhiteMat);
    rightLeg.position.set(0.11, -0.32, 0);
    legsGroup.add(rightLeg);

    const shoeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.18);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.11, -0.66, 0.03);
    legsGroup.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.11, -0.66, 0.03);
    legsGroup.add(rightShoe);

    // Mouse Tracking & Drag Orbit Event Handlers
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current = { x: Math.max(-1, Math.min(1, normX)), y: Math.max(-1, Math.min(1, normY)) };

      if (isDraggingRef.current) {
        const deltaX = e.clientX - lastMouseXRef.current;
        userRotationRef.current += deltaX * 0.012;
        lastMouseXRef.current = e.clientX;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      lastMouseXRef.current = e.clientX;
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // 6. Animation Clock & Render Loop
    const clock = new THREE.Clock();
    let animationFrameId: number;
    let blinkTimer = 0;
    let isBlinking = false;
    let currentTextureIndex = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      clock.getDelta();
      const profile = profileRef.current;

      // Smooth camera position based on mode
      const desiredCamPos = viewAngle === 'portrait' ? new THREE.Vector3(0, 0.42, 2.3) : new THREE.Vector3(0, 0.15, 3.4);
      camera.position.lerp(desiredCamPos, 0.08);

      // Smooth Character Turn Angle + User Orbit Drag
      const targetYRotation = profile.bodyTurnAngle + userRotationRef.current + mousePosRef.current.x * 0.15;
      characterRoot.rotation.y = THREE.MathUtils.lerp(characterRoot.rotation.y, targetYRotation, 0.08);

      // Procedural Breathing (Sinusoidal vertical & chest sway)
      const breath = Math.sin(elapsedTime * 2.2 * profile.breathingRate) * profile.torsoSway;
      torsoGroup.position.y = breath;
      torsoMesh.scale.x = 1.0 + breath * 0.4;
      torsoMesh.scale.z = 1.0 + breath * 0.4;

      // Attentive Listening Head Nods or Speaking Head Gestures
      const speechNod = isSpeakingRef.current ? Math.sin(elapsedTime * 6.0) * 0.04 : 0.0;
      const listeningTilt = isListeningRef.current ? Math.sin(elapsedTime * 1.5) * 0.03 : 0.0;

      // Head Tilting & Eye Tracking (lerp)
      const targetHeadPitch = profile.headPitch + speechNod + mousePosRef.current.y * 0.1;
      const targetHeadRoll = profile.headTilt + listeningTilt - mousePosRef.current.x * 0.08;
      headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadPitch, 0.08);
      headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, targetHeadRoll, 0.08);

      // Right Arm Rotation (Main Gesture Arm)
      const targetR = profile.rightArmAngle;
      rightArmGroup.rotation.x = THREE.MathUtils.lerp(rightArmGroup.rotation.x, targetR.x, 0.1);
      rightArmGroup.rotation.y = THREE.MathUtils.lerp(rightArmGroup.rotation.y, targetR.y, 0.1);
      rightArmGroup.rotation.z = THREE.MathUtils.lerp(rightArmGroup.rotation.z, targetR.z, 0.1);

      // Left Arm Rotation
      const targetL = profile.leftArmAngle;
      leftArmGroup.rotation.x = THREE.MathUtils.lerp(leftArmGroup.rotation.x, targetL.x, 0.1);
      leftArmGroup.rotation.y = THREE.MathUtils.lerp(leftArmGroup.rotation.y, targetL.y, 0.1);
      leftArmGroup.rotation.z = THREE.MathUtils.lerp(leftArmGroup.rotation.z, targetL.z, 0.1);

      // Clipboard visibility (visible during demo, pointing, or thinking)
      clipboardGroup.visible =
        profile.state === 'demonstrating' ||
        profile.state === 'pointing' ||
        profile.state === 'explaining' ||
        profile.state === 'idle';

      // Update Texture Frame UV offset if active expression changes
      if (faceTexture && facePlaneMesh && currentTextureIndex !== profile.textureFrameIndex) {
        currentTextureIndex = profile.textureFrameIndex;
        const { uOffset, vOffset, uScale, vScale } = getExpressionUVOffset(currentTextureIndex);
        faceTexture.offset.set(uOffset, vOffset);
        faceTexture.repeat.set(uScale, vScale);
      }

      // Blinking & Speech Morphing
      blinkTimer += 0.016;
      if (blinkTimer > 3.4) {
        isBlinking = true;
        if (blinkTimer > 3.56) {
          isBlinking = false;
          blinkTimer = 0;
        }
      }

      // Lip-sync / speaking pulse
      if (isSpeakingRef.current && facePlaneMesh) {
        const mouthMorph = Math.sin(elapsedTime * 14.0) * 0.02;
        facePlaneMesh.scale.y = 1.0 + mouthMorph;
      } else if (facePlaneMesh) {
        facePlaneMesh.scale.y = isBlinking ? 0.94 : 1.0;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 320;
      const h = container.clientHeight || 340;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [viewAngle]);

  return (
    <div
      className={`nurse-3d-viewport-wrapper ${className}`}
      style={{
        position: 'relative',
        width: width || '100%',
        height: height || '100%',
        minHeight: height ? undefined : '260px',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
      }}
      onClick={onCanvasClick}
      title="Click & Drag to rotate 3D Nurse Assistant"
    >
      {/* 3D WebGL Canvas Mount */}
      {webGlSupported ? (
        <>
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
          {!characterLoaded && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#34d399',
                fontSize: '0.72rem',
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              Loading 3D Character...
            </div>
          )}
        </>
      ) : (
        /* High-Definition 2D Fallback for non-WebGL devices */
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle, #fbf8f1 0%, #e2e8f0 100%)',
          }}
        >
          <img
            src="/assets/nurse/nurse-reference-sheet.png"
            alt="Drishti 3D Nurse Character"
            style={{
              maxHeight: '90%',
              maxWidth: '90%',
              objectFit: 'contain',
              filter: isThinking ? 'brightness(0.95)' : 'none',
              transform: isSpeaking ? 'scale(1.02)' : 'scale(1.0)',
              transition: 'all 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Floating 3D Interaction Control Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewAngle((prev) => (prev === 'portrait' ? 'full' : 'portrait'));
          }}
          className="btn-pill-xs"
          style={{
            background: 'rgba(32, 41, 67, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '0.68rem',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
          title={viewAngle === 'portrait' ? 'Switch to Full Body View' : 'Switch to Portrait View'}
        >
          {viewAngle === 'portrait' ? '👤 Portrait' : '🧍 Full Body'}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            userRotationRef.current = 0;
          }}
          className="btn-pill-xs"
          style={{
            background: 'rgba(32, 41, 67, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '0.68rem',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
          title="Reset Character Rotation to Front"
        >
          🔄 Recenter
        </button>
      </div>

      {/* Semantic Animation State Indicator Pill */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background:
            animationState === 'warning'
              ? 'rgba(239, 68, 68, 0.9)'
              : animationState === 'success'
              ? 'rgba(16, 185, 129, 0.9)'
              : animationState === 'thinking'
              ? 'rgba(245, 158, 11, 0.9)'
              : 'rgba(32, 41, 67, 0.85)',
          color: '#ffffff',
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          zIndex: 10,
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: isSpeaking ? '#34d399' : isListening ? '#f87171' : '#ffffff',
            display: 'inline-block',
          }}
        />
        <span>{animationState}</span>
        {isSpeaking && <span style={{ fontSize: '0.6rem' }}>• SPEAKING</span>}
        {isListening && <span style={{ fontSize: '0.6rem' }}>• LISTENING</span>}
      </div>
    </div>
  );
};
