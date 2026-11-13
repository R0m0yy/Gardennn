import * as THREE from 'three';
import { buildGarden, QUALITY, vegU } from './world/garden.js';
import { buildStructures } from './world/structures.js';
import { Sky } from './world/sky.js';
import { Weather, groundHeight } from './sim/world.js';
const params = new URLSearchParams(location.search);
const qKey = params.get('q') || 'medium', q = QUALITY[qKey];
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, q.pr)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 150);
const weather = new Weather(), garden = buildGarden(scene, q), st = buildStructures(scene), sky = new Sky(scene, renderer, q);
const cam = (params.get('cam') || '0.9,0.55,1.3,-0.2,0.08,-0.3').split(',').map(Number);
camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(cam[3], cam[4], cam[5]);
const focus = new THREE.Vector3(cam[3], cam[4], cam[5]); let t = 0;
function frame() { t += 1 / 60; vegU.uTime.value = t; sky.update(1 / 60, focus, weather, 1 / 60); renderer.render(scene, camera); requestAnimationFrame(frame); window.__frames = (window.__frames || 0) + 1; }
document.getElementById('boot').remove(); frame();
