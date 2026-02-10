const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

// --- 1. ASSETS ---
const playerImg = new Image(); playerImg.src = 'player.png';
const enemyImg = new Image(); enemyImg.src = 'enemy.png';

let bgMusic = new Audio('background_music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;

let gameOverMusic = new Audio('gameover_sound_track.mp3');

let isMuted = false;
let audioCtx;

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('muteBtn').innerText = isMuted ? "🔇" : "🔊";
    bgMusic.muted = isMuted;
    gameOverMusic.muted = isMuted;
}

// --- 2. CORE VARIABLES ---
let score, time, isPlaying = false, difficulty, lastEnemySpawn, startTime, lastShot;
let player, bullets, enemies, stars, keys = {};

// --- 3. INITIALIZATION ---
function resize() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);
resize();

// Load Records from LocalStorage
let highScore = localStorage.getItem('spaceHunter_hiScore') || 0;
let bestTime = localStorage.getItem('spaceHunter_bestTime') || 0;

// Generate Starfield
stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, size: Math.random() * 2, speed: Math.random() * 2 + 0.5 });
}

// --- 4. FUNCTIONS ---
function startGame() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    gameOverMusic.pause();
    gameOverMusic.currentTime = 0;

    if (!isMuted) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
    }

    score = 0; time = 0; difficulty = 1; isPlaying = true;
    bullets = []; enemies = []; lastShot = 0;
    startTime = Date.now(); lastEnemySpawn = Date.now();
    player = { x: canvas.width / 2 - 25, y: canvas.height - 120, w: 50, h: 50 };
    
    document.getElementById('startMenu').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('score').innerText = "0";
}

function endGame() {
    isPlaying = false;
    bgMusic.pause();
    if (!isMuted) gameOverMusic.play().catch(() => {});

    // Save Score Record
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceHunter_hiScore', highScore);
    }
    // Save Time Record
    if (time > bestTime) {
        bestTime = time;
        localStorage.setItem('spaceHunter_bestTime', bestTime);
    }

    // Populate Game Over Screen
    document.getElementById('finalScore').innerText = score;
    document.getElementById('finalTime').innerText = time;
    document.getElementById('bestScoreEnd').innerText = highScore;
    document.getElementById('bestTimeEnd').innerText = bestTime;
    
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function playHitSound() {
    if (!audioCtx || isMuted) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

// --- 5. THE LOOP ---
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!isPlaying) return;
    let rect = canvas.getBoundingClientRect();
    player.x = (e.touches[0].clientX - rect.left) - player.w / 2;
    player.y = (e.touches[0].clientY - rect.top) - player.h / 2;
}, { passive: false });

function main() {
    bgCtx.fillStyle = '#000';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = '#FFF';
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > bgCanvas.height) s.y = 0;
        bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); bgCtx.fill();
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying) {
        time = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('timer').innerText = time;
        difficulty = 1 + (time / 25);

        if (keys['KeyA'] && player.x > 0) player.x -= 8;
        if (keys['KeyD'] && player.x < canvas.width - player.w) player.x += 8;
        if (keys['KeyW'] && player.y > 0) player.y -= 8;
        if (keys['KeyS'] && player.y < canvas.height - player.h) player.y += 8;

        if (Date.now() - lastShot > 180 / (difficulty * 0.5)) {
            bullets.push({ x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 18 });
            lastShot = Date.now();
        }

        if (Date.now() - lastEnemySpawn > 900 / difficulty) {
            enemies.push({ x: Math.random() * (canvas.width - 40), y: -60, w: 40, h: 40, speed: 3 * difficulty });
            lastEnemySpawn = Date.now();
        }

        bullets.forEach((b, i) => {
            b.y -= 12;
            if (b.y < -50) bullets.splice(i, 1);
        });

        enemies.forEach((en, i) => {
            en.y += en.speed;
            if (en.y > canvas.height) enemies.splice(i, 1);

            if (player.x < en.x + en.w - 10 && player.x + player.w > en.x + 10 && 
                player.y < en.y + en.h - 10 && player.y + player.h > en.y + 10) endGame();

            bullets.forEach((b, j) => {
                if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
                    enemies.splice(i, 1); bullets.splice(j, 1);
                    playHitSound(); score += 100;
                    document.getElementById('score').innerText = score;
                }
            });
        });

        ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
        ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
        ctx.shadowColor = '#ff007b';
        enemies.forEach(en => ctx.drawImage(enemyImg, en.x, en.y, en.w, en.h));
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
        bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    }
    requestAnimationFrame(main);
}
main();