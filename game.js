const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
const container = document.getElementById('game-container');

// --- 1. ASSETS & LOADING ---
let assetsLoaded = 0;
const totalAssets = 3;
function checkLoad() {
    assetsLoaded++;
    if(assetsLoaded === totalAssets) console.log("All systems online.");
}

const playerImg = new Image(); playerImg.src = 'player.png'; playerImg.onload = checkLoad;
const enemyPinkImg = new Image(); enemyPinkImg.src = 'enemy.png'; enemyPinkImg.onload = checkLoad;
const enemyGreenImg = new Image(); enemyGreenImg.src = 'enemy_green.png'; enemyGreenImg.onload = checkLoad;

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
let player, bullets, enemies, enemyOrbs, gems, powerups, stars, keys = {};
let laserTimer = 0, powerupCooldown = 0;

function resize() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

let highScore = localStorage.getItem('spaceHunter_hiScore') || 0;

stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, size: Math.random() * 2, speed: Math.random() * 2 + 0.5 });
}

// --- 3. GAME LOGIC ---
function triggerDamage(amount) {
    player.hp -= amount;
    shakeAmount = 15; 
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
    if(!hb) return;
    hb.style.width = Math.max(0, player.hp) + "%";
    hb.style.background = player.hp < 30 ? "#ff007b" : "#00f2ff";
}

function startGame() {
    resize();
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gameOverMusic.pause();
    if (!isMuted) { bgMusic.currentTime = 0; bgMusic.play().catch(() => {}); }

    score = 0; time = 0; difficulty = 1; isPlaying = true;
    bullets = []; enemies = []; enemyOrbs = []; gems = []; powerups = [];
    lastShot = 0; laserTimer = 0; powerupCooldown = 0;
    startTime = Date.now(); lastEnemySpawn = Date.now();
    
    player = { w: 50, h: 50, hp: 100 };
    player.x = (canvas.width / 2) - (player.w / 2);
    player.y = canvas.height - 150;
    
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

// --- 4. INPUTS ---
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!isPlaying || !player) return;
    let rect = canvas.getBoundingClientRect();
    player.x = (e.touches[0].clientX - rect.left) - player.w / 2;
    player.y = (e.touches[0].clientY - rect.top) - player.h / 2;
}, { passive: false });

// --- 5. MAIN LOOP ---
function main() {
    bgCtx.fillStyle = '#000'; bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = '#FFF';
    stars.forEach(s => {
        s.y += s.speed; if (s.y > bgCanvas.height) s.y = 0;
        bgCtx.beginPath(); bgCtx.arc(s.x, s.y, s.size, 0, Math.PI*2); bgCtx.fill();
    });

    ctx.save();
    let effectiveShake = shakeAmount;
    if (laserTimer > 0) effectiveShake += 3; 
    if (effectiveShake > 0) {
        ctx.translate((Math.random()-0.5)*effectiveShake, (Math.random()-0.5)*effectiveShake);
        shakeAmount *= 0.85;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying && player) {
        time = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('timer').innerText = time;
        
        // Difficulty scaling (faster spawn rate over time)
        difficulty = 1 + (time / 35); 

        if (laserTimer > 0) laserTimer--;
        if (powerupCooldown > 0) powerupCooldown--;

        if (player.hp < 30 && Date.now() - lastLowHealthBeep > 800) {
            playSynthesizedSound(300, 'sine', 0.1, 0.1);
            lastLowHealthBeep = Date.now();
        }

        let moveSpeed = 8;
        if (keys['KeyA'] || keys['ArrowLeft']) player.x -= moveSpeed;
        if (keys['KeyD'] || keys['ArrowRight']) player.x += moveSpeed;
        if (keys['KeyW'] || keys['ArrowUp']) player.y -= moveSpeed;
        if (keys['KeyS'] || keys['ArrowDown']) player.y += moveSpeed;

        player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
        player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));

        if (laserTimer <= 0 && Date.now() - lastShot > 200) {
            bullets.push({ x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 18 });
            lastShot = Date.now();
        }

        // --- ENEMY SPAWN WITH FIXED RATIO ---
        if (Date.now() - lastEnemySpawn > 1200 / difficulty) {
            // FIXED RATIO: Always ~25% Green Elite, 75% Pink
            const isGreen = Math.random() < 0.25; 
            
            enemies.push({
                x: Math.random() * (canvas.width - 65), y: -75,
                w: isGreen ? 65 : 40, h: isGreen ? 40 : 40,
                type: isGreen ? 'green' : 'pink',
                hp: isGreen ? 3 : 1,
                speed: (isGreen ? 1.5 : 3) * (Math.min(difficulty, 2.5) * 0.7), // Speed caps slightly so it's playable
                lastShot: 0, flicker: 0
            });
            lastEnemySpawn = Date.now();
        }

        if (laserTimer > 0) {
            let laserX = player.x + player.w / 2 - 15;
            let laserW = 30;
            enemies.forEach((en, i) => {
                if (en.x < laserX + laserW && en.x + en.w > laserX && en.y < player.y) {
                    score += en.type === 'green' ? 300 : 100;
                    enemies.splice(i, 1);
                    document.getElementById('score').innerText = score;
                    playSynthesizedSound(100, 'sine', 0.05, 0.02);
                }
            });
            enemyOrbs.forEach((orb, i) => {
                if (orb.x < laserX + laserW && orb.x > laserX && orb.y < player.y) enemyOrbs.splice(i, 1);
            });
        }

        enemies.forEach((en, i) => {
            en.y += en.speed;
            if(en.type === 'pink') en.x += Math.sin(en.y / 35) * 2.5; 
            if(en.type === 'green' && Date.now() - en.lastShot > 3500 / difficulty) {
                enemyOrbs.push({ x: en.x + en.w/2, y: en.y + en.h, r: 7, speed: 2.5 * difficulty });
                en.lastShot = Date.now();
            }
            if (en.y > canvas.height + 50) enemies.splice(i, 1);
            if (player.x < en.x + en.w - 8 && player.x + player.w > en.x + 8 && player.y < en.y + en.h - 8 && player.y + player.h > en.y + 8) {
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
                        let rand = Math.random();
                        if (powerupCooldown <= 0) {
                            if (en.type === 'green' && rand < 0.25) powerups.push({x: en.x + en.w/4, y: en.y, w: 25, h: 25});
                            else if (en.type === 'pink' && rand < 0.08) powerups.push({x: en.x + en.w/4, y: en.y, w: 25, h: 25});
                        }
                        if (en.type === 'green' && rand > 0.70) gems.push({x: en.x + en.w/4, y: en.y, w: 25, h: 25});
                        else if (en.type === 'pink' && rand > 0.85) gems.push({x: en.x + en.w/4, y: en.y, w: 25, h: 25});

                        score += en.type === 'green' ? 300 : 100;
                        enemies.splice(ei, 1);
                        document.getElementById('score').innerText = score;
                    }
                }
            });
            if (b.y < -50) bullets.splice(bi, 1);
        });

        enemyOrbs.forEach((orb, oi) => {
            orb.y += orb.speed;
            if (orb.x > player.x && orb.x < player.x + player.w && orb.y > player.y && orb.y < player.y + player.h) {
                triggerDamage(15); enemyOrbs.splice(oi, 1);
            }
            if (orb.y > canvas.height + 50) enemyOrbs.splice(oi, 1);
        });

        gems.forEach((g, gi) => {
            g.y += 3;
            if (g.x < player.x + player.w && g.x + g.w > player.x && g.y < player.y + player.h && g.y + g.h > player.y) {
                player.hp = Math.min(100, player.hp + 35);
                updateHealthUI(); gems.splice(gi, 1);
                playSynthesizedSound(800, 'sine', 0.4, 0.15);
            }
        });

        powerups.forEach((p, pi) => {
            p.y += 3;
            if (p.x < player.x + player.w && p.x + p.w > player.x && p.y < player.y + player.h && p.y + p.h > player.y) {
                laserTimer = 300; 
                powerupCooldown = 600; 
                powerups.splice(pi, 1);
                playSynthesizedSound(1200, 'sawtooth', 0.8, 0.2);
                if ("vibrate" in navigator) navigator.vibrate([50, 50, 50]);
            }
        });

        // --- DRAWING ---
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00'; ctx.fillStyle = '#ffff00';
        powerups.forEach(p => {
            ctx.beginPath();
            ctx.moveTo(p.x + 15, p.y); ctx.lineTo(p.x + 5, p.y + 12); ctx.lineTo(p.x + 12, p.y + 12);
            ctx.lineTo(p.x + 2, p.y + 25); ctx.lineTo(p.x + 22, p.y + 8); ctx.lineTo(p.x + 12, p.y + 8);
            ctx.closePath(); ctx.fill();
        });
        ctx.shadowColor = '#ff0044'; ctx.fillStyle = '#ff0044';
        gems.forEach(g => {
            let x = g.x, y = g.y, w = g.w, h = g.h;
            ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 4);
            ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + h / 4);
            ctx.bezierCurveTo(x, y + h / 2, x + w / 2, y + h * 0.75, x + w / 2, y + h);
            ctx.bezierCurveTo(x + w / 2, y + h * 0.75, x + w, y + h / 2, x + w, y + h / 4);
            ctx.bezierCurveTo(x + w, y, x + w / 2, y, x + w / 2, y + h / 4); ctx.fill();
        });
        if (laserTimer > 0) {
            ctx.shadowBlur = 40; ctx.shadowColor = '#00ffff';
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.fillRect(player.x + player.w/2 - 20, 0, 40, player.y);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(player.x + player.w/2 - 8, 0, 16, player.y);
            ctx.beginPath();
            ctx.arc(player.x + player.w/2, player.y + player.h/2, 45, 0, Math.PI*2);
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 3; ctx.stroke();
        }
        ctx.shadowColor = '#ffaa00'; ctx.fillStyle = '#ffaa00';
        enemyOrbs.forEach(orb => { ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI*2); ctx.fill(); });
        enemies.forEach(en => {
            if (en.flicker > 0) { ctx.filter = 'brightness(3)'; en.flicker--; }
            ctx.shadowColor = en.type === 'green' ? '#00ff00' : '#ff007b';
            ctx.drawImage(en.type === 'green' ? enemyGreenImg : enemyPinkImg, en.x, en.y, en.w, en.h);
            ctx.filter = 'none';
        });
        ctx.shadowColor = '#00f2ff'; 
        if(assetsLoaded === totalAssets) ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; 
        bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    }
    ctx.restore();
    requestAnimationFrame(main);
}
main();