import * as THREE from "three";
let playing = false;
let delay = 0;
let magX = document.getElementById("X").value;
let magY = document.getElementById("Y").value;
let magZ = document.getElementById("Z").value;
let B = document.getElementById("B").value / 1000;
function StartSim() {
	let intro = document.getElementById("inputs");
	intro.textContent = "";
	playing = true;
}
document.getElementById("start").addEventListener("click", StartSim);
const width = window.innerWidth - 15;
const height = window.innerHeight - 15;
const length = (width + height) / 2;
let paused = false;
let charge = 1;
let sys;

let crosshair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
crosshair.position.set(0, 0, -3);
let center = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0x000000 }));
center.position.set(0, 0, 0);
let camera = new THREE.PerspectiveCamera(75, width / window.innerHeight, 0.01, 1000);
camera.position.set(0, 0, -5);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);
document.addEventListener('contextmenu', event => event.preventDefault());


function inv(val) {
	if (val) {
		val = false;
	} else {
		val = true;
	}
	return val;
}
function sign(n) {
	if (n >= 0) {
		return 1;
	} else {
		return -1;
	}
}

class Particle {
	constructor(x, y, z, mass, charge) {
		this.p = createVector(x, y, z);
		this.v = createVector(-0.1, 0, 0);
		this.a = createVector(0, 0, 0);
		this.m = mass;
		this.c = charge;
		this.accelArrow = new THREE.ArrowHelper(this.a, this.p, this.m + 1, new THREE.Color(0, 1, 0));
		let col = new THREE.Color(0.5, 0.5, 0.5);
		if (this.c > 0) {
			col = new THREE.Color(1, 0, 0);
		} else if (this.c < 0) {
			col = new THREE.Color(0, 0, 1);
		}
		this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.m, 10, 10), new THREE.MeshBasicMaterial({ color: col }));
		this.mesh.position.set(this.p.x, this.p.y, this.p.z);
	}
	addForce(force) {
		let f = force.copy();
		f.div(this.m);
		this.a.add(f);
	}
	move() {
		let an = new THREE.Vector3(this.a.x, this.a.y, this.a.z);
		an.normalize();
		this.accelArrow.setDirection(an);
		let l = this.m + this.a.mag();
		if (this.a.mag() > 2) {
			l = this.m + 2;
		}
		this.accelArrow.setLength(l, 1, 0.5);
		this.v.add(this.a);
		this.p.add(this.v);
		this.a.set(0, 0, 0);
		this.accelArrow.position.copy(this.p);
		this.mesh.position.copy(this.p);
	}
}

class Field {
	constructor(Xnum, Ynum, Znum, c, gap) {
		this.nx = Xnum;
		this.ny = Ynum;
		this.nz = Znum;
		this.gap = gap;
		let g = this.gap;
		this.vectors = new Array(this.nx);
		this.meshes = new Array(this.nx);
		for (let i = 0; i < this.nx; i++) {
			this.vectors[i] = new Array(this.ny);
			this.meshes[i] = new Array(this.ny);
			for (let j = 0; j < this.ny; j++) {
				this.vectors[i][j] = new Array(this.nz);
				this.meshes[i][j] = new Array(this.nz);
				for (let k = 0; k < this.nz; k++) {
					this.vectors[i][j][k] = new THREE.Vector3(0, 0, 0);
					let o = new THREE.Vector3(i * g, j * g, k * g);
					let d = new THREE.Vector3(this.vectors[i][j][k].x + i * g, this.vectors[i][j][k].y + j * g, this.vectors[i][j][k].z + k * g);
					d.normalize();
					let l = 1;
					this.meshes[i][j][k] = new THREE.ArrowHelper(d, o, l, c);
				}
			}
		}
	}
	update(sources) {
		let particles = sources;
		let g = this.gap;
		for (let i = 0; i < this.nx; i++) {
			for (let j = 0; j < this.ny; j++) {
				for (let k = 0; k < this.nz; k++) {
					for (let p = 0; p < particles.length; p++) {
						let r = particles[p].p.dist(createVector(i * g, j * g, k * g));
						let f = 1000000 * particles[p].c / sq(r);
						let ef = createVector(i * g, j * g, k * g).sub(particles[p].p);
						ef.normalize();
						ef.mult(f);
						ef = new THREE.Vector3(ef.x, ef.y, ef.z);
						this.vectors[i][j][k].add(ef);
					}
					let d = new THREE.Vector3(this.vectors[i][j][k].x + i * g, this.vectors[i][j][k].y + j * g, this.vectors[i][j][k].z + k * g);
					d.normalize();
					this.meshes[i][j][k].setDirection(d);
					let l = sqrt(this.vectors[i][j][k].length() / 5);
					if (l > 2) {
						l = 2;
					}
					this.meshes[i][j][k].setLength(l, 0.5 * l, 0.1 * l);
				}
			}
		}
	}
	refresh() {
		for (let i = 0; i < this.nx; i++) {
			for (let j = 0; j < this.ny; j++) {
				for (let k = 0; k < this.nz; k++) {
					this.vectors[i][j][k].set(0, 0, 0);
				}
			}
		}
	}
}
class System {
	constructor(w, h, l, g, B) {
		this.particles = [];
		this.elecField = new Field(w, h, l, new THREE.Color(0, 0, 0), g);
		this.B = B;
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xfffc74);
	}
	init() {
		for (let i = 0; i < this.particles.length; i++) {
			this.scene.add(this.particles[i].mesh);
			this.scene.add(this.particles[i].accelArrow);
		}
		for (let i = 0; i < this.elecField.nx; i++) {
			for (let j = 0; j < this.elecField.ny; j++) {
				for (let k = 0; k < this.elecField.nz; k++) {
					this.scene.add(this.elecField.meshes[i][j][k]);
				}
			}
		}
	}
	add(x, y, z, m, c) {
		this.particles.push(new Particle(x, y, z, m, c));
		let i = this.particles.length - 1;
		this.scene.add(this.particles[i].mesh);
		this.scene.add(this.particles[i].accelArrow);
	}
	update() {
		for (let i = 0; i < this.particles.length; i++) {
			for (let j = 0; j < this.particles.length; j++) {
				if (!(i === j)) {
					if (this.particles[i].p.dist(this.particles[j].p) > (this.particles[i].m + this.particles[j].m)) {
						let r = this.particles[i].p.dist(this.particles[j].p);
						let f = this.particles[i].c * this.particles[j].c / sq(r);
						let EF = this.particles[j].p.copy().sub(this.particles[i].p);
						EF.normalize();
						EF.mult(f);
						this.particles[j].addForce(EF);
					}
				}
			}
			let MF =
				this.particles[i].addForce(MF);
		}
		for (let i = 0; i < this.particles.length; i++) {
			this.particles[i].move();
		}
		this.elecField.update(this.particles);
	}
	collisionParticles() {
		for (let i = 0; i < this.particles.length; i++) {
			for (let j = (i + 1); j < this.particles.length; j++) {
				if (!(i === j)) {
					if (this.particles[i].p.dist(this.particles[j].p) <= (this.particles[i].m + this.particles[j].m) && !(sign(this.particles[i].c) === sign(this.particles[j].c))) {
						this.particles[j].v.set(0, 0, 0);
						this.particles[i].v.set(0, 0, 0);
					}
				}
			}
		}
	}
}

function setup() {
	let s = 16;
	sys = new System(s, round(s * height / width), round(s * length / width), 5, createVector(0, 0, 0));
	sys.scene.add(center);
	sys.scene.add(crosshair);
	sys.init();
	camPos = new THREE.Vector3(0, 0, 0, 2);
}

function draw() {
	if (playing) {
		if (delay < 20) {
			delay += 1;
		}
		if (keyIsPressed) {
			let sp = 0.4;
			if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) {
				let move = new THREE.Vector3();
				move.subVectors(crosshair.position, camera.position);
				move.normalize();
				move.cross(new THREE.Vector3(0, 1, 0));
				move.multiplyScalar(-sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
			if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) {
				let move = new THREE.Vector3();
				move.subVectors(crosshair.position, camera.position);
				move.normalize();
				move.cross(new THREE.Vector3(0, 1, 0));
				move.multiplyScalar(sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
			if (keyIsDown(32)) {
				let move = new THREE.Vector3(0, 1, 0);
				move.multiplyScalar(sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
			if (keyIsDown(16)) {
				let move = new THREE.Vector3(0, -1, 0);
				move.multiplyScalar(sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
			if (keyIsDown(UP_ARROW) || keyIsDown(87)) {
				let move = new THREE.Vector3();
				move.subVectors(crosshair.position, camera.position);
				move.normalize();
				move.multiplyScalar(sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
			if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) {
				let move = new THREE.Vector3();
				move.subVectors(crosshair.position, camera.position);
				move.normalize();
				move.multiplyScalar(-sp);
				camera.position.add(move);
				crosshair.position.add(move);
			}
		}
		if (!paused && playing) {
			sys.update();
			sys.collisionParticles();
			console.log(round(frameRate()));
		}
		camera.lookAt(crosshair.position);
		renderer.render(sys.scene, camera);
		sys.elecField.refresh();
	} else {
		magX = document.getElementById("X").value;
		magY = document.getElementById("Y").value;
		magZ = document.getElementById("Z").value;
		B = document.getElementById("B").value / 1000;
		let MFV = createVector(magX, magY, magZ);
		MFV.setMag(1);
		MFV.mult(B);
		sys.B.set(MFV.x, MFV.y, MFV.z);
	}
}
//
function keyPressed() {
	if (playing) {
		if (keyCode === 80) {
			paused = inv(paused);
		}
		if (keyCode === 189) {
			charge = -abs(charge);
		}
		if (keyCode === 187) {
			charge = abs(charge);
		}
	}
}
function mouseClicked() {
	if (mouseButton === LEFT && playing && delay === 20) {
		sys.add(crosshair.position.x, crosshair.position.y, crosshair.position.z, 1, charge);
	}
}
function mouseDragged(md) {
	if (mouseButton === RIGHT && playing) {
		let dif = new THREE.Vector3();
		dif.subVectors(crosshair.position, camera.position);
		let moveX = new THREE.Vector3();
		let moveY = new THREE.Vector3();
		moveX.crossVectors(dif, new THREE.Vector3(0, 1, 0));
		moveY.crossVectors(dif, new THREE.Vector3(1, 0, 0));
		moveX.normalize();
		moveY.normalize();
		moveX.multiplyScalar(-md.movementX / 15);
		moveY.multiplyScalar(md.movementY / 15);
		crosshair.position.sub(moveX);
		crosshair.position.sub(moveY);
	}
}
function mouseWheel(mw) {
	if (playing) {
		let move = new THREE.Vector3(0, 0, 0);
		move.subVectors(crosshair.position, camera.position);
		let min = move.clone();
		move.normalize();
		if (min.length() > 2 || mw.delta < 0) {
			move.multiplyScalar(mw.delta / 100);
			crosshair.position.sub(move);
		}
	}
	return false;
}
