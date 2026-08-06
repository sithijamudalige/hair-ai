import React, { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Cylinder, Sphere, useGLTF, Center, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const MannequinHead = ({ textureUrl }: { textureUrl: string }) => {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  return (
    <mesh position={[0, -0.3, 0]} scale={[1, 1.2, 1]}>
      <sphereGeometry args={[1.2, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.5} />
    </mesh>
  );
};

const getHairColor = (skinColor: string) => {
  if (skinColor === 'dark') return "#0a0a0a";
  if (skinColor === 'mid-dark') return "#160e0c";
  if (skinColor === 'mid-light') return "#2d1f1b"; 
  if (skinColor === 'light') return "#4a3328";
  return "#2d1f1b";
};

// Custom AI Generated Model Component
const CustomPrimitive = ({ url, scale = 2.5 }: { url: string, scale?: number }) => {
  const { scene } = useGLTF(url);
  // Downloaded models often have wildly broken pivot points. <Center> forces the mesh to 0,0,0!
  return (
    <Center position={[0, 0, 0]}>
      <primitive object={scene} scale={[scale, scale, scale]} rotation={[0, Math.PI, 0]} />
    </Center>
  );
};

// 0. Procedural Beard (Hair Border matching skin tone)
const ProceduralBeard = ({ color }: { color: string }) => {
  return (
    <group position={[0, -2.0, 0.4]}>
      <mesh scale={[1.2, 0.8, 1.2]} rotation={[Math.PI / 8, 0, 0]}>
        {/* A curved geometric shape wrapping the chin */}
        <sphereGeometry args={[1, 32, 16, 0, Math.PI, 0, Math.PI / 2.5]} />
        <meshStandardMaterial color={color} roughness={1.0} />
      </mesh>
    </group>
  );
};

// 1. Procedural Fade Hair
const FadeHair = ({ color }: { color: string }) => {
  return (
    <group position={[0, -0.2, 0]}>
      <mesh scale={[1.4, 1.1, 1.4]} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
};

// 2. Procedural Dreads Hair
const DreadsHair = ({ color }: { color: string }) => {
  const dreads = Array.from({ length: 45 }).map((_, i) => {
    const angle = (i / 45) * Math.PI * 2;
    const radius = 1.0;
    const x = Math.cos(angle) * radius * Math.random();
    const z = Math.sin(angle) * radius * Math.random();
    return (
      <Cylinder key={i} args={[0.08, 0.05, 1.8, 8]} position={[x, -0.2, z]} rotation={[Math.random() * 0.8, 0, Math.random() * 0.8]}>
        <meshStandardMaterial color={color} roughness={1} />
      </Cylinder>
    );
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh scale={[1.3, 1, 1.3]} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {dreads}
    </group>
  );
};

// 3. Procedural Long Wavy
const LongWavyHair = ({ color }: { color: string }) => {
  return (
    <group position={[0, 0, 0]}>
      <mesh scale={[1.5, 1.2, 1.5]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <Cylinder args={[1.5, 1.7, 2.5, 32, 1, true, -Math.PI / 2, Math.PI]} position={[0, -1.2, 0]}>
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
      </Cylinder>
    </group>
  );
};

export const HairOverlay3D = ({ activeHair, facePose, skinColor, customUrl, customScale = 2.5, isAvatarMode = false, avatarTexture = null }: { activeHair: number, facePose: number[] | null, skinColor: string, customUrl?: string | null, customScale?: number, isAvatarMode?: boolean, avatarTexture?: string | null }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  const hairColor = getHairColor(skinColor);

  useFrame(() => {
    if (!isAvatarMode && groupRef.current && facePose) {
      // Apply InsightFace 3D Pose (Pitch, Yaw, Roll)
      // InsightFace returns roughly [pitch, yaw, roll] in radians
      const pitch = facePose[0];
      const yaw = facePose[1];
      const roll = facePose[2];
      
      // Invert axes to map from InsightFace to Three.js coordinate system
      groupRef.current.rotation.set(-pitch, -yaw, -roll);
    }
  });

  return (
    <>
      {isAvatarMode && <OrbitControls enablePan={true} minDistance={2} maxDistance={10} />}
      <group ref={groupRef} scale={[1, 1, 1]}>
        {isAvatarMode && avatarTexture && (
          <Suspense fallback={null}>
            <MannequinHead textureUrl={avatarTexture} />
          </Suspense>
        )}
        
        {activeHair === 1 && (
        <group>
          <FadeHair color={hairColor} />
          <ProceduralBeard color={hairColor} />
        </group>
      )}
      {activeHair === 2 && (
        <group>
          <DreadsHair color={hairColor} />
          <ProceduralBeard color={hairColor} />
        </group>
      )}
      {activeHair === 3 && (
        <group>
          <LongWavyHair color={hairColor} />
          <ProceduralBeard color={hairColor} />
        </group>
      )}
      {activeHair === 99 && customUrl && (
        <group>
          <CustomPrimitive url={customUrl} scale={customScale} />
          {/* Optional: <ProceduralBeard color={hairColor} /> */}
        </group>
      )}
      </group>
    </>
  );
};
