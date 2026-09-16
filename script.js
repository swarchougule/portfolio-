const canvas = document.querySelector("#sequence-canvas");
const context = canvas.getContext("2d", { alpha: false });
const frameCount = 240;
const framePath = (index) => `./frames/frame_${String(index).padStart(5, "0")}.png`;

const images = new Array(frameCount);
let currentFrame = 0;
let targetFrame = 0;
let renderedFrame = -1;
let frameWidth = 1;
let frameHeight = 1;
let viewportWidth = 1;
let viewportHeight = 1;
let rafId = 0;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  canvas.width = Math.round(viewportWidth * ratio);
  canvas.height = Math.round(viewportHeight * ratio);
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  renderedFrame = -1;
  renderFrame(Math.round(currentFrame));
}

function drawCover(image) {
  const scale = Math.max(viewportWidth / frameWidth, viewportHeight / frameHeight);
  const drawWidth = frameWidth * scale;
  const drawHeight = frameHeight * scale;
  const offsetX = (viewportWidth - drawWidth) / 2;
  const offsetY = (viewportHeight - drawHeight) / 2;

  context.fillStyle = "#080203";
  context.fillRect(0, 0, viewportWidth, viewportHeight);
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function renderFrame(frameIndex) {
  const image = images[frameIndex];
  if (!image || !image.complete) return;

  if (renderedFrame === frameIndex) return;
  renderedFrame = frameIndex;
  drawCover(image);
}

function updateTargetFrame() {
  const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableDistance > 0 ? window.scrollY / scrollableDistance : 0;
  targetFrame = clamp(progress, 0, 1) * (frameCount - 1);
  if (!rafId) rafId = requestAnimationFrame(animate);
}

function animate() {
  const distance = targetFrame - currentFrame;
  currentFrame += distance * 0.14;

  if (Math.abs(distance) < 0.02) {
    currentFrame = targetFrame;
  }

  renderFrame(Math.round(currentFrame));
  rafId = Math.abs(targetFrame - currentFrame) > 0.02
    ? requestAnimationFrame(animate)
    : 0;
}

function loadFrame(index) {
  const image = new Image();
  image.decoding = "async";
  image.src = framePath(index);
  image.onload = () => {
    images[index] = image;
    if (index === 0) {
      frameWidth = image.naturalWidth;
      frameHeight = image.naturalHeight;
      resizeCanvas();
    }
    if (index === Math.round(currentFrame)) renderFrame(index);
  };
}

window.addEventListener("resize", resizeCanvas, { passive: true });
window.addEventListener("scroll", updateTargetFrame, { passive: true });

for (let index = 0; index < frameCount; index += 1) {
  loadFrame(index);
}

resizeCanvas();
updateTargetFrame();

const revealItems = document.querySelectorAll(
  "main section, .about-content, .service-row, .tool-badge, .project-card, .contact-content, .booking-card, .site-footer"
);

revealItems.forEach((item, index) => {
  item.classList.add("reveal");
  item.style.setProperty("--reveal-delay", `${Math.min(index % 7, 6) * 55}ms`);
});

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px" });

  revealItems.forEach((item) => revealObserver.observe(item));
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
