"use strict";

// Keep your portrait beside index.html with this filename.
const PHOTO_PATH = "Centered Blue Suit Portrait.png";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const button = document.getElementById("revealButton");
const buttonText = document.getElementById("buttonText");
const loader = document.getElementById("loader");
const statusText = document.getElementById("status");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const portrait = document.createElement("canvas");

const portraitCtx = portrait.getContext("2d", {
  willReadFrequently: true
});

let width = 0;
let height = 0;

let imageWidth = 0;
let imageHeight = 0;

let particles = [];
let dust = [];

let loaded = false;
let state = "loading";

let reveal = 0;
let introStart = 0;

let rotation = 0;
let tilt = 0;

let mouseX = 0;
let mouseY = 0;
let pointerUsed = false;

let previousTime = 0;
let frameRequested = false;
let layout = {};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function requestFrame() {
  if (frameRequested) return;

  frameRequested = true;
  requestAnimationFrame(animate);
}

function updateLayout() {
  if (!imageWidth || !imageHeight) return;

  const availableHeight = Math.max(100, height - 115);

  const scale = Math.min(
    width * 0.94 / imageWidth,
    availableHeight / imageHeight
  );

  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  const left = (width - drawWidth) / 2;
  const top = (availableHeight - drawHeight) / 2 + 12;

  layout = {
    scale,
    drawWidth,
    drawHeight,
    left,
    top,
    centerX: left + drawWidth / 2,
    centerY: top + drawHeight / 2
  };
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;

  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  ctx.setTransform(
    pixelRatio, 0,
    0, pixelRatio,
    0, 0
  );

  updateLayout();
  requestFrame();
}

window.addEventListener("resize", resize);

window.addEventListener("pointermove", (event) => {
  mouseX = (event.clientX / width - 0.5) * 2;
  mouseY = (event.clientY / height - 0.5) * 2;

  pointerUsed = true;

  if (state === "dots") requestFrame();
});

document.documentElement.addEventListener(
  "pointerleave",
  () => {
    mouseX = 0;
    mouseY = 0;
  }
);

document.addEventListener("visibilitychange", () => {
  previousTime = 0;

  if (!document.hidden) requestFrame();
});

function preparePortrait(image) {
  const processingScale = Math.min(
    1,
    760 / Math.max(
      image.naturalWidth,
      image.naturalHeight
    )
  );

  imageWidth = Math.max(
    1,
    Math.round(image.naturalWidth * processingScale)
  );

  imageHeight = Math.max(
    1,
    Math.round(image.naturalHeight * processingScale)
  );

  portrait.width = imageWidth;
  portrait.height = imageHeight;

  portraitCtx.drawImage(
    image,
    0,
    0,
    imageWidth,
    imageHeight
  );

  const imageData = portraitCtx.getImageData(
    0,
    0,
    imageWidth,
    imageHeight
  );

  const pixels = imageData.data;

  // Soften the nearly black studio background.
  // A black-background portrait works best.
  for (let i = 0; i < pixels.length; i += 4) {
    const maximum = Math.max(
      pixels[i],
      pixels[i + 1],
      pixels[i + 2]
    );

    const backgroundAlpha = smoothstep(
      (maximum - 5) / 23
    );

    pixels[i + 3] = Math.round(
      pixels[i + 3] * backgroundAlpha
    );
  }

  portraitCtx.putImageData(imageData, 0, 0);

  particles = [];

  const step = window.innerWidth < 600 ? 4 : 3;

  for (let y = 0; y < imageHeight; y += step) {
    for (let x = 0; x < imageWidth; x += step) {
      const i = (y * imageWidth + x) * 4;

      const red = pixels[i];
      const green = pixels[i + 1];
      const blue = pixels[i + 2];
      const alpha = pixels[i + 3] / 255;

      if (alpha < 0.08) continue;

      const brightness = (
        red * 0.2126 +
        green * 0.7152 +
        blue * 0.0722
      ) / 255;

      const normalizedX = x / imageWidth - 0.5;
      const normalizedY = y / imageHeight - 0.5;

      // Approximate surface depth for subtle movement.
      const depth = Math.sqrt(
        Math.max(
          0,
          1 - normalizedX * normalizedX * 4
        )
      ) * 0.1;

      particles.push({
        x: normalizedX,
        y: normalizedY,
        depth,
        brightness,
        alpha,
        red,
        green,
        blue,
        seed: Math.random()
      });
    }
  }

  dust = Array.from({ length: 65 }, () => ({
    x: Math.random(),
    y: Math.random(),
    radius: Math.random() * 1.1 + 0.25,
    speed: Math.random() * 0.012 + 0.003,
    alpha: Math.random() * 0.16 + 0.04
  }));

  updateLayout();
}

function showError(message) {
  loader.hidden = true;
  button.hidden = true;
  statusText.textContent = message;
  state = "error";
}

function loadPortrait() {
  const image = new Image();

  image.onload = () => {
    try {
      preparePortrait(image);

      loaded = true;
      state = reducedMotion ? "dots" : "intro";
      introStart = performance.now();

      loader.hidden = true;
      button.disabled = !reducedMotion;
      statusText.textContent = "";

      requestFrame();
    } catch (error) {
      console.error(error);

      showError(
        "Open index.html using Live Server in VS Code. " +
        "The browser blocked access to the local image pixels."
      );
    }
  };

  image.onerror = () => {
    showError(
      "Photo not found. Put photo.png in the same folder " +
      "as index.html, style.css and script.js."
    );
  };

  image.src = PHOTO_PATH;
}

button.addEventListener("click", () => {
  if (state !== "dots" && state !== "photo") return;

  button.disabled = true;

  if (state === "dots") {
    document.body.classList.add("revealed");

    if (reducedMotion) {
      reveal = 1;
      finishTransition("photo");
    } else {
      state = "centering";
    }
  } else {
    document.body.classList.remove("revealed");

    if (reducedMotion) {
      reveal = 0;
      finishTransition("dots");
    } else {
      state = "reverse";
    }
  }

  previousTime = 0;
  requestFrame();
});

function finishTransition(nextState) {
  state = nextState;
  button.disabled = false;

  const photoVisible = nextState === "photo";

  buttonText.textContent = photoVisible
    ? "Back to dots"
    : "Reveal";

  button.setAttribute(
    "aria-pressed",
    String(photoVisible)
  );
}

function drawDust(time) {
  if (reducedMotion || reveal >= 1) return;

  ctx.save();

  for (const item of dust) {
    const y = (
      (item.y - time * item.speed) % 1 + 1
    ) % 1;

    ctx.globalAlpha = item.alpha * (1 - reveal);
    ctx.fillStyle = "#d76b89";

    ctx.beginPath();
    ctx.arc(
      item.x * width,
      y * height,
      item.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

function drawPhoto() {
  if (reveal <= 0) return;

  const {
    left,
    top,
    drawWidth,
    drawHeight
  } = layout;

  if (reveal >= 1) {
    ctx.drawImage(
      portrait,
      left,
      top,
      drawWidth,
      drawHeight
    );

    return;
  }

  const cell = Math.max(7, drawWidth / 110);
  const band = reveal * 1.2 - 0.1;

  ctx.save();
  ctx.beginPath();

  for (let y = cell / 2; y < drawHeight; y += cell) {
    const amount = smoothstep(
      (band - y / drawHeight + 0.08) / 0.16
    );

    if (amount <= 0) continue;

    const radius = cell * 0.74 * amount;

    for (let x = cell / 2; x < drawWidth; x += cell) {
      ctx.moveTo(
        left + x + radius,
        top + y
      );

      ctx.arc(
        left + x,
        top + y,
        radius,
        0,
        Math.PI * 2
      );
    }
  }

  ctx.clip();

  ctx.drawImage(
    portrait,
    left,
    top,
    drawWidth,
    drawHeight
  );

  ctx.restore();
}

function drawParticles(time, intro) {
  if (reveal >= 1) return;

  const {
    drawWidth,
    drawHeight,
    centerX,
    centerY,
    scale
  } = layout;

  const band = reveal * 1.2 - 0.1;

  const cursorX = width * (mouseX + 1) / 2;
  const cursorY = height * (mouseY + 1) / 2;

  const sweep = clamp((time - 1.9) / 1.3);
  const sweepActive = time > 1.9 && time < 3.2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const point of particles) {
    const photoY = point.y + 0.5;

    const transformed = reveal === 0
      ? 0
      : smoothstep(
          (band - photoY + 0.08) / 0.16
        );

    const opacity = (1 - transformed) * point.alpha;
    if (opacity < 0.01) continue;

    const progress = smoothstep(
      (intro - point.seed * 0.2) / 0.8
    );

    const angle = point.seed * Math.PI * 2;

    const ringX = Math.cos(angle) * 42;
    const ringY = Math.sin(angle) * 42;

    const rotatedX =
      point.x * Math.cos(rotation) +
      point.depth * Math.sin(rotation);

    const surfaceX =
      rotatedX * (1 - transformed) +
      point.x * transformed;

    const finalX = surfaceX * drawWidth;

    const finalY =
      point.y * drawHeight +
      tilt * point.depth * drawHeight *
      (1 - transformed);

    const x =
      centerX +
      ringX * (1 - progress) +
      finalX * progress;

    const y =
      centerY +
      ringY * (1 - progress) +
      finalY * progress;

    const distance = Math.hypot(
      x - cursorX,
      y - cursorY
    );

    const cursorLight =
      state === "dots" && pointerUsed
        ? Math.exp(
            -distance / Math.max(80, width * 0.14)
          ) * 0.3
        : 0;

    const sweepLight = sweepActive
      ? Math.exp(
          -Math.pow((photoY - sweep) * 20, 2)
        ) * 0.45
      : 0;

    const glow = clamp(
      0.28 +
      point.brightness * 0.65 +
      cursorLight +
      sweepLight
    );

    const red = Math.round(
      190 * (1 - transformed) +
      point.red * transformed
    );

    const green = Math.round(
      12 * (1 - transformed) +
      point.green * transformed
    );

    const blue = Math.round(
      43 * (1 - transformed) +
      point.blue * transformed
    );

    ctx.fillStyle =
      `rgba(${red},${green},${blue},${opacity * glow})`;

    const radius = Math.max(
      0.55,
      Math.min(
        1.6,
        scale * (0.65 + point.seed * 0.65)
      )
    );

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function animate(now) {
  frameRequested = false;

  if (!loaded || document.hidden) return;

  const delta = previousTime
    ? Math.min((now - previousTime) / 1000, 0.05)
    : 0;

  previousTime = now;

  const time = (now - introStart) / 1000;
  const intro = reducedMotion ? 1 : clamp(time / 1.9);

  if (state === "intro" && intro >= 1) {
    state = "dots";
    button.disabled = false;
  }

  const moving = state === "dots" && !reducedMotion;

  const targetRotation = moving
    ? (
        pointerUsed
          ? mouseX * 0.32
          : Math.sin(time * 0.45) * 0.08
      )
    : 0;

  const targetTilt = moving
    ? mouseY * 0.045
    : 0;

  const easing = 1 - Math.exp(-delta * 7);

  rotation += (targetRotation - rotation) * easing;
  tilt += (targetTilt - tilt) * easing;

  if (
    state === "centering" &&
    Math.abs(rotation) < 0.01 &&
    Math.abs(tilt) < 0.005
  ) {
    rotation = 0;
    tilt = 0;
    state = "forward";
  }

  if (state === "forward") {
    reveal = clamp(reveal + delta / 3.6);

    if (reveal >= 1) {
      rotation = 0;
      tilt = 0;
      finishTransition("photo");
    }
  }

  if (state === "reverse") {
    reveal = clamp(reveal - delta / 3.6);

    if (reveal <= 0) {
      finishTransition("dots");
    }
  }

  ctx.clearRect(0, 0, width, height);

  drawDust(time);
  drawPhoto();
  drawParticles(time, intro);

  // Stop drawing when the photo is fully revealed.
  // Resize and button interaction restart rendering.
  if (
    state !== "photo" &&
    !(reducedMotion && state === "dots")
  ) {
    requestFrame();
  }
}

if (!ctx || !portraitCtx) {
  showError("Your browser does not support Canvas.");
} else {
  resize();
  loadPortrait();
}