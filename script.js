"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const input = document.getElementById("photoInput");
const button = document.getElementById("revealButton");
const welcome = document.getElementById("welcome");
const statusText = document.getElementById("status");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const portrait = document.createElement("canvas");
const portraitCtx = portrait.getContext("2d", {
  willReadFrequently: true
});

let particles = [];
let width = 0;
let height = 0;
let imageWidth = 0;
let imageHeight = 0;

let loaded = false;
let busy = false;
let reveal = 0;
let revealTarget = 0;
let introStart = 0;

let mouseX = 0;
let mouseY = 0;
let rotation = 0;
let tilt = 0;
let pointerUsed = false;
let previousTime = 0;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value) {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;

  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

window.addEventListener("resize", resize);
resize();

window.addEventListener("pointermove", (event) => {
  mouseX = (event.clientX / width - 0.5) * 2;
  mouseY = (event.clientY / height - 0.5) * 2;
  pointerUsed = true;
});

document.documentElement.addEventListener("pointerleave", () => {
  mouseX = 0;
  mouseY = 0;
});

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(
      new Error("The selected file could not be read.")
    );

    reader.onload = () => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(
        new Error("Please choose a supported JPG, PNG or WebP image.")
      );

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function makeParticles(image) {
  // Keep processing manageable on phones.
  const ratio = Math.min(
    1,
    720 / Math.max(image.naturalWidth, image.naturalHeight)
  );

  imageWidth = Math.max(1, Math.round(image.naturalWidth * ratio));
  imageHeight = Math.max(1, Math.round(image.naturalHeight * ratio));

  portrait.width = imageWidth;
  portrait.height = imageHeight;

  portraitCtx.clearRect(0, 0, imageWidth, imageHeight);
  portraitCtx.drawImage(image, 0, 0, imageWidth, imageHeight);

  const pixels = portraitCtx.getImageData(
    0, 0, imageWidth, imageHeight
  ).data;

  particles = [];

  for (let y = 0; y < imageHeight; y += 3) {
    for (let x = 0; x < imageWidth; x += 3) {
      const index = (y * imageWidth + x) * 4;

      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      const brightness = (
        red * 0.2126 +
        green * 0.7152 +
        blue * 0.0722
      ) / 255;

      // Ignore transparent pixels and nearly black backgrounds.
      if (alpha < 30 || brightness < 0.035) continue;

      const normalizedX = x / imageWidth - 0.5;
      const normalizedY = y / imageHeight - 0.5;

      // Artistic depth for gentle cursor rotation.
      const depth = Math.sqrt(
        Math.max(0, 1 - normalizedX * normalizedX * 4)
      ) * 0.12;

      particles.push({
        x: normalizedX,
        y: normalizedY,
        depth,
        brightness,
        red,
        green,
        blue,
        seed: Math.random()
      });
    }
  }
}

input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    statusText.textContent = "Please select an image file.";
    return;
  }

  input.disabled = true;
  button.disabled = true;
  statusText.textContent = "Preparing your portrait…";

  try {
    const image = await loadImage(file);
    makeParticles(image);

    loaded = true;
    busy = false;
    reveal = 0;
    revealTarget = 0;
    rotation = 0;
    tilt = 0;
    introStart = performance.now();

    welcome.hidden = true;
    button.textContent = "Reveal →";
    document.body.classList.remove("revealed");

    statusText.textContent = "Move your pointer to explore.";
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    input.disabled = false;
    button.disabled = !loaded;
    input.value = "";
  }
});

button.addEventListener("click", () => {
  if (!loaded || busy) return;

  revealTarget = revealTarget === 0 ? 1 : 0;
  busy = true;
  button.disabled = true;

  document.body.classList.toggle(
    "revealed",
    revealTarget === 1
  );

  statusText.textContent = "";
});

function drawPhoto(left, top, drawWidth, drawHeight) {
  if (reveal <= 0) return;

  // Once revealed, draw the complete stationary image.
  if (reveal >= 1) {
    ctx.drawImage(
      portrait, left, top, drawWidth, drawHeight
    );
    return;
  }

  const cell = Math.max(7, drawWidth / 100);
  const band = reveal * 1.15 - 0.075;

  ctx.save();
  ctx.beginPath();

  for (let y = cell / 2; y < drawHeight; y += cell) {
    const progress = smoothstep(
      (band - y / drawHeight + 0.07) / 0.14
    );

    if (progress <= 0) continue;

    const radius = cell * 0.74 * progress;

    for (let x = cell / 2; x < drawWidth; x += cell) {
      ctx.moveTo(left + x + radius, top + y);
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
    portrait, left, top, drawWidth, drawHeight
  );
  ctx.restore();
}

function animate(now) {
  requestAnimationFrame(animate);

  const delta = previousTime
    ? Math.min((now - previousTime) / 1000, 0.05)
    : 0;

  previousTime = now;
  ctx.clearRect(0, 0, width, height);

  if (!loaded) return;

  const intro = reducedMotion
    ? 1
    : clamp((now - introStart) / 1800);

  const moving = !busy && reveal === 0 && !reducedMotion;

  const desiredRotation = moving
    ? (pointerUsed ? mouseX * 0.32 : Math.sin(now / 2200) * 0.08)
    : 0;

  const desiredTilt = moving ? mouseY * 0.045 : 0;
  const easing = 1 - Math.exp(-delta * 7);

  rotation += (desiredRotation - rotation) * easing;
  tilt += (desiredTilt - tilt) * easing;

  if (busy) {
    const centered = Math.abs(rotation) < 0.015;

    if (revealTarget === 0 || centered || reducedMotion) {
      if (reducedMotion) {
        reveal = revealTarget;
      } else {
        const direction = revealTarget > reveal ? 1 : -1;
        reveal = clamp(reveal + direction * delta / 3.6);
      }

      if (Math.abs(reveal - revealTarget) < 0.001) {
        reveal = revealTarget;
        busy = false;
        button.disabled = false;

        button.textContent = reveal === 1
          ? "← Back to dots"
          : "Reveal →";

        statusText.textContent = reveal === 0
          ? "Move your pointer to explore."
          : "";
      }
    }
  }

  if (reveal === 1) {
    rotation = 0;
    tilt = 0;
  }

  // Keep the portrait above the controls on all screen sizes.
  const availableHeight = Math.max(120, height - 125);
  const scale = Math.min(
    width * 0.9 / imageWidth,
    availableHeight / imageHeight
  );

  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;

  const left = (width - drawWidth) / 2;
  const top = (availableHeight - drawHeight) / 2 + 15;

  const centerX = left + drawWidth / 2;
  const centerY = top + drawHeight / 2;

  drawPhoto(left, top, drawWidth, drawHeight);

  if (reveal === 1) return;

  const band = reveal * 1.15 - 0.075;

  ctx.globalCompositeOperation = "lighter";

  for (const particle of particles) {
    const photoY = particle.y + 0.5;

    const transformed = reveal === 0
      ? 0
      : smoothstep((band - photoY + 0.07) / 0.14);

    const opacity = 1 - transformed;
    if (opacity < 0.01) continue;

    const progress = smoothstep(
      (intro - particle.seed * 0.2) / 0.8
    );

    const angle = particle.seed * Math.PI * 2;
    const ringX = Math.cos(angle) * 42;
    const ringY = Math.sin(angle) * 42;

    const turnedX =
      particle.x * Math.cos(rotation) +
      particle.depth * Math.sin(rotation);

    const finalX = turnedX * drawWidth;
    const finalY =
      particle.y * drawHeight +
      tilt * particle.depth * drawHeight;

    const x = centerX + ringX * (1 - progress) + finalX * progress;
    const y = centerY + ringY * (1 - progress) + finalY * progress;

    const glow =
      0.35 +
      particle.brightness * 0.65;

    const mix = transformed;

    const red = Math.round(190 * (1 - mix) + particle.red * mix);
    const green = Math.round(12 * (1 - mix) + particle.green * mix);
    const blue = Math.round(43 * (1 - mix) + particle.blue * mix);

    ctx.fillStyle =
      `rgba(${red},${green},${blue},${opacity * glow})`;

    const radius = Math.max(
      0.55,
      Math.min(1.6, scale * (0.65 + particle.seed * 0.65))
    );

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

requestAnimationFrame(animate);