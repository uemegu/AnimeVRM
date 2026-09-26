import * as THREE from 'three';
import { farTableSet } from './blockout';
import { FAR_TABLE_IMAGE_SIZE, farTableCamera } from './layout';

/** Grey-box far reading table set, rendered from its projection camera. */
const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(...FAR_TABLE_IMAGE_SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d8d8d8');
scene.add(new THREE.HemisphereLight('#ffffff', '#777777', 1.6));
const sun = new THREE.DirectionalLight('#fff3e0', 2.2);
sun.position.set(-4, 3, 1);
scene.add(sun);
scene.add(farTableSet());
renderer.render(scene, farTableCamera());
document.body.dataset.ready = 'true';
