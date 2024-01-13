'use strict';

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

const BULLET_RADIUS = 2;
const BULLET_STEP_SIZE = 1.6;
const BULLET_ENEMY_DISTANCE = 6;
const BULLET_LIFE = 100;

const TOWER_RADIUS = 7;
const TOWER_COST = 100;

const ENEMY_STEP_SIZE = 0.6;
const ENEMY_RADIUS = 4;
const ENEMY_WAYPOINT_DISTANCE = 10;

const STARTING_MONEY = 200;
const STARTING_LIFE = 50;
const STARTING_DIFFICULTY = 1;

const waypoints = [
	point(30, 0),
	point(30, 450),
	point(200, 450),
	point(200, 50),
	point(450, 50),
	point(450, 500),
];

const enemies = [
];


const towers = [
];

const bullets = [];

const gameState = {
	money: STARTING_MONEY,
	life: STARTING_LIFE,
	difficulty: STARTING_DIFFICULTY,
};


function makeBuckets(entities, blockSize) {
	const map = new Map();
	const result = {map, blockSize};
	for (const entity of entities) {
		const [cx, cy] = computeCoord(result, entity.x, entity.y);
		const key = cx+":"+cy;
		if (map.has(key)) {
			map.get(key).push(entity);
		} else {
			map.set(key, [entity]);
		}
	}
	return result;
}

function computeCoord(buckets, x, y) {
	const cx = Math.floor(x / buckets.blockSize);
	const cy = Math.floor(y / buckets.blockSize);
	return [cx, cy];
}

function getEntities(buckets, cx, cy) {
	const key = cx+":"+cy;
	if (buckets.map.has(key)) {
		return buckets.map.get(key);
	} else {
		return [];
	}
}

function makeWave(difficulty) {

	const BOSS_SLOPE = 0.004;
	const MINIBOSS_SLOPE = 0.03;

	const bossProbability = difficulty * BOSS_SLOPE / (1 + difficulty * BOSS_SLOPE);
	const minibossProbability = difficulty * MINIBOSS_SLOPE / (1 + difficulty * MINIBOSS_SLOPE);

	for (let i = 0; i < difficulty * 10; ++i) {
		const start = waypoints[0];
		const r = Math.random();
		const x = Math.random() * 60 - 30 + start.x;
		const y = Math.random() * 800 - 800 + start.y;
		if (r < bossProbability) {
			enemies.push(boss(x, y));
		} else if (r < minibossProbability) {
			enemies.push(miniboss(x, y));
		} else {
			enemies.push(enemy(x, y));
		}
	}
}

function drawPath() {
	context.beginPath();
	context.lineWidth = 20;
	context.strokeStyle = '#555';
	const start = waypoints[0];
	context.moveTo(start.x, start.y);
	for (let i = 1; i < waypoints.length; ++i) {
		const current = waypoints[i];
		context.lineTo(current.x, current.y);
	}
	context.stroke();
}

function point(x, y) { return {x, y}; }
function enemy(x, y) { return {x, y, vx: 0, vy: 0, life: 10, step: 0, value: 10, end: false, tag: 'normal'}; }
function miniboss(x, y) {
	const e = enemy(x, y);
	e.life *= 10;
	e.value *= 3;
	e.tag = 'miniboss';
	return e;
}
function boss(x, y) {
	const e = enemy(x, y);
	e.life *= 50;
	e.value *= 10;
	e.tag = 'boss';
	return e;
}
function tower(x, y) { return {x, y, cooldown: 0}; }
function bullet(x, y, vx, vy) { return {x, y, vx, vy, life: BULLET_LIFE}; }



function updateEnemy(e) {
	if (e.step == waypoints.length) {
		e.end = true;
		gameState.life--;
		return;
	}

	const target = waypoints[e.step];
	const dx = target.x - e.x;
	const dy = target.y - e.y;
	const d = Math.hypot(dx, dy);
	const nx = dx / d;
	const ny = dy / d;

	e.vx = nx * Math.min(d, ENEMY_STEP_SIZE);
	e.vy = ny * Math.min(d, ENEMY_STEP_SIZE);

	e.x += e.vx;
	e.y += e.vy;

	if (d <= ENEMY_WAYPOINT_DISTANCE) {
		e.step++;
	}
}

function distance(ax, ay, bx, by) {
	return Math.hypot(ax - bx, ay - by);
}

function straightShot(ox, oy, tx, ty) {
	const dx = tx - ox;
	const dy = ty - oy;
	const d = Math.hypot(dx, dy);
	const nx = dx / d;
	const ny = dy / d;
	const vx = nx * BULLET_STEP_SIZE;
	const vy = ny * BULLET_STEP_SIZE;
	return [vx, vy];
}

function updateTower(e) {
	if (e.cooldown > 0) {
		e.cooldown--;
	} else {

		if (enemies.length > 0) {
			e.cooldown = 10;

			let target = null;
			for (let i = 0; i < 10; ++i) {
				const enemy = enemies[Math.random() * enemies.length | 0];
				if (target === null || distance(e.x, e.y, target.x, target.y) > distance(e.x, e.y, enemy.x, enemy.y)) {
					target = enemy;
				}
			}

			let tx = target.x;
			let ty = target.y;

			for (let i = 0; i < 5 ; ++i) {
				const d = distance(e.x, e.y, tx, ty);
				const timeToHit = d / BULLET_STEP_SIZE;
				const ntx = target.x + target.vx *  timeToHit;
				const nty = target.y + target.vy *  timeToHit;

				tx = ntx;
				ty = nty;
			}

			if (distance(e.x, e.y, tx, ty) > BULLET_LIFE * BULLET_STEP_SIZE) {
				return;
			}

			const [vx, vy] = straightShot(e.x, e.y, tx, ty);

			bullets.push(bullet(e.x, e.y, vx, vy));
		}
	}
}

function updateBullet(e) {
	e.x += e.vx;
	e.y += e.vy;
	e.life--;
}

function gameLogic() {

	if (enemies.length == 0) {
		makeWave(gameState.difficulty++);
	}

	enemies.forEach(updateEnemy);
	towers.forEach(updateTower);
	bullets.forEach(updateBullet);

	remove(bullets, isDead);

	const buckets = makeBuckets(enemies, 20);

	for (const bullet of bullets) {

		let closest = null;

		const [cx, cy] = computeCoord(buckets, bullet.x, bullet.y);
		for (let cx_ = cx-1; cx_ <= cx+1; ++cx_) {
			for (let cy_ = cy-1; cy_ <= cy+1; ++cy_) {
				for (const enemy of getEntities(buckets, cx_, cy_)) {
					if (closest === null || distance(bullet.x, bullet.y, closest.x, closest.y) > distance(bullet.x, bullet.y, enemy.x, enemy.y)) {
						closest = enemy;
					}
				}
			}
		}

		if (closest !== null && distance(bullet.x, bullet.y, closest.x, closest.y) <= BULLET_ENEMY_DISTANCE) {
			closest.life--;
			bullet.life = 0;
		}
	}

	for (const enemy of enemies) {
		if (enemy.life <= 0) {
			gameState.money += enemy.value;
		}
	}

	remove(enemies, isDead);
	remove(enemies, hasEnded);

	function isDead(e) {
		return e.life <= 0;
	}

	function hasEnded(e) {
		return e.end;
	}
}


setInterval(() => {

	for (let i = 3; i--;) gameLogic();

	drawGame();
	
}, 30);

function drawGame() {
	context.clearRect(0, 0, canvas.width, canvas.height);

	drawPath();

	for (const enemy of enemies) {
		switch (enemy.tag) {
			case 'normal':
				// performance loss
				context.fillStyle = '#a51';
				drawSquare(enemy.x, enemy.y, ENEMY_RADIUS);
				break;

			case 'miniboss':
				// performance loss
				context.fillStyle = '#d33';
				drawSquare(enemy.x, enemy.y, ENEMY_RADIUS * 2);
				break;
		
			case 'boss':
				// performance loss
				context.fillStyle = '#e15';
				drawSquare(enemy.x, enemy.y, ENEMY_RADIUS * 5);
				break;
		}
	}

	context.fillStyle = '#33f';
	for (const tower of towers) {
		drawSquare(tower.x, tower.y, TOWER_RADIUS);
	}

	context.fillStyle = '#333';
	for (const bullet of bullets) {
		drawSquare(bullet.x, bullet.y, BULLET_RADIUS);
	}

	displayText(45, 30, '#3c1', `Money: $${gameState.money.toFixed(2)}`);
	displayText(canvas.width - 150, 30, '#c31', `Lives: ${gameState.life}`);
}

function drawSquare(x, y, radius) {
	context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function displayText(x, y, color, text) {
	context.save();
	context.fillStyle = color;
	context.font = "30px Arial";
	context.fillText(text, x, y);
	context.restore();
}

function remove(arr, predicate) {
	for (let i = 0, j = 0; i < arr.length; ++i) {
		const e = arr[i];
		if (!predicate(e)) {
			arr[j++] = e;
		}

		if (i + 1 == arr.length) {
			arr.length = j;
			break;
		}
	}
}

canvas.addEventListener("click", evt => {
	const ofx = canvas.offsetLeft;
	const ofy = canvas.offsetTop;
	
	if (gameState.money >= TOWER_COST) {
		towers.push(tower(evt.x - ofx, evt.y - ofy));
		gameState.money -= TOWER_COST;
	}
})


