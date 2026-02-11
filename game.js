const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const container = document.getElementById('game-container');

// --- 1. ASSETS ---
const playerImg = new Image(); playerImg.src = 'player.png';
const enemyPinkImg = new Image(); enemyPinkImg.src = 'enemy.png';
const enemyGreenImg = new Image(); enemyGreenImg.src = 'enemy_green.png';

let bgMusic = new Audio('background_music.mp3');
bgMusic.loop = true; bgMusic.volume = 0.4;
let gameOverMusic = new Audio('gameover_sound_track.mp3');

let isMuted = false, audioCtx, lastLowHealthBeep = 0, shakeAmount = 0;

function toggleMute() {
    isMuted = !isMuted;
    document.getElementById('muteBtn').innerText = isMuted ? "🔇" : "🔊";
    bgMusic.muted = isMuted; gameOverMusic.muted = isMuted;
}

// --- 2. CORE VARIABLES ---
let score, time, isPlaying = false, difficulty, lastEnemySpawn, startTime, lastShot;
let player, bullets, enemies, enemyOrbs, gems, stars, keys = {};

function resize() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resize);
resize();

let highScore = localStorage.getItem('spaceHunter_hiScore') || 0;

stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, size: Math.random() * 2, speed: Math.random() * 2 + 0.5 });
}

// --- 3. POLISH FUNCTIONS ---
function triggerDamage(amount) {
    player.hp -= amount;
    shakeAmount = 10; 
    container.classList.add('damage-flash');
    setTimeout(() => container.classList.remove('damage-flash'), 150);
    
    if ("vibrate" in navigator) navigator.vibrate(100);
    
    updateHealthUI();
    playSynthesizedSound(80, 'sawtooth', 0.3, 0.2);
    if (player.hp <= 0) endGame();
}

function playSynthesizedSound(freq, type, duration, vol = 0.05) {
    if (!audioCtx || isMuted) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function updateHealthUI() {
    const hb = document.getElementById('health-bar');
    hb.style.width = Math.max(0, player.hp) + "%";
    hb.style.background = player.hp < 30 ? "#ff007b" : "#00f2ff";
}

function startGame() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gameOverMusic.pause();
    if (!isMuted) { bgMusic.currentTime = 0; bgMusic.play().catch(() => {}); }

    score = 0; time = 0; difficulty = 1; isPlaying = true;
    bullets = []; enemies = []; enemyOrbs = []; gems = [];
    lastShot = 0; startTime = Date.now(); lastEnemySpawn = Date.now();
    
    player = { x: canvas.width/2 - 25, y: canvas.height - 150, w: 50, h: 50, hp: 100 };
    
    updateHealthUI();
    document.getElementById('startMenu').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
}

function endGame() {
    isPlaying = false;
    bgMusic.pause();
    if (!isMuted) gameOverMusic.play().catch(() => {});
    if (score > highScore) { highScore = score; localStorage.setItem('spaceHunter_hiScore', highScore); }
    document.getElementById('finalScore').innerText = score;
    document.getElementById('bestScoreEnd').innerText = highScore;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// --- 4. THE LOOP ---
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
    bgCtx.fillStyle = '#000'; bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = '#FFF';
    stars.forEach(s => {
        s.y += s.speed; if (s.y > bgCanvas.height) s.y = 0;
        bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); bgCtx.fill();
    });

    ctx.save();
    if (shakeAmount > 0) {
        let sx = (Math.random() - 0.5) * shakeAmount;
        let sy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(sx, sy);
        shakeAmount *= 0.9;
        if (shakeAmount < 0.1) shakeAmount = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying) {
        time = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('timer').innerText = time;
        difficulty = 1 + (time / 45);

        if (player.hp < 30 && Date.now() - lastLowHealthBeep > 800) {
            playSynthesizedSound(300, 'sine', 0.1, 0.1);
            lastLowHealthBeep = Date.now();
        }

        // FULL MOVEMENT (X and Y)
        if (keys['KeyA'] && player.x > 0) player.x -= 8;
        if (keys['KeyD'] && player.x < canvas.width - player.w) player.x += 8;
        if (keys['KeyW'] && player.y > 0) player.y -= 8;
        if (keys['KeyS'] && player.y < canvas.height - player.h) player.y += 8;

        // SHOOTING LOGIC (Fixed)
        if (Date.now() - lastShot > 200) {
            bullets.push({ x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 18 });
            lastShot = Date.now();
        }

        // Spawn Enemies
        if (Date.now() - lastEnemySpawn > 1100 / difficulty) {
            const isGreen = Math.random() < 0.22 * difficulty;
            enemies.push({
                x: Math.random() * (canvas.width - 65), y: -75,
                w: isGreen ? 65 : 40, h: isGreen ? 65 : 40,
                type: isGreen ? 'green' : 'pink',
                hp: isGreen ? 3 : 1,
                speed: (isGreen ? 1.4 : 2.8) * (difficulty * 0.75),
                lastShot: 0, flicker: 0
            });
            lastEnemySpawn = Date.now();
        }

        enemies.forEach((en, i) => {
            en.y += en.speed;
            if(en.type === 'pink') en.x += Math.sin(en.y / 35) * 2.5; 
            if(en.type === 'green' && Date.now() - en.lastShot > 3500 / difficulty) {
                enemyOrbs.push({ x: en.x + en.w/2, y: en.y + en.h, r: 7, speed: 2.2 * difficulty });
                en.lastShot = Date.now();
            }
            if (en.y > canvas.height) enemies.splice(i, 1);
            if (player.x < en.x + en.w - 10 && player.x + player.w > en.x + 10 && player.y < en.y + en.h - 10 && player.y + player.h > en.y + 10) {
                triggerDamage(25); enemies.splice(i, 1);
            }
        });

        bullets.forEach((b, bi) => {
            b.y -= 14;
            enemies.forEach((en, ei) => {
                if (b.x > en.x && b.x < en.x + en.w && b.y > en.y && b.y < en.y + en.h) {
                    en.hp--; en.flicker = 5;
                    bullets.splice(bi, 1);
                    playSynthesizedSound(400, 'square', 0.05);
                    if (en.hp <= 0) {
                        if(Math.random() < 0.15) gems.push({x: en.x + en.w/4, y: en.y, w: 25, h: 25});
                        score += en.type === 'green' ? 300 : 100;
                        enemies.splice(ei, 1);
                        document.getElementById('score').innerText = score;
                    }
                }
            });
            if (b.y < -20) bullets.splice(bi, 1);
        });

        enemyOrbs.forEach((orb, oi) => {
            orb.y += orb.speed;
            if (orb.x > player.x && orb.x < player.x + player.w && orb.y > player.y && orb.y < player.y + player.h) {
                triggerDamage(15); enemyOrbs.splice(oi, 1);
            }
            if (orb.y > canvas.height) enemyOrbs.splice(oi, 1);
        });

        gems.forEach((g, gi) => {
            g.y += 3;
            if (g.x < player.x + player.w && g.x + g.w > player.x && g.y < player.y + player.h && g.y + g.h > player.y) {
                player.hp = Math.min(100, player.hp + 30);
                updateHealthUI(); gems.splice(gi, 1);
                playSynthesizedSound(800, 'sine', 0.4, 0.15);
            }
            if (g.y > canvas.height) gems.splice(gi, 1);
        });

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ff88'; ctx.fillStyle = '#00ff88';
        gems.forEach(g => {
            ctx.beginPath(); ctx.moveTo(g.x + g.w/2, g.y); ctx.lineTo(g.x+g.w, g.y+g.h/2);
            ctx.lineTo(g.x+g.w/2, g.y+g.h); ctx.lineTo(g.x, g.y+g.h/2); ctx.fill();
        });
        ctx.shadowColor = '#ffaa00'; ctx.fillStyle = '#ffaa00';
        enemyOrbs.forEach(orb => { ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI*2); ctx.fill(); });
        
        enemies.forEach(en => {
            if (en.flicker > 0) { ctx.filter = 'brightness(3)'; en.flicker--; }
            ctx.shadowColor = en.type === 'green' ? '#00ff00' : '#ff007b';
            ctx.drawImage(en.type === 'green' ? enemyGreenImg : enemyPinkImg, en.x, en.y, en.w, en.h);
            ctx.filter = 'none';
        });
        
        ctx.shadowColor = '#00f2ff'; ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; 
        bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    }
    ctx.restore();
    requestAnimationFrame(main);
}
main();