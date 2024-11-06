const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dropBtn = document.getElementById('dropBtn');
const redeemBtn = document.getElementById('redeemBtn');
const watchAdBtn = document.getElementById('watchAdBtn');
const balanceDisplay = document.getElementById('balance');
const timerDisplay = document.getElementById('timer');
const betInput = document.getElementById('betAmount');
const ballCountInput = document.getElementById('ballCount');

let animationFrameId = null;

function resizeCanvas() {
    canvas.width = 1200;
    canvas.height = 900;
}

// canvas and ctx are already declared in the global scope

function initGame() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    resizeCanvas();
    loadUserData();
    initializeGame();
    draw();
    setInterval(updateTimer, 1000);
}

// Replace the DOMContentLoaded listener with this
window.addEventListener('DOMContentLoaded', initGame);

resizeCanvas();

// Game constants
let balance = 100;
let lastFreePointsTime = Date.now();
const FREE_POINTS_COOLDOWN = 3600000;
const FREE_POINTS_AMOUNT = 100;
const MAX_BALLS = 100;
const BALL_RADIUS = 5;
const PEG_RADIUS = 10;
const ROWS = 14;
const COLS = 18;
const MULTIPLIERS = [20, 10, 5, 2.5, 2, 1, 0.5, 0.2, 0.2, 0.2, 0.5, 1, 2, 2.5, 5, 10, 20];
const GRAVITY = 0.5;
const BOUNCE_VARIATION = 0.3;
const MAX_VELOCITY = 15;
const MAX_PARTICLES = 500;
const MAX_POPUPS = 20;
const MIN_REDEEM_POINTS = 100;
const AD_REWARD = 50;
const AD_COOLDOWN = 300000; // 5 minutes

let lastAdWatchTime = 0;

// Storage functions
function saveUserData() {
    const userData = {
        balance: balance,
        lastFreePointsTime: lastFreePointsTime,
        lastAdWatchTime: lastAdWatchTime
    };
    localStorage.setItem('plinkoUserData', JSON.stringify(userData));
    console.log('Data saved:', userData);
}

function loadUserData() {
    const savedData = localStorage.getItem('plinkoUserData');
    console.log('Data loaded:', savedData);
    if (savedData) {
        const userData = JSON.parse(savedData);
        balance = userData.balance;
        lastFreePointsTime = userData.lastFreePointsTime;
        lastAdWatchTime = userData.lastAdWatchTime || 0;
        balanceDisplay.textContent = formatNumber(balance);
    } else {
        balance = 1000;
        lastFreePointsTime = Date.now();
        lastAdWatchTime = 0;
        saveUserData();
    }
}

function updateBalance(newBalance) {
    balance = newBalance;
    balanceDisplay.textContent = formatNumber(balance);
    saveUserData();
}


// Visual style constants
const SLOT_COLORS = {
    x20: ['#FF4D4D', '#FF6B6B'],
    x10: ['#FF6B6B', '#FF8E8E'],
    x5: ['#4ECDC4', '#45B7AF'],
    default: ['#2C3E50', '#34495E']
};

const ANIMATIONS = {
    x20: {
        colors: ['#FF4D4D', '#FF6B6B', '#FF8E8E'],
        particles: 60,
        duration: 2500,
        spread: 360
    },
    x10: {
        colors: ['#FFD700', '#FFA500', '#FF4500'],
        particles: 50,
        duration: 2000,
        spread: 360
    },
    x5: {
        colors: ['#4ECDC4', '#45B7AF', '#2FB4AE'],
        particles: 30,
        duration: 1500,
        spread: 270
    }
};

// Game state
let balls = [];
let particles = [];
let pegs = [];
let slots = [];
let popups = [];
let isProcessing = false;

function initializeGame() {
    pegs = [];
    slots = [];

    const PEG_SPACING_X = canvas.width / (COLS + 1);
    const PEG_SPACING_Y = (canvas.height - 150) / (ROWS + 1);

    for (let row = 0; row < ROWS; row++) {
        const currentCols = row % 2 === 0 ? COLS : COLS - 1;
        const offsetX = row % 2 === 0 ? 0 : PEG_SPACING_X / 2;
        
        for (let col = 0; col < currentCols; col++) {
            pegs.push({
                x: offsetX + PEG_SPACING_X * (col + 1),
                y: PEG_SPACING_Y * (row + 1),
                glow: 0
            });
        }
    }

    for (let i = 0; i < MULTIPLIERS.length; i++) {
        slots.push({
            x: (i + 0.5) * (canvas.width / MULTIPLIERS.length),
            y: canvas.height - 50,
            multiplier: MULTIPLIERS[i],
            width: (canvas.width / MULTIPLIERS.length) - 10,
            glow: 0
        });
    }
}

function getSlotStyle(multiplier) {
    if (multiplier >= 20) return SLOT_COLORS.x20;
    if (multiplier >= 10) return SLOT_COLORS.x10;
    if (multiplier >= 5) return SLOT_COLORS.x5;
    return SLOT_COLORS.default;
}

function createParticles(x, y, color, amount = 10) {
    if (particles.length > MAX_PARTICLES) {
        particles.splice(0, amount);
    }
    
    for (let i = 0; i < amount; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color,
            size: 3 + Math.random() * 3
        });
    }
}

function createSpecialWinEffect(ball, multiplier) {
    const config = multiplier >= 20 ? ANIMATIONS.x20 : 
                  multiplier >= 10 ? ANIMATIONS.x10 : ANIMATIONS.x5;
    
    for (let i = 0; i < config.particles; i++) {
        const angle = (i / config.particles) * config.spread * Math.PI / 180;
        const speed = 2 + Math.random() * 3;
        
        if (particles.length <= MAX_PARTICLES) {
            particles.push({
                x: ball.x,
                y: ball.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: config.colors[Math.floor(Math.random() * config.colors.length)],
                size: 3 + Math.random() * 3
            });
        }
    }
    
    const shockwave = document.createElement('div');
    shockwave.className = multiplier >= 20 ? 'shockwave-20' :
                         multiplier >= 10 ? 'shockwave-10' : 'shockwave-5';
    shockwave.style.left = `${ball.x}px`;
    shockwave.style.top = `${ball.y}px`;
    document.body.appendChild(shockwave);
    
    setTimeout(() => {
        if (shockwave.parentNode) {
            shockwave.remove();
        }
    }, config.duration);
}

function createJackpotEffect(amount) {
    const jackpotDiv = document.createElement('div');
    jackpotDiv.className = 'jackpot-alert';
    jackpotDiv.textContent = `¡JACKPOT! ${amount} puntos`;
    document.body.appendChild(jackpotDiv);
    
    setTimeout(() => {
        if (jackpotDiv.parentNode) {
            jackpotDiv.remove();
        }
    }, 2000);
}

function createPopup(text, x, y) {
    if (popups.length > MAX_POPUPS) {
        popups.shift();
    }
    
    popups.push({
        text: formatNumber(text),
        x,
        y,
        life: 1,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`
    });
}

function cleanup() {
    particles = particles.filter(p => p.life > 0);
    popups = popups.filter(p => p.life > 0);
    balls = balls.filter(ball => ball.y < canvas.height + 100);
    
    if (balls.length === 0) {
        isProcessing = false;
    }

    pegs.forEach(peg => {
        peg.glow *= 0.95;
    });
}

function drawPegs() {
    pegs.forEach(peg => {
        const gradient = ctx.createRadialGradient(
            peg.x, peg.y, 0,
            peg.x, peg.y, PEG_RADIUS * 3
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.5 + peg.glow})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(peg.x - PEG_RADIUS * 3, peg.y - PEG_RADIUS * 3, PEG_RADIUS * 6, PEG_RADIUS * 6);

        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });
}
document.addEventListener('DOMContentLoaded', () => {
    // Verify all required elements exist
    const requiredElements = [
        'gameCanvas',
        'dropBtn',
        'redeemBtn', 
        'watchAdBtn',
        'balance',
        'timer',
        'betAmount',
        'ballCount'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }

    loadUserData();
    initializeGame();
    draw();
    setInterval(updateTimer, 1000);
});
function initializeCanvas() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return false;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Canvas context not available');
        return false;
    }
    
    resizeCanvas();
    return true;
}
window.addEventListener('load', () => {
    if (initializeCanvas()) {
        startGame();
    }
});
function loadUserData() {
    try {
        const savedData = localStorage.getItem('plinkoUserData');
        if (savedData) {
            const userData = JSON.parse(savedData);
            balance = userData.balance;
            lastFreePointsTime = userData.lastFreePointsTime;
            lastAdWatchTime = userData.lastAdWatchTime || 0;
            balanceDisplay.textContent = formatNumber(balance);
        } else {
            balance = 1000;
            lastFreePointsTime = Date.now();
            lastAdWatchTime = 0;
            saveUserData();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        balance = 1000;
        lastFreePointsTime = Date.now();
        lastAdWatchTime = 0;
    }
}

function drawSlots() {
    slots.forEach(slot => {
        const colors = getSlotStyle(slot.multiplier);
        const width = slot.width * 0.95;
        
        ctx.fillStyle = colors[0];
        ctx.beginPath();
        ctx.roundRect(slot.x - width/2, slot.y - 25, width, 50, 8);
        ctx.fill();
        
        const fontSize = slot.multiplier >= 20 ? 26 :
                        slot.multiplier >= 10 ? 24 : 
                        slot.multiplier >= 5 ? 25 : 22;
        
        ctx.font = `bold ${fontSize}px Inter, Arial`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${slot.multiplier}x`, slot.x, slot.y);
    });
}

function updateBalls() {
    const remainingBalls = [];
    
    for (const ball of balls) {
        ball.vy += GRAVITY;
        ball.vx = Math.max(Math.min(ball.vx, MAX_VELOCITY), -MAX_VELOCITY);
        ball.vy = Math.max(Math.min(ball.vy, MAX_VELOCITY), -MAX_VELOCITY);
        
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        if (ball.x < BALL_RADIUS) {
            ball.x = BALL_RADIUS;
            ball.vx *= -0.7;
        } else if (ball.x > canvas.width - BALL_RADIUS) {
            ball.x = canvas.width - BALL_RADIUS;
            ball.vx *= -0.7;
        }
        
        if (ball.y > canvas.height - BALL_RADIUS) {
            if (!isProcessing) {
                handleBallLanding(ball);
            }
            continue;
        }
        
        handleCollisions(ball);
        remainingBalls.push(ball);
    }
    
    balls = remainingBalls;
}

function handleBallLanding(ball) {
    isProcessing = true;
    const slot = slots.find(s => Math.abs(s.x - ball.x) < s.width/2);
    if (slot) {
        const winAmount = Math.floor(ball.bet * slot.multiplier);
        updateBalance(balance + winAmount);
        
        requestAnimationFrame(() => {
            if (slot.multiplier >= 20) {
                createSpecialWinEffect(ball, 20);
                createJackpotEffect(formatNumber(winAmount));
            } else if (slot.multiplier >= 10) {
                createSpecialWinEffect(ball, 10);
                createJackpotEffect(formatNumber(winAmount));
            } else if (slot.multiplier >= 5) {
                createSpecialWinEffect(ball, 5);
            }
            createPopup(`${winAmount} puntos!`, ball.x, ball.y - 50);
            isProcessing = false;
        });
    } else {
        isProcessing = false;
    }
}

function handleCollisions(ball) {
    ball.trail = ball.trail || [];
    ball.trail.push({x: ball.x, y: ball.y});
    if (ball.trail.length > 10) ball.trail.shift();

    const nearbyPegs = pegs.filter(peg => 
        Math.abs(peg.x - ball.x) < 50 && 
        Math.abs(peg.y - ball.y) < 50
    );

    nearbyPegs.forEach(peg => {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < BALL_RADIUS + PEG_RADIUS) {
            peg.glow = 0.5;
            const angle = Math.atan2(dy, dx);
            ball.vx = Math.cos(angle) * 4 * (1 + Math.random() * BOUNCE_VARIATION);
            ball.vy = Math.sin(angle) * 4 * (1 + Math.random() * BOUNCE_VARIATION);
            ball.vx += (Math.random() - 0.5) * 2;
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawPegs();
    drawSlots();

    balls.forEach(ball => {
        if (ball.trail) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ball.trail.forEach((pos, i) => {
                ctx.lineWidth = i / ball.trail.length * 5;
                if (i === 0) ctx.moveTo(pos.x, pos.y);
                else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();
        }

        const gradient = ctx.createRadialGradient(
            ball.x - 3, ball.y - 3, 0,
            ball.x, ball.y, BALL_RADIUS
        );
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ff0');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });

    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        
        if (particle.life > 0) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(${particle.color}, ${particle.life})`;
            ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    popups.forEach(popup => {
        if (popup.life > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${popup.life})`;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(popup.text, popup.x, popup.y);
            popup.y -= 2;
            popup.life -= 0.02;
        }
    });
}

function updateGameState() {
    cleanup();
    updateBalls();
    draw();
    
    animationFrameId = requestAnimationFrame(updateGameState);
}
function startGame() {
    if (animationFrameId === null) {
        updateGameState();
    }
}

function stopGame() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function formatNumber(num) {
    const suffixes = ['', 'K', 'M', 'B', 'T', 'QD', 'QN', 'SX', 'SP', 'OC', 'NO', 'DC'];
    const numAbs = Math.abs(num);
    if (numAbs < 1000) return num.toString();
    const exp = Math.min(Math.floor(Math.log10(numAbs) / 3), suffixes.length - 1);
    const shortened = (numAbs / Math.pow(1000, exp)).toFixed(1);
    return (Math.sign(num) * parseFloat(shortened)).toString() + suffixes[exp];
}

function dropBalls() {
    const betAmount = parseInt(betInput.value);
    const ballCount = Math.min(parseInt(ballCountInput.value), MAX_BALLS);
    const totalCost = betAmount * ballCount;

    if (betAmount >= 20 && balance >= totalCost) {
        updateBalance(balance - totalCost);
        const dropWidth = Math.min(canvas.width * 0.3, 200);
        
        for (let i = 0; i < ballCount; i++) {
            setTimeout(() => {
                balls.push({
                    x: canvas.width / 2 + (Math.random() - 0.5) * dropWidth,
                    y: 0,
                    vx: (Math.random() - 0.5) * 2,
                    vy: 0,
                    bet: betAmount,
                    trail: []
                });
            }, i * 100);
        }
        startGame();
    } else {
        alert("Apuesta no válida o saldo insuficiente");
    }
}

function updateTimer() {
    const now = Date.now();
    const timeLeft = Math.max(0, FREE_POINTS_COOLDOWN - (now - lastFreePointsTime));
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft === 0) {
        updateBalance(balance + FREE_POINTS_AMOUNT);
        lastFreePointsTime = now;
        saveUserData();
        createPopup(`+${formatNumber(FREE_POINTS_AMOUNT)} puntos GRATIS!`, canvas.width/2, canvas.height/2);
    }
}

function redeemPoints() {
    if (balance >= MIN_REDEEM_POINTS) {
        const redeemableAmount = Math.floor(balance / 100) * 100;
        const confirmRedeem = confirm(`¿Quieres canjear ${formatNumber(redeemableAmount)} puntos por ${redeemableAmount / 100}€ en tarjetas de regalo?`);
        
        if (confirmRedeem) {
            updateBalance(balance - redeemableAmount);
            alert(`Has canjeado exitosamente ${formatNumber(redeemableAmount)} puntos por ${redeemableAmount / 100}€ en tarjetas de regalo. Tu nuevo balance es ${formatNumber(balance)} puntos.`);
            // Aquí se implementaría la lógica para generar y enviar la tarjeta de regalo
        }
    } else {
        alert(`Necesitas al menos ${formatNumber(MIN_REDEEM_POINTS)} puntos para canjear por tarjetas de regalo.`);
    }
}

function watchAd() {
    const now = Date.now();
    if (now - lastAdWatchTime >= AD_COOLDOWN) {
        // Simular ver un anuncio
        setTimeout(() => {
            updateBalance(balance + AD_REWARD);
            lastAdWatchTime = now;
            saveUserData();
            alert(`¡Gracias por ver el anuncio! Has ganado ${formatNumber(AD_REWARD)} puntos.`);
        }, 5000);
    } else {
        const timeLeft = Math.ceil((AD_COOLDOWN - (now - lastAdWatchTime)) / 60000);
        alert(`Debes esperar ${timeLeft} minutos antes de poder ver otro anuncio.`);
    }
}

// Initialization and Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    
    const closeAdBtn = document.querySelector('.close-ad');
    const adBanner = document.querySelector('.ad-banner');
    
    if (closeAdBtn && adBanner) {
        closeAdBtn.addEventListener('click', () => {
            adBanner.style.transform = 'translate(-50%, 100%)';
        });
    }

    ballCountInput.addEventListener('change', () => {
        if (parseInt(ballCountInput.value) > MAX_BALLS) {
            ballCountInput.value = MAX_BALLS;
        }
        if (parseInt(ballCountInput.value) < 1) {
            ballCountInput.value = 1;
        }
    });

    dropBtn.addEventListener('click', dropBalls);
    redeemBtn.addEventListener('click', redeemPoints);
    watchAdBtn.addEventListener('click', watchAd);

    resizeCanvas();
    initializeGame();
    draw(); // Dibuja el estado inicial del juego
    setInterval(updateTimer, 1000);
});

window.addEventListener('resize', () => {
    resizeCanvas();
    initializeGame();
    draw(); // Redibuja el juego después de cambiar el tamaño
});

window.addEventListener('beforeunload', () => {
    saveUserData();
});

setInterval(saveUserData, 30000);

canvas.addEventListener('touchstart', (e) => e.preventDefault());
canvas.addEventListener('touchmove', (e) => e.preventDefault());
