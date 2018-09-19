const PLAYER = 0;
const ENEMY = 1;

const numOfPlayerBullets = 60;
const numOfEnemyBullets = 1000;

let activeCanvas = document.getElementById("canvas");
let backCanvas = document.createElement("canvas");
let backCtx = backCanvas.getContext("2d");

let lastFrameTime = -1;
let initialized = false;
let input = {
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    shift: 0,
    interact: 0,
    space: 0
};

let textDimensions = [];        // Map of text dimensions for performance (don't recalculate dimensions of "0" many times).
const canvasMaxWidth = activeCanvas.width;
const canvasMaxHeight = activeCanvas.height;

let player = new Player(canvasMaxWidth / 2, canvasMaxHeight - 30);
let enemyScheduler = new EnemyScheduler();
let enemies = [];
let playerBullets = [];
let enemyBullets = [];

requestAnimationFrame(init);

function init(currentTime) {
    lastFrameTime = currentTime;
    if(!initialized) {
        initialized = true;
        backCanvas.width = canvasMaxWidth;
        backCanvas.height = canvasMaxHeight;
        for(let i = 0; i < numOfPlayerBullets; i++) {
            playerBullets.push(new Bullet(PLAYER));
        }
        for(let i = 0; i < numOfEnemyBullets; i++) {
            enemyBullets.push(new Bullet(ENEMY));
        }
        requestAnimationFrame(frameLoop);
    }
}

function advanceInput() {
    for(let key in input) {
        if(input[key] === 1) {
            input[key] = 2;
        }
    }
}

function logic(elapsed) {
    enemyScheduler.logic(elapsed);
    playerBullets.forEach(function (bullet) {
       if(bullet.active) {
           bullet.logic(elapsed);
       }
    });
    enemyBullets.forEach(function (bullet) {
       if(bullet.active) {
           bullet.logic(elapsed);
       }
    });
    enemies.forEach(function (enemy, index) {
        if(!enemy.active) {
            enemies.splice(index, 1);
        }
        enemy.logic(elapsed);
    });
    player.logic(elapsed);
}

function draw(ctx) {
    ctx.fillStyle = "#222222";
    ctx.fillRect(0, 0, canvasMaxWidth, canvasMaxHeight);
    playerBullets.forEach(function (bullet) {
        if(bullet.active) {
            bullet.draw(ctx);
        }
    });
    enemyBullets.forEach(function (bullet) {
        if(bullet.active) {
            bullet.draw(ctx);
        }
    });
    enemies.forEach(function (enemy) {
        enemy.draw(ctx);
    });
    player.draw(ctx);
}

function frameLoop(currentTime) {
    let elapsed = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    requestAnimationFrame(frameLoop);
    logic(elapsed);
    advanceInput();
    draw(backCtx);
    activeCanvas.getContext("2d").drawImage(backCanvas, 0, 0);
}

resizeActiveCanvas();
window.addEventListener("resize", resizeActiveCanvas);

function EnemyScheduler() {
    this.timeElapsed = 0;
    this.timePerEnemy = 1000;
}

EnemyScheduler.prototype.logic = function(elapsed) {
    this.timeElapsed += elapsed;
    if(this.timeElapsed > this.timePerEnemy) {
        this.timePerEnemy -= 10;
        this.timeElapsed -= this.timePerEnemy;
        enemies.push(new Enemy());
    }
};

function Enemy() {
    this.active = true;
    this.attackMode = 0;
    this.attackState = 0;

    this.friction = 0.995;
    this.maxVx = 0.5;
    this.maxVy = 0.5;
    this.acceleration = 0.005;
    this.fireRate = 1000;
    this.elapsedUntilNextFire = this.fireRate;
    this.vx = 0;
    this.vy = this.maxVy;

    this.scale = 1;
    this.width = 20;
    this.height = 20;
    this.x = (Math.random() * (canvasMaxWidth - this.width)) + this.width / 2;
    this.y = -this.height/2;
}

Enemy.prototype.draw = function(ctx) {
    ctx.fillStyle = "red";
    ctx.fillRect(
        this.x - this.width / 2 * this.scale,
        this.y - this.height / 2 * this.scale,
        this.width * this.scale,
        this.height * this.scale);
};

Enemy.prototype.logic = function(elapsed) {
    this.elapsedUntilNextFire -= elapsed;
    // Fires bullet
    if(this.elapsedUntilNextFire <= 0) {
        for(let i = 0; i < numOfEnemyBullets; i++) {
            if(!enemyBullets[i].active) {
                enemyBullets[i].init(
                    "#FFFFFF",
                    "#FF0000",
                    this.x,
                    this.y + this.width / 2 * this.scale,
                    this.scale,
                    this.vx,
                    this.vy);
                this.elapsedUntilNextFire = this.fireRate;
                break;
            }
        }
    }

    if(this.attackMode === 0) {
        // Friction
        this.vx *= Math.pow(this.friction, elapsed);
        this.vy *= Math.pow(this.friction, elapsed);

        let even = this.attackState % 2 === 0;
        if(even) {
            this.vx = this.maxVx;
        } else {
            this.vx = -this.maxVx;
        }

        // Velocity affects position.
        this.x += this.vx * elapsed;
        this.y += this.vy * elapsed;

        let widthMargin = this.width / 2 * this.scale;
        let heightMargin = this.height / 2 * this.scale;

        // Check if positions are in bounds.
        if(this.x < widthMargin) {
            this.x = widthMargin;
            this.vx *= -1;
            this.attackState++;
            this.vy = this.maxVy;
        } else if (this.x > canvasMaxWidth - widthMargin) {
            this.x = canvasMaxWidth - widthMargin;
            this.vx *= -1;
            this.attackState++;
            this.vy = this.maxVy;
        }

        if(this.y < -this.height) {
            this.y = -this.height;
            this.vy *= -1;
        } else if (this.y > canvasMaxHeight + this.height) {
            this.active = false;
            // lose life?
        }
    } else {
        // Arrow keys affect forward/left/right/backward velocity.
        if(input.left && !input.right) {
            this.vx += (-this.maxVx - this.vx) * this.acceleration * elapsed;
        }
        if(input.right && !input.left) {
            this.vx += (this.maxVx - this.vx) * this.acceleration * elapsed;
        }
        if(input.forward && !input.backward) {
            this.vy += (-this.maxVy - this.vy) * this.acceleration * elapsed;
        }
        if(input.backward && !input.forward) {
            this.vy += (this.maxVy - this.vy) * this.acceleration * elapsed;
        }
    }
};

function Bullet(owner) {
    this.active = false;
    this.owner = owner;
    this.color = "";
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.scale = 0;
    this.vx = 0;
    this.vy = 0;
}

Bullet.prototype.init = function(color, shadowColor, xPos, yPos, scale, vx, vy) {
    this.active = true;
    this.color = color;
    this.shadowColor = shadowColor;
    this.x = xPos;
    this.y = yPos;
    this.width = 8;
    this.height = 8;
    this.scale = scale;
    this.vx = 0;//vx;
    this.vy = -0.5 + (this.owner * 1);// + vy;
};

Bullet.prototype.draw = function(ctx) {
    ctx.shadowBlur = 20 * this.scale;
    ctx.shadowColor = this.shadowColor;
    ctx.fillStyle = this.color;
    ctx.fillRect(
        this.x - this.width / 2 * this.scale,
        this.y - this.height / 2 * this.scale,
        this.width * this.scale,
        this.height * this.scale);
    ctx.shadowBlur = 0;
};

Bullet.prototype.logic = function(elapsed) {
    this.x += this.vx * elapsed;
    this.y += this.vy * elapsed;

    let widthMargin = this.width;
    let heightMargin = this.height;
    if( this.x < -widthMargin ||
        this.x > canvasMaxWidth + widthMargin ||
        this.y < -heightMargin ||
        this.y > canvasMaxHeight + heightMargin) {
        this.active = false;
    }

    if(this.owner === PLAYER) {
        for(let i = 0; i < enemies.length; i++) {
            let xDiff = Math.abs(enemies[i].x - this.x);
            let yDiff = Math.abs(enemies[i].y - this.y);
            if(xDiff <= (enemies[i].width / 2 * enemies[i].scale + this.width / 2 * this.scale) &&
                yDiff <= (enemies[i].height / 2 *enemies[i].scale + this.height / 2 * this.scale)) {
                enemies[i].active = false;
                this.active = false;
                break;
            }
        }
    } else if (this.owner === ENEMY) {
        let xDiff = Math.abs(player.x - this.x);
        let yDiff = Math.abs(player.y - this.y);
        if(xDiff <= (player.width / 2 * player.scale + this.width / 2 * this.scale) &&
            yDiff <= (player.height / 2 * player.scale + this.height / 2 * this.scale)) {
            // lose a life?
            this.active = false;
        }
    }
};

function Player(xPos, yPos) {
    this.vx = 0;
    this.vy = 0;
    this.friction = 0.995;
    this.maxVx = 2;
    this.maxVy = 2;
    this.acceleration = 0.005;
    this.fireRate = 0;
    this.elapsedUntilNextFire = 0;

    this.x = xPos;
    this.y = yPos;
    this.scale = 1;
    this.width = 20;
    this.height = 20;
}

Player.prototype.draw = function(ctx) {
    ctx.fillStyle = "#00CCCC";
    ctx.fillRect(
        this.x - this.width / 2 * this.scale,
        this.y - this.height / 2 * this.scale,
        this.width * this.scale,
        this.height * this.scale);
};

Player.prototype.logic = function(elapsed) {
    this.elapsedUntilNextFire -= elapsed;
    // Player fires bullet
    if(input.space && this.elapsedUntilNextFire <= 0) {
        for(let i = 0; i < numOfPlayerBullets; i++) {
            if(!playerBullets[i].active) {
                playerBullets[i].init(
                    "#FFFF00",
                    "#FF8800",
                    this.x,
                    this.y - this.width / 2 * this.scale,
                    this.scale,
                    this.vx,
                    this.vy);
                this.elapsedUntilNextFire = this.fireRate;
                break;
            }
        }
    }

    // Friction will slow the player down w/o input.
    this.vx *= Math.pow(this.friction, elapsed);
    this.vy *= Math.pow(this.friction, elapsed);

    // Arrow keys affect forward/left/right/backward velocity.
    if(input.left && !input.right) {
        this.vx += (-this.maxVx - this.vx) * this.acceleration * elapsed;
    }
    if(input.right && !input.left) {
        this.vx += (this.maxVx - this.vx) * this.acceleration * elapsed;
    }
    if(input.forward && !input.backward) {
        this.vy += (-this.maxVy - this.vy) * this.acceleration * elapsed;
    }
    if(input.backward && !input.forward) {
        this.vy += (this.maxVy - this.vy) * this.acceleration * elapsed;
    }

    // Velocity affects position.
    this.x += this.vx * elapsed;
    this.y += this.vy * elapsed;

    let widthMargin = this.width / 2 * this.scale;
    let heightMargin = this.height / 2 * this.scale;

    // Check if positions are in bounds.
    if(this.x < widthMargin) {
        this.x = widthMargin;
        this.vx *= -1;
    } else if (this.x > canvasMaxWidth - widthMargin) {
        this.x = canvasMaxWidth - widthMargin;
        this.vx *= -1;
    }

    if(this.y < heightMargin) {
        this.y = heightMargin;
        this.vy *= -1;
    } else if (this.y > canvasMaxHeight - heightMargin) {
        this.y = canvasMaxHeight - heightMargin;
        this.vy *= -1;
    }
};

window.addEventListener("keydown", function(event) {
    let key = event.key;
    if(parseInputKey(key, 1)) {
        event.preventDefault();
    }
});

window.addEventListener("keyup", function(event) {
    let key = event.key;
    if(parseInputKey(key, 0)) {
        event.preventDefault();
    }
});

function parseInputKey(key, value) {
    switch(key) {
        case "w":
        case "W":
            input.forward = value;
            break;
        case "a":
        case "A":
            input.left = value;
            break;
        case "s":
        case "S":
            input.backward = value;
            break;
        case "d":
        case "D":
            input.right = value;
            break;
        case "f":
        case "F":
            input.interact = value;
            break;
        case " ":
            input.space = value;
            break;
        case "Shift":
            input.shift = value;
            break;
        default:
            return false;
    }
    return true;
}

function resizeActiveCanvas() {
    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;

    let xRatio = canvasMaxWidth / screenWidth;
    let yRatio = canvasMaxHeight / screenHeight;

    let canvasWidth;
    let canvasHeight;

    if(xRatio < 1 && yRatio < 1) {
        canvasWidth = canvasMaxWidth;
        canvasHeight = canvasMaxHeight;
    } else {
        if(xRatio > yRatio) {
            // x is limited
            canvasWidth = screenWidth;
            canvasHeight = canvasMaxHeight / xRatio;
        } else {
            // y is limited
            canvasHeight = screenHeight;
            canvasWidth = canvasMaxWidth / yRatio;
        }
    }
    activeCanvas.style.width = canvasWidth + "px";
    activeCanvas.style.height = canvasHeight + "px";
    activeCanvas.style.left = ((screenWidth - canvasWidth) / 2) + "px";
    activeCanvas.style.top = ((screenHeight - canvasHeight) / 2) + "px";
    console.log(canvasWidth + " " + canvasHeight);
}


/// Get the polar distance and angle between two points.
/// Distance is [0] returned item.
/// Angle is [1] returned item.
function polarDistanceAndAngle(x1, y1, x2, y2) {
    let dX = x2 - x1;
    let dY = y2 - y1;

    let distance = Math.sqrt(dX * dX + dY * dY);
    let angle = Math.atan2(dY, dX);
    return [distance, angle];
}

function polarToRect(r, angle) {
    return [
        r * Math.cos(angle),
        r * Math.sin(angle)
    ];
}

/// Change the cursor to newCursor if it isn't already set to it.
function setCursorTo(newCursor) {
    if(activeCanvas.style.cursor !== newCursor) {
        activeCanvas.style.cursor = newCursor;
    }
}

/// Get the physical dimensions of the provided text if it was to be displayed on-screen.
/// We use this to center align text in different ways.
/// This uses a hidden "test" div to measure the width. Credit to that method is in the CSS file.
/// However, this is expensive, so we keep track of measure text to only measure it once.
/// That is, the text "Blue" will always have the same dimensions, we only need to expensively measure it once.
/// Returns an array [textWidth, textHeight].
function getTextDimensions(text) {
    let dimensions = textDimensions[text];
    if(dimensions == undefined) {
        let tester = document.getElementById("textWidthTester");
        tester.innerText = text;
        dimensions = [tester.clientWidth + 1, tester.clientHeight + 1];
        textDimensions[text] =  dimensions;
    }
    return dimensions;
}