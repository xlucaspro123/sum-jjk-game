class SoundManager {
    constructor() {
        this.sounds = {
            hit: new Audio('assets/hit.mp3'),
            parry: new Audio('assets/parry.mp3'),
            dash: new Audio('assets/dash.mp3'),
            grab: new Audio('assets/grab.mp3'),
            wallBounce: new Audio('assets/wallbounce.mp3'),
            blackFlash: new Audio('assets/blackflash.mp3'),
            heavyCharge: new Audio('assets/heavy_charge.mp3'),
            domain: new Audio('assets/domain.mp3'),
            glassShatter: new Audio('assets/shatter.mp3')
        };
        Object.values(this.sounds).forEach(audio => {
            audio.volume = 0.45;
            audio.preload = 'auto';
        });
    }

    play(name) {
        const sound = this.sounds[name];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }

    playHit() { this.play('hit'); }
    playParry() { this.play('parry'); }
    playDash() { this.play('dash'); }
    playGrab() { this.play('grab'); }
    playWallBounce() { this.play('wallBounce'); }
    playBlackFlash() { this.play('blackFlash'); }
    playHeavyCharge() { this.play('heavyCharge'); }
    playDomain() { this.play('domain'); }
    playGlassShatter() { this.play('glassShatter'); }
}
const sfx = new SoundManager();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let cameraShake = 0;
let hitstopFrames = 0;
let particles = [];
let spatialCracks = [];
let frameCages = [];
let domainRings = [];
let shockingEffects = [];
let floatingTexts = [];
let flashAlpha = 0;
let blackFlashTimer = 0;
let gameOver = false;
let isBotEnabled = true;
let isDummyMode = false;
let aiState = 'APPROACH';
let aiStateTimer = 0;

const tombaughs = [
    {x: 180, y: 180, scale: 0.8}, {x: 820, y: 160, scale: 0.9},
    {x: 320, y: 120, scale: 0.5}, {x: 680, y: 130, scale: 0.6},
    {x: 100, y: 380, scale: 1.2}, {x: 900, y: 400, scale: 1.3},
];

function distancePointToSegment(px, py, x1, y1, x2, y2) {
    let l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function spawnFloatingText(text, x, y, color = '#fff') {
    floatingTexts.push({ text, x, y, vy: -1.2, life: 40, color });
}

class Player {
    constructor(x, y, color, isP1, name) {
        this.x = x; this.y = y; this.startX = x; this.startY = y;
        this.color = color; this.isP1 = isP1; this.name = name;
        this.hp = 100; this.maxHp = 100;
        this.ce = 100; this.maxCe = 100;
        this.speed = 5;
        this.facing = isP1 ? 1 : -1;
        this.actionState = 'idle'; this.actionTimer = 0;
        this.specialCooldown = 0; this.frameCooldown = 0;
        this.domainCooldown = 0; this.domainTimer = 0;
        this.targetData = null; this.afterimages = [];
        this.hitboxRadius = 24; this.stunTimer = 0; this.framedTimer = 0;
        this.domainName = isP1 ? "Projection Breaker" : "Sky Palace";
        this.dashCooldown = 0; this.dashIFrameTimer = 0;
        this.dashVector = {x: 0, y: 0}; this.dashActiveTimer = 0;
        this.parryCooldown = 0; this.parryWindowTimer = 0;
        this.sparkCombo = 0; this.sparkMultiplier = 1.0;
        this.heavyCharge = 0;
        this.comboStep = 0; this.comboWindow = 0;
    }

    reset() {
        this.x = this.startX; this.y = this.startY; this.hp = this.maxHp; this.ce = this.maxCe;
        this.actionState = 'idle'; this.actionTimer = 0;
        this.specialCooldown = 30; this.frameCooldown = 30;
        this.domainCooldown = 30; this.domainTimer = 0;
        this.facing = this.isP1 ? 1 : -1; this.afterimages = [];
        this.stunTimer = 0; this.framedTimer = 0;
        this.dashCooldown = 0; this.dashIFrameTimer = 0; this.dashActiveTimer = 0;
        this.parryCooldown = 0; this.parryWindowTimer = 0;
        this.sparkCombo = 0; this.sparkMultiplier = 1.0;
        this.heavyCharge = 0; this.comboStep = 0; this.comboWindow = 0;
    }

    consumeCE(amount) {
        if (this.ce >= amount) {
            this.ce -= amount;
            return true;
        }
        spawnFloatingText("NO CE!", this.x, this.y - 70, '#ffaa00');
        return false;
    }

    update(keys, isHoldingAttack, moveVectorOverride) {
        if (this.hp <= 0 || gameOver || hitstopFrames > 0) return;
        this.ce = Math.min(this.maxCe, this.ce + 0.2);

        if (this.specialCooldown > 0) this.specialCooldown--;
        if (this.frameCooldown > 0) this.frameCooldown--;
        if (this.domainCooldown > 0) this.domainCooldown--;
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.dashIFrameTimer > 0) this.dashIFrameTimer--;
        if (this.parryCooldown > 0) this.parryCooldown--;
        if (this.parryWindowTimer > 0) this.parryWindowTimer--;
        if (this.comboWindow > 0) {
            this.comboWindow--;
            if (this.comboWindow === 0) this.comboStep = 0;
        }

        if (isHoldingAttack && this.actionState === 'idle' && this.stunTimer === 0 && this.framedTimer === 0) {
            this.heavyCharge = Math.min(30, this.heavyCharge + 1);
            if (this.heavyCharge === 15) sfx.playHeavyCharge();
            if (Math.random() < 0.2) spawnElectricSparks(this.x + this.facing*20, this.y-30, '#ff0844');
        }

        if (this.domainTimer > 0) {
            this.domainTimer--;
            if (!this.isP1 && this.domainTimer % 15 === 0) {
                this.hp = Math.min(this.maxHp, this.hp + 1.5);
            }
        }

        if (this.framedTimer > 0) { this.framedTimer--; return; }
        if (this.stunTimer > 0) { this.stunTimer--; return; }

        if (this.dashActiveTimer > 0) {
            this.dashActiveTimer--;
            this.x += this.dashVector.x * 14; 
            this.y += this.dashVector.y * 14;
            
            if (this.x <= 80 || this.x >= canvas.width - 80 || this.y <= 220 || this.y >= canvas.height - 50) {
                sfx.playWallBounce();
                cameraShake = 20;
                spawnWallBounceSparks(this.x, this.y - 30);
                spawnFloatingText("WALL BOUNCE!", this.x, this.y - 85, '#ff0844');
                this.dashActiveTimer = 0;
                this.stunTimer = 18;
                this.sparkCombo = 0; this.sparkMultiplier = 1.0;
            }
            this.clampToBounds();
            if (Math.random() < 0.6) this.afterimages.push({x: this.x, y: this.y, facing: this.facing, color: this.color, life: 10});
            return;
        }

        if (Math.random() < 0.3) this.afterimages.push({x: this.x, y: this.y, facing: this.facing, color: this.color, life: 8});
        this.afterimages.forEach(a => a.life--);
        this.afterimages = this.afterimages.filter(a => a.life > 0);

        if (this.actionState === 'ice_windup') {
            this.actionTimer--;
            if (Math.random() < 0.5) spawnElectricSparks(this.x, this.y, '#e0f7fa');
            if (this.actionTimer <= 0) { this.executeIceBreakStatic(); }
            return;
        }

        if (this.actionTimer > 0) {
            this.actionTimer--;
            if (this.actionTimer === 0) this.actionState = 'idle';
            return;
        }

        let moveX = moveVectorOverride ? moveVectorOverride.x : 0;
        let moveY = moveVectorOverride ? moveVectorOverride.y : 0;

        if (moveX === 0 && moveY === 0) {
            if (this.isP1) {
                if (keys['KeyA']) moveX = -1;
                if (keys['KeyD']) moveX = 1;
                if (keys['KeyW']) moveY = -1;
                if (keys['KeyS']) moveY = 1;
            } else {
                if (keys['ArrowLeft']) moveX = -1;
                if (keys['ArrowRight']) moveX = 1;
                if (keys['ArrowUp']) moveY = -1;
                if (keys['ArrowDown']) moveY = 1;
            }
        }

        if (moveX !== 0) this.facing = moveX > 0 ? 1 : -1;
        if (moveX !== 0 && moveY !== 0 && !moveVectorOverride) { moveX *= 0.707; moveY *= 0.707; }
        this.x += moveX * this.speed; this.y += moveY * this.speed;
        this.clampToBounds();
    }

    dash(customVec) {
        if (this.dashCooldown > 0 || this.stunTimer > 0 || this.framedTimer > 0 || this.hp <= 0 || gameOver) return;
        if (!this.consumeCE(15)) return;
        let moveX = customVec ? customVec.x : 0;
        let moveY = customVec ? customVec.y : 0;
        if (moveX === 0 && moveY === 0) moveX = this.facing;
        this.dashVector = {x: moveX, y: moveY};
        this.dashActiveTimer = 7; this.dashIFrameTimer = 16; this.dashCooldown = 50;
        sfx.playDash();
        spawnHitSparks(this.x, this.y - 15, '#e0f7fa');
    }

    parry() {
        if (this.parryCooldown > 0 || this.stunTimer > 0 || this.framedTimer > 0 || this.hp <= 0 || gameOver) return;
        if (!this.consumeCE(20)) return;
        this.parryWindowTimer = 12; this.parryCooldown = 75;
        sfx.playParry();
        spawnElectricSparks(this.x, this.y, '#ffd700');
    }

    grab(target) {
        if (this.stunTimer > 0 || this.framedTimer > 0 || this.actionTimer > 0 || this.hp <= 0 || gameOver) return;
        let dist = Math.hypot(target.x - this.x, target.y - this.y);
        if (dist < 75) {
            sfx.playGrab();
            target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 0, target.hp - 18);
            target.applyStun(35);
            let knockDir = this.facing;
            let targetNewX = target.x + knockDir * 65;
            if (targetNewX <= 80 || targetNewX >= canvas.width - 80) {
                sfx.playWallBounce();
                target.x = targetNewX <= 80 ? 95 : canvas.width - 95;
                target.applyStun(25);
                spawnWallBounceSparks(target.x, target.y - 30);
                spawnFloatingText("WALL BOUNCE!", target.x, target.y - 85, '#ff0844');
                cameraShake = 25;
            } else {
                target.x = targetNewX;
                cameraShake = 12;
            }
            spawnFloatingText("GRAB BREAK!", target.x, target.y - 70, '#00f2fe');
            checkWin();
        }
    }

    clampToBounds() {
        this.x = Math.max(80, Math.min(canvas.width - 80, this.x));
        this.y = Math.max(220, Math.min(canvas.height - 50, this.y));
    }

    applyStun(durationFrames = 21) {
        if (this.framedTimer > 0) return;
        if (this.parryWindowTimer > 0) {
            this.parryWindowTimer = 0;
            sfx.playParry();
            spawnHitSparks(this.x, this.y - 30, '#ffd700');
            spawnFloatingText("PARRY!", this.x, this.y - 75, '#ffd700');
            cameraShake = 15;
            hitstopFrames = 3;
            this.sparkCombo++;
            this.sparkMultiplier = Math.min(2.5, 1.0 + this.sparkCombo * 0.3);
            return;
        }
        if (this.dashIFrameTimer > 0) return;
        this.stunTimer = isDummyMode && !this.isP1 ? 8 : durationFrames;
        if (!isDummyMode || this.isP1) {
            this.sparkCombo = 0; this.sparkMultiplier = 1.0;
        }
        if (this.actionState === 'ice_windup') { this.actionState = 'idle'; this.targetData = null; }
    }

    applyFramed(durationFrames = 105) {
        if (this.dashIFrameTimer > 0) return;
        this.framedTimer = durationFrames; this.stunTimer = 0;
        this.actionState = 'idle'; this.targetData = null;
        cameraShake = 18; hitstopFrames = 4; sfx.playGlassShatter();
        spawnGlassShatter(this.x, this.y - 30);
        spawnFloatingText("FRAMED!", this.x, this.y - 80, '#00f2fe');
    }

    activateDomain(target) {
        if (this.stunTimer > 0 || this.framedTimer > 0 || this.domainCooldown > 0 || this.hp <= 0 || gameOver) return;
        if (!this.consumeCE(50)) return;
        let dist = Math.hypot(target.x - this.x, target.y - this.y);
        let maxDist = this.isP1 ? 10 * 50 : 12 * 50;

        if (dist <= maxDist) {
            this.domainCooldown = this.isP1 ? 2700 : 3000;
            this.domainTimer = 300;
            if (this.isP1) {
                this.hp = Math.min(this.maxHp, this.hp + 30);
                spawnHitSparks(this.x, this.y - 30, '#00f2fe');
            } else {
                this.hp = Math.min(this.maxHp, this.hp + 30);
            }
            cameraShake = 30; hitstopFrames = 5;
            sfx.playDomain();
            spawnBlackFlashShockwave(this.x, this.y - 30);
            spawnFloatingText("DOMAIN EXPANSION!", canvas.width/2, 200, this.isP1 ? '#00f2fe' : '#ff0844');
            domainRings.push({
                x: this.x, y: this.y,
                radius: 180, maxRadius: 280, life: 300,
                color: this.isP1 ? '#00f2fe' : '#ff0844'
            });
        }
    }

    attack(target) {
        if (this.stunTimer > 0 || this.framedTimer > 0 || this.actionTimer > 0 || this.actionState !== 'idle' || this.hp <= 0 || gameOver) return;
        
        const isHeavyAttempt = this.heavyCharge >= 15;
        this.actionState = 'attack'; 
        this.actionTimer = isHeavyAttempt ? 22 : 12;

        let dist = Math.hypot(target.x - this.x, target.y - this.y);
        let inRange = dist < 85 && ((target.x - this.x) * this.facing > -40);

        if (inRange) {
            this.comboStep = (this.comboStep % 3) + 1;
            this.comboWindow = 45;

            if (isHeavyAttempt) {
                let dmg = Math.round(75 * this.sparkMultiplier);
                target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 0, target.hp - dmg);
                target.applyStun(45);
                sfx.playBlackFlash();
                spawnBlackFlashShockwave(target.x, target.y - 20);
                spawnFloatingText("BLACK FLASH!", target.x, target.y - 75, '#ff0844');
                for(let i=0; i<12; i++) spawnBlackFlashLightning(target.x, target.y - 20);
                cameraShake = 45; hitstopFrames = 6;
                shockingEffects.push({ target: target, ticksLeft: 3, timer: 60, dmgPerTick: 5 });
                this.sparkCombo += 3;
                this.sparkMultiplier = 2.5;
            } else {
                let isBackstrike = ((target.x - this.x) * target.facing > 5);
                let baseDmg = isBackstrike ? 35 : (10 + this.comboStep * 4);
                let dmg = Math.round(baseDmg * this.sparkMultiplier);
                
                target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 0, target.hp - dmg);
                target.applyStun(isBackstrike ? 30 : 21);
                
                if (isBackstrike) {
                    sfx.playBlackFlash();
                    spawnBlackFlashShockwave(target.x, target.y - 20);
                    spawnFloatingText("BACKSTRIKE!", target.x, target.y - 70, '#ff0844');
                    for(let i=0; i<8; i++) spawnBlackFlashLightning(target.x, target.y - 20);
                    cameraShake = 35; hitstopFrames = 5;
                    shockingEffects.push({ target: target, ticksLeft: 3, timer: 60, dmgPerTick: 5 });
                } else {
                    sfx.playHit();
                    spawnHitSparks(target.x, target.y - 15, this.color);
                    spawnFloatingText(`JAB x${this.comboStep}`, target.x, target.y - 65, '#00f2fe');
                    cameraShake = 6; hitstopFrames = 2;
                }
                this.sparkCombo++;
                this.sparkMultiplier = Math.min(2.5, 1.0 + this.sparkCombo * 0.3);
            }
            checkWin();
        } else {
            if (isHeavyAttempt) {
                this.applyFramed(90);
                spawnGlassShatter(this.x + this.facing*40, this.y - 30);
            }
            this.sparkCombo = 0; this.sparkMultiplier = 1.0;
        }
        this.heavyCharge = 0;
    }

    startIceBreaker(target) {
        if (this.stunTimer > 0 || this.framedTimer > 0 || this.specialCooldown > 0 || this.actionState !== 'idle' || this.hp <= 0 || gameOver) return;
        if (!this.consumeCE(30)) return;
        this.specialCooldown = 180;
        
        if (!this.isP1 && this.domainTimer > 0) {
            let damage = Math.round(35 * this.sparkMultiplier);
            target.hp = Math.max(isDummyMode ? 10 : 0, target.hp - damage);
            target.applyStun(35);
            sfx.playHit(); spawnGlassShatter(target.x, target.y - 30);
            cameraShake = 25; hitstopFrames = 4; checkWin(); return;
        }

        this.actionState = 'ice_windup'; this.actionTimer = 25; this.targetData = target;
        let strikeX = this.x + this.facing * 65; let strikeY = this.y - 15;
        let distCenter = Math.hypot(target.x - strikeX, (target.y - 15) - strikeY);
        let willBeBlackFlash = distCenter < 40;

        spawnSpatialCrack(strikeX, strikeY, willBeBlackFlash ? '#ff0844' : '#e0f7fa', willBeBlackFlash, this);
        this.strikeZone = {x: strikeX, y: strikeY};
    }

    executeIceBreakStatic() {
        let target = this.targetData;
        let zone = this.strikeZone || {x: this.x + this.facing*65, y: this.y-15};
        let dist = Math.hypot(target.x - zone.x, (target.y - 15) - zone.y);
        let isBlackFlash = dist < 45 && target.hp > 0;

        if (isBlackFlash) {
            let damage = Math.round((target.maxHp * 0.95) * this.sparkMultiplier);
            target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 5, target.hp - damage);
            target.applyStun(35);
            blackFlashTimer = 22; sfx.playBlackFlash();
            spawnBlackFlashShockwave(zone.x, zone.y);
            spawnSpatialCrack(zone.x, zone.y, '#ff0844', true, this);
            spawnFloatingText("FINISHER BLACK FLASH!", zone.x, zone.y - 50, '#ff0844');
            for(let i=0; i<12; i++) spawnBlackFlashLightning(zone.x, zone.y);
            cameraShake = 42; hitstopFrames = 5; this.sparkCombo += 2; this.sparkMultiplier = 2.5;
        } else {
            if (dist < 85) {
                target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 0, target.hp - Math.round(22 * this.sparkMultiplier));
                target.applyStun(28); this.sparkCombo++;
            } else {
                this.sparkCombo = 0; this.sparkMultiplier = 1.0;
            }
            sfx.playGlassShatter(); spawnGlassShatter(zone.x, zone.y);
            flashAlpha = 0.55; cameraShake = 14; hitstopFrames = 3;
        }
        this.actionState = 'idle'; this.targetData = null; checkWin();
    }

    castFrame(target) {
        if (this.stunTimer > 0 || this.framedTimer > 0 || this.hp <= 0 || gameOver) return;
        let isProjectionDomain = this.isP1 && this.domainTimer > 0;
        if (!isProjectionDomain) {
            if (this.frameCooldown > 0) return;
            this.frameCooldown = 300;
        }
        let projX = isProjectionDomain ? target.x : (this.x + this.facing * 120);
        let projY = isProjectionDomain ? (target.y - 30) : (this.y - 30);
        let distToTarget = Math.hypot(target.x - projX, (target.y - 30) - projY);

        if (isProjectionDomain || (distToTarget < 90 && target.hp > 0)) {
            target.applyFramed(105);
            frameCages.push({ x: target.x, y: target.y - 30, target: target, life: 105, color: '#00f2fe' });
            sfx.playGlassShatter(); spawnGlassShatter(target.x, target.y - 30);
        } else {
            this.applyFramed(105);
            frameCages.push({ x: this.x, y: this.y - 30, target: this, life: 105, color: '#ff0844' });
        }
        cameraShake = 15; hitstopFrames = 3;
    }

    draw(ctx) {
        this.afterimages.forEach(a => {
            ctx.save(); ctx.globalAlpha = (a.life / 10) * 0.4;
            drawRobloxAvatar(ctx, a.x, a.y, a.facing, a.color, true); ctx.restore();
        });
        ctx.save();
        if (this.framedTimer > 0) ctx.globalAlpha = 0.85;
        else if (this.stunTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) ctx.globalAlpha = 0.7;
        else if (this.dashIFrameTimer > 0) ctx.globalAlpha = 0.6;
        drawRobloxAvatar(ctx, this.x, this.y, this.facing, this.color, false, this.actionState);
        ctx.restore();

        if (this.heavyCharge > 0) {
            ctx.save();
            ctx.fillStyle = '#0f1117'; ctx.fillRect(this.x - 20, this.y - 85, 40, 5);
            ctx.fillStyle = this.heavyCharge >= 15 ? '#ff0844' : '#00f2fe';
            ctx.fillRect(this.x - 20, this.y - 85, 40 * (this.heavyCharge / 30), 5);
            ctx.restore();
        }

        if (this.parryWindowTimer > 0) {
            ctx.save(); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(this.x, this.y - 35, 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (this.sparkMultiplier > 1.0) {
            ctx.save(); ctx.font = 'bold 10px system-ui'; ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
            ctx.textAlign = 'center'; ctx.fillText(`SPARK x${this.sparkMultiplier.toFixed(1)}`, this.x, this.y - 75); ctx.restore();
        }
        if (this.domainTimer > 0) {
            ctx.save(); ctx.font = 'bold 11px system-ui'; ctx.fillStyle = this.isP1 ? '#00f2fe' : '#ff0844';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.textAlign = 'center';
            ctx.fillText(`Domain Expansion: ${this.domainName}`, this.x, this.y - 95); ctx.restore();
        }
    }
}

function updateAI(bot, target) {
    if (bot.hp <= 0 || gameOver || isDummyMode) {
        if (isDummyMode && !bot.isP1) bot.hp = bot.maxHp;
        return;
    }
    if (bot.specialCooldown > 0) bot.specialCooldown--;
    if (bot.frameCooldown > 0) bot.frameCooldown--;
    if (bot.domainCooldown > 0) bot.domainCooldown--;
    if (bot.dashCooldown > 0) bot.dashCooldown--;
    if (bot.dashIFrameTimer > 0) bot.dashIFrameTimer--;
    if (bot.parryCooldown > 0) bot.parryCooldown--;
    if (bot.parryWindowTimer > 0) bot.parryWindowTimer--;

    if (bot.framedTimer > 0) { bot.framedTimer--; return; }
    if (bot.stunTimer > 0) { bot.stunTimer--; return; }
    if (bot.dashActiveTimer > 0) {
        bot.dashActiveTimer--; bot.x += bot.dashVector.x * 14; bot.y += bot.dashVector.y * 14;
        bot.clampToBounds(); return;
    }
    if (bot.actionTimer > 0 && bot.actionState !== 'idle') {
        bot.actionTimer--; if (bot.actionTimer === 0) bot.actionState = 'idle'; return;
    }
    let dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    let dx = target.x - bot.x, dy = target.y - bot.y;
    let angle = Math.atan2(dy, dx);
    bot.facing = dx > 0 ? 1 : -1;

    if (aiStateTimer > 0) aiStateTimer--;
    if (p1.domainTimer > 0 && bot.domainCooldown === 0 && Math.random() < 0.1) { bot.activateDomain(target); return; }

    if (aiStateTimer <= 0) {
        aiStateTimer = 30;
        if (target.parryWindowTimer > 0) aiState = 'RETREAT';
        else if (dist < 85) aiState = 'AGGRESSIVE';
        else if (dist < 220) aiState = Math.random() < 0.6 ? 'APPROACH' : 'RETREAT';
        else aiState = 'APPROACH';
    }

    if (aiState === 'AGGRESSIVE') {
        if (bot.specialCooldown === 0 && Math.random() < 0.35) { bot.startIceBreaker(target); return; }
        if (dist < 120 && bot.frameCooldown === 0 && Math.random() < 0.25) { bot.castFrame(target); return; }
        if (Math.random() < 0.6) {
            if (Math.random() < 0.3) bot.heavyCharge = 20;
            bot.attack(target);
            return;
        }
    } else if (aiState === 'APPROACH') {
        bot.x += Math.cos(angle) * bot.speed; bot.y += Math.sin(angle) * bot.speed;
    } else if (aiState === 'RETREAT') {
        if (dist < 70 && bot.dashCooldown === 0) {
            bot.dashVector = {x: -dx/dist, y: -dy/dist};
            bot.dashActiveTimer = 6; bot.dashIFrameTimer = 16; bot.dashCooldown = 55;
            sfx.playDash(); aiState = 'APPROACH'; return;
        }
        bot.x -= Math.cos(angle) * bot.speed * 0.7; bot.y -= Math.sin(angle) * bot.speed * 0.7;
    }
    if (dist <= 550 && bot.domainCooldown === 0 && Math.random() < 0.02) { bot.activateDomain(target); return; }
    bot.clampToBounds();
}

function checkCrackLineHits(target) {
    if (target.hp <= 0 || target.framedTimer > 0 || gameOver) return;
    let targetCenterY = target.y - 30;
    spatialCracks.forEach(crack => {
        if (crack.owner === target) return;
        crack.lines.forEach(l => {
            let d = distancePointToSegment(target.x, targetCenterY, l.x1, l.y1, l.x2, l.y2);
            if (d < target.hitboxRadius) {
                let cutDamage = crack.isBlackFlash ? 3.5 : 1.2;
                target.hp = Math.max(isDummyMode && !target.isP1 ? 10 : 0, target.hp - cutDamage);
                if (Math.random() < 0.3) spawnHitSparks(target.x, targetCenterY, l.color || '#e0f7fa');
                checkWin();
            }
        });
    });
}

function updateShockingEffects() {
    shockingEffects.forEach(effect => {
        effect.timer--;
        if (effect.timer <= 0) {
            effect.timer = 60;
            effect.ticksLeft--;
            effect.target.hp = Math.max(isDummyMode && !effect.target.isP1 ? 10 : 0, effect.target.hp - effect.dmgPerTick);
            spawnElectricSparks(effect.target.x, effect.target.y - 30, '#ff0844');
            sfx.play('hit');
            checkWin();
        }
    });
    shockingEffects = shockingEffects.filter(e => e.ticksLeft > 0);
}

function checkWin() {
    if (gameOver || isDummyMode) return;
    if (p1.hp <= 0) { gameOver = true; showWinModal(p2.name); }
    else if (p2.hp <= 0) { gameOver = true; showWinModal(p1.name); }
}

function showWinModal(winnerName) {
    document.getElementById('win-text').innerText = `¡Gana Jugador ${winnerName}!`;
    document.getElementById('win-modal').classList.add('active');
}

function resetGame() {
    p1.reset(); p2.reset(); gameOver = false;
    particles = []; spatialCracks = []; frameCages = []; domainRings = []; shockingEffects = []; floatingTexts = [];
    blackFlashTimer = 0; flashAlpha = 0; hitstopFrames = 0;
    document.getElementById('win-modal').classList.remove('active');
}

function drawRobloxAvatar(ctx, x, y, facing, color, isGhost, state) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = isGhost ? 0 : 12; ctx.fillRect(-14, -45, 28, 30);
    ctx.fillStyle = isGhost ? '#88ffff' : '#ffdfbd'; ctx.fillRect(-10, -68, 20, 20);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath();
    if (state === 'attack') { ctx.moveTo(facing * 10, -35); ctx.lineTo(facing * 65, -45); }
    else { ctx.moveTo(facing * 12, -35); ctx.lineTo(facing * 32, -15); }
    ctx.stroke(); ctx.restore();
}

const p1 = new Player(300, 360, '#00f2fe', true, 'P1');
const p2 = new Player(700, 360, '#ff0844', false, 'DUMMY/BOT');

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyB') {
        isBotEnabled = !isBotEnabled; isDummyMode = false;
        const ind = document.getElementById('bot-indicator');
        ind.innerText = isBotEnabled ? 'BOT P2: TÁCTICO [B=Toggle, N=Dummy]' : 'PVP LOCAL [B=Toggle, N=Dummy]';
        ind.style.color = '#00f2fe';
    }
    if (e.code === 'KeyN') {
        isDummyMode = !isDummyMode; isBotEnabled = false; p2.hp = p2.maxHp; p2.ce = p2.maxCe;
        const ind = document.getElementById('bot-indicator');
        ind.innerText = isDummyMode ? 'MODO DUMMY P2 ACTIVO (Inmóvil) [N=Off]' : 'MODO DUMMY APAGADO';
        ind.style.color = isDummyMode ? '#ffd700' : '#ffb199';
    }
    if (e.code === 'Digit1') p1.attack(p2);
    if (e.code === 'Digit2') p1.startIceBreaker(p2);
    if (e.code === 'Digit3') p1.castFrame(p2);
    if (e.code === 'Digit4') p1.activateDomain(p2);
    if (e.code === 'KeyE') p1.parry();
    if (e.code === 'KeyF') p1.grab(p2);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') p1.dash();

    if (!isBotEnabled && !isDummyMode) {
        if (e.code === 'KeyI') p2.attack(p1);
        if (e.code === 'KeyO') p2.startIceBreaker(p1);
        if (e.code === 'KeyK') p2.castFrame(p1);
        if (e.code === 'KeyL') p2.activateDomain(p1);
        if (e.code === 'KeyU') p2.parry();
        if (e.code === 'KeyP') p2.dash();
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

let prevGpButtons = {};
function pollGamepadP1() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (!gp) return { move: {x:0, y:0}, holdingA: false };

    const b = (i) => gp.buttons[i]?.pressed || false;
    const edge = (i, name) => { let pressed = b(i); let justPressed = pressed && !prevGpButtons[name]; prevGpButtons[name] = pressed; return justPressed; };

    if (edge(12, 'dpadUp')) {
        if (gameOver) resetGame();
    }

    if (gameOver) return { move: {x:0, y:0}, holdingA: false };

    let dz = 0.25;
    let mx = gp.axes[0] || 0;
    let my = gp.axes || 0;
    if (Math.abs(mx) < dz) mx = 0;
    if (Math.abs(my) < dz) my = 0;
    if (gp.buttons[14]?.pressed) mx = -1;
    if (gp.buttons[15]?.pressed) mx = 1;
    if (gp.buttons[13]?.pressed) my = 1;

    if (edge(2, 'X')) p1.startIceBreaker(p2);
    if (edge(3, 'Y')) p1.castFrame(p2);
    if (edge(1, 'B')) p1.activateDomain(p2);
    if (edge(4, 'LB')) p1.parry();
    if (edge(6, 'LT')) p1.grab(p2);
    if (edge(5, 'RB')) {
        let dx = (Math.abs(mx) > dz || Math.abs(my) > dz) ? mx : p1.facing;
        let dy = (Math.abs(my) > dz) ? my : 0;
        p1.dash({x: dx, y: dy});
    }

    let aPressed = b(0);
    if (prevGpButtons.A && !aPressed) {
        p1.attack(p2);
    }
    prevGpButtons.A = aPressed;

    return { move: {x: mx, y: my}, holdingA: aPressed };
}

function spawnElectricSparks(x, y, color) {
    for(let i=0; i<3; i++) {
        particles.push({ x: x + (Math.random()-0.5)*40, y: y - 30 + (Math.random()-0.5)*40, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6 - 2, life: 12, color, size: 2 });
    }
}
function spawnHitSparks(x, y, color) {
    for (let i = 0; i < 20; i++) particles.push({ x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 18, color, size: 3.5 });
}
function spawnWallBounceSparks(x, y) {
    for (let i = 0; i < 25; i++) particles.push({ x, y, vx: (Math.random()-0.5)*14, vy: (Math.random()-0.5)*14 - 3, life: 25, color: '#ff0844', size: 4, isShard: true });
}
function spawnSpatialCrack(x, y, color = '#e0f7fa', isBlackFlash = false, owner = null) {
    let lines = [];
    let branchCount = isBlackFlash ? 14 : 10;
    for(let i=0; i<branchCount; i++) {
        let ang = (Math.PI * 2 / branchCount) * i + (Math.random() - 0.5)*0.3;
        let len1 = 45 + Math.random()*35;
        let x2 = x + Math.cos(ang) * len1, y2 = y + Math.sin(ang) * len1;
        lines.push({ x1: x, y1: y, x2: x2, y2: y2, color });
        if (Math.random() > 0.3) {
            let subAng = ang + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random()*0.5);
            let len2 = 20 + Math.random()*25;
            lines.push({ x1: x2, y1: y2, x2: x2 + Math.cos(subAng)*len2, y2: y2 + Math.sin(subAng)*len2, color });
        }
    }
    spatialCracks.push({ x, y, lines, life: isBlackFlash ? 40 : 30, isBlackFlash, owner });
}
function spawnBlackFlashLightning(x, y) {
    let segs = [], curX = x + (Math.random()-0.5)*50, curY = y + (Math.random()-0.5)*50;
    for(let i=0; i<4; i++) {
        let nxtX = curX + (Math.random()-0.5)*40, nxtY = curY + (Math.random()-0.5)*40;
        segs.push({x1: curX, y1: curY, x2: nxtX, y2: nxtY}); curX = nxtX; curY = nxtY;
    }
    particles.push({ isLightning: true, segs, life: 14, color: '#ff0844' });
}
function spawnGlassShatter(x, y) {
    for (let i = 0; i < 30; i++) particles.push({ x, y, vx: (Math.random()-0.5)*16, vy: (Math.random()-0.5)*16 - 2, life: 35, color: '#e0f7fa', size: 2.5 + Math.random()*4, isShard: true });
}
function spawnBlackFlashShockwave(x, y) {
    for (let i = 0; i < 60; i++) {
        let ang = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 22;
        particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 50, color: Math.random() > 0.3 ? '#ff0844' : '#0a0a0f', size: 3.5 + Math.random()*7, isShard: false });
    }
}

function updateHUD() {
    let displayHp2 = isDummyMode ? 100 : p2.hp;
    document.getElementById('p1-hp').style.width = `${Math.max(0, (p1.hp / p1.maxHp) * 100)}%`;
    document.getElementById('p2-hp').style.width = `${Math.max(0, (displayHp2 / p2.maxHp) * 100)}%`;
    document.getElementById('p1-ce').style.width = `${Math.max(0, (p1.ce / p1.maxCe) * 100)}%`;
    document.getElementById('p2-ce').style.width = `${Math.max(0, (p2.ce / p2.maxCe) * 100)}%`;
    
    let p1Cd = p1.specialCooldown > 0 ? `TIB:${(p1.specialCooldown/60).toFixed(1)}s` : 'TIB:OK';
    let p1Fr = p1.frameCooldown > 0 ? `FR:${(p1.frameCooldown/60).toFixed(1)}s` : 'FR:OK';
    let p1De = p1.domainCooldown > 0 ? `DE:${(p1.domainCooldown/60).toFixed(1)}s` : (p1.domainTimer > 0 ? 'DE:ACTIVE(+30HP)' : 'DE:OK');
    document.getElementById('p1-cd').innerText = `${p1Cd}|${p1Fr}|${p1De}`;

    let p2Cd = isDummyMode ? 'DUMMY:READY' : (p2.specialCooldown > 0 ? `TIB:${(p2.specialCooldown/60).toFixed(1)}s` : 'TIB:OK');
    let p2Fr = isDummyMode ? 'INF HP' : (p2.frameCooldown > 0 ? `FR:${(p2.frameCooldown/60).toFixed(1)}s` : 'FR:OK');
    let p2De = isDummyMode ? 'TEST' : (p2.domainCooldown > 0 ? `DE:${(p2.domainCooldown/60).toFixed(1)}s` : (p2.domainTimer > 0 ? 'DE:ACTIVE' : 'DE:OK'));
    document.getElementById('p2-cd').innerText = `${p2Cd}|${p2Fr}|${p2De}`;
}

function loop() {
    if (hitstopFrames > 0) {
        hitstopFrames--;
        requestAnimationFrame(loop);
        return;
    }

    const gpData = pollGamepadP1();
    p1.update(keys, gpData.holdingA || keys['Digit1'], gpData.move);
    
    if (!isDummyMode) { if (isBotEnabled) updateAI(p2, p1); else p2.update(keys); }
    updateShockingEffects();
    checkCrackLineHits(p1); checkCrackLineHits(p2); updateHUD();

    particles.forEach(p => { if (!p.isLightning) { p.x += p.vx; p.y += p.vy; if (p.isShard) p.vy += 0.25; } p.life--; });
    particles = particles.filter(p => p.life > 0);
    spatialCracks.forEach(c => c.life--); spatialCracks = spatialCracks.filter(c => c.life > 0);
    frameCages.forEach(f => f.life--); frameCages = frameCages.filter(f => f.life > 0);
    domainRings.forEach(d => { d.life--; }); domainRings = domainRings.filter(d => d.life > 0);
    floatingTexts.forEach(t => { t.y += t.vy; t.life--; }); floatingTexts = floatingTexts.filter(t => t.life > 0);

    if (cameraShake > 0) cameraShake *= 0.82;
    if (flashAlpha > 0) flashAlpha -= 0.06;
    if (blackFlashTimer > 0) blackFlashTimer--;

    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let distPlayers = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    let targetZoom = Math.min(1.25, Math.max(1.0, 1.25 - (distPlayers / 1000)));
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(targetZoom, targetZoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    if (cameraShake > 0.5) ctx.translate((Math.random()-0.5)*cameraShake*2.5, (Math.random()-0.5)*cameraShake*2.5);

    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=50) { ctx.beginPath(); ctx.moveTo(i, 200); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let j=200; j<canvas.height; j+=40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke(); }
    ctx.restore();

    domainRings.forEach(d => {
        ctx.save(); ctx.globalAlpha = Math.min(0.6, d.life / 60); ctx.strokeStyle = d.color; ctx.lineWidth = 3;
        ctx.shadowColor = d.color; ctx.shadowBlur = 15; ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.maxRadius * 0.8, d.maxRadius * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });

    tombaughs.forEach(t => {
        ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.scale, t.scale);
        ctx.fillStyle = '#2d3345'; ctx.fillRect(-12, -40, 24, 45);
        ctx.fillStyle = '#1e2230'; ctx.fillRect(-16, -48, 32, 10); ctx.restore();
    });

    let entities = [{type: 'player', obj: p1, y: p1.y}, {type: 'player', obj: p2, y: p2.y}].sort((a,b) => a.y - b.y);
    entities.forEach(e => { e.obj.draw(ctx); });

    frameCages.forEach(f => {
        ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = Math.min(1, f.life / 20);
        ctx.fillStyle = f.color === '#ff0844' ? 'rgba(255, 8, 68, 0.15)' : 'rgba(0, 242, 254, 0.15)';
        ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.shadowColor = f.color; ctx.shadowBlur = 20;
        let w = 48, h = 76; ctx.fillRect(-w/2, -h/2 - 15, w, h); ctx.strokeRect(-w/2, -h/2 - 15, w, h); ctx.restore();
    });

    spatialCracks.forEach(c => {
        ctx.save();
        if (c.isBlackFlash) { ctx.fillStyle = '#050608'; ctx.shadowColor = '#ff0844'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(c.x, c.y, 35, 0, Math.PI * 2); ctx.fill(); }
        c.lines.forEach(l => {
            ctx.strokeStyle = l.color || '#e0f7fa'; ctx.lineWidth = l.color === '#ff0844' ? 3.2 : 2.2;
            ctx.shadowColor = l.color === '#ff0844' ? '#ff0844' : '#00f2fe'; ctx.shadowBlur = l.color === '#ff0844' ? 22 : 12;
            ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
        });
        ctx.restore();
    });

    particles.forEach(p => {
        if (p.isLightning) {
            ctx.save(); ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.shadowColor = '#ff0844'; ctx.shadowBlur = 15;
            ctx.beginPath(); p.segs.forEach(s => { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }); ctx.stroke(); ctx.restore();
        } else {
            ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fillRect(p.x, p.y, p.size, p.size);
        }
    });

    floatingTexts.forEach(t => {
        ctx.save();
        ctx.font = 'bold 12px system-ui';
        ctx.fillStyle = t.color;
        ctx.shadowColor = t.color; ctx.shadowBlur = 8;
        ctx.globalAlpha = Math.min(1, t.life / 20);
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
    });

    if (p1.domainTimer > 0 || p2.domainTimer > 0) {
        ctx.save();
        let domColor = p1.domainTimer > 0 ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 8, 68, 0.12)';
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 150, canvas.width/2, canvas.height/2, 600);
        grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, domColor);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }

    if (blackFlashTimer > 0) {
        ctx.fillStyle = `rgba(15, 2, 5, ${0.5 * (blackFlashTimer/22)})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(224, 247, 250, ${flashAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
    requestAnimationFrame(loop);
}

loop();
