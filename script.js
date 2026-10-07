const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;

const canvas = document.querySelector("#sequence-canvas");
if (canvas) {
  const context = canvas.getContext("2d", { alpha: false });
  const logicalFrameCount = 240;
  const frameStep = isMobile ? 3 : 1;
  const frameRoot = isMobile ? "./frames-mobile" : "./frames-webp";
  const maxCachedFrames = isMobile ? 10 : 18;
  const maxConcurrentLoads = isMobile ? 2 : 4;

  const images = new Map();
  const queuedFrames = [];
  const queuedSet = new Set();
  const loadingSet = new Set();
  let currentFrame = 0;
  let targetFrame = 0;
  let renderedFrame = -1;
  let frameWidth = 1280;
  let frameHeight = 720;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let rafId = 0;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function actualFrameIndex(index) {
    return clamp(Math.round(index / frameStep) * frameStep, 0, logicalFrameCount - 1);
  }

  function framePath(index) {
    return `${frameRoot}/frame_${String(index).padStart(5, "0")}.webp`;
  }

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);
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
    const requestedIndex = actualFrameIndex(frameIndex);
    let image = images.get(requestedIndex);

    if (!image) {
      for (let distance = frameStep; distance < maxCachedFrames * frameStep; distance += frameStep) {
        image = images.get(actualFrameIndex(requestedIndex - distance)) || images.get(actualFrameIndex(requestedIndex + distance));
        if (image) break;
      }
    }

    if (!image || renderedFrame === requestedIndex) return;
    renderedFrame = requestedIndex;
    drawCover(image);
  }

  function evictDistantFrames(centerIndex) {
    for (const [index, image] of images) {
      if (Math.abs(index - centerIndex) <= maxCachedFrames * frameStep || index === actualFrameIndex(currentFrame)) continue;
      image.src = "";
      images.delete(index);
    }
  }

  function pumpFrameQueue() {
    while (loadingSet.size < maxConcurrentLoads && queuedFrames.length) {
      const index = queuedFrames.shift();
      queuedSet.delete(index);
      if (images.has(index) || loadingSet.has(index)) continue;

      loadingSet.add(index);
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        loadingSet.delete(index);
        images.set(index, image);
        if (index === 0) {
          frameWidth = image.naturalWidth;
          frameHeight = image.naturalHeight;
          resizeCanvas();
        }
        renderFrame(Math.round(currentFrame));
        evictDistantFrames(Math.round(targetFrame));
        pumpFrameQueue();
      };
      image.onerror = () => {
        loadingSet.delete(index);
        pumpFrameQueue();
      };
      image.src = framePath(index);
    }
  }

  function queueFrame(index) {
    const actualIndex = actualFrameIndex(index);
    if (images.has(actualIndex) || loadingSet.has(actualIndex) || queuedSet.has(actualIndex)) return;
    queuedSet.add(actualIndex);
    queuedFrames.push(actualIndex);
  }

  function queueFramesAround(index) {
    const center = actualFrameIndex(index);
    const behind = isMobile ? 1 : 3;
    const ahead = isMobile ? 8 : 14;

    queueFrame(center);
    for (let offset = 1; offset <= ahead; offset += 1) queueFrame(center + offset * frameStep);
    for (let offset = 1; offset <= behind; offset += 1) queueFrame(center - offset * frameStep);
    pumpFrameQueue();
  }

  function updateTargetFrame() {
    const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableDistance > 0 ? window.scrollY / scrollableDistance : 0;
    targetFrame = clamp(progress, 0, 1) * (logicalFrameCount - 1);
    queueFramesAround(targetFrame);
    if (!rafId) rafId = requestAnimationFrame(animate);
  }

  function animate() {
    const distance = targetFrame - currentFrame;
    currentFrame += distance * 0.14;

    if (Math.abs(distance) < 0.02) currentFrame = targetFrame;
    renderFrame(Math.round(currentFrame));
    rafId = Math.abs(targetFrame - currentFrame) > 0.02 ? requestAnimationFrame(animate) : 0;
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  window.addEventListener("scroll", updateTargetFrame, { passive: true });

  if (!prefersReducedMotion) {
    resizeCanvas();
    queueFramesAround(0);
    updateTargetFrame();
  }
}

const revealItems = document.querySelectorAll(
  "main section, .about-content, .service-row, .tool-badge, .project-card, .contact-content, .booking-card, .site-footer, .feature-card, .process-row, .case-meta-bar, .case-hero-art, .case-content-grid, .faq-item, .cta-banner, .legal-content, .footer-mega"
);

revealItems.forEach((item, index) => {
  item.classList.add("reveal");
  item.style.setProperty("--reveal-delay", `${Math.min(index % 7, 6) * 55}ms`);
});

if (prefersReducedMotion) {
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

// Mobile menu toggle
const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
const mobileNavOverlay = document.querySelector(".mobile-nav-overlay");
if (mobileMenuBtn && mobileNavOverlay) {
  mobileMenuBtn.addEventListener("click", () => {
    const isExpanded = mobileMenuBtn.getAttribute("aria-expanded") === "true";
    mobileMenuBtn.setAttribute("aria-expanded", String(!isExpanded));
    mobileNavOverlay.classList.toggle("is-open", !isExpanded);
    document.body.classList.toggle("menu-open", !isExpanded);
  });
  mobileNavOverlay.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenuBtn.setAttribute("aria-expanded", "false");
      mobileNavOverlay.classList.remove("is-open");
      document.body.classList.remove("menu-open");
    });
  });
}

// Smooth anchor scrolling
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  });
});

// Native Inquiry Form Handling (Phase 4B)
const inquiryForm = document.querySelector("#inquiry-form");
if (inquiryForm && !inquiryForm.dataset.inlineBound) {
  const submitBtn = inquiryForm.querySelector("#inquiry-submit-btn");
  const statusBox = inquiryForm.querySelector("#form-status");

  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = inquiryForm.querySelector("#contact-name");
    const emailInput = inquiryForm.querySelector("#contact-email");
    const whatsappInput = inquiryForm.querySelector("#contact-whatsapp");
    const detailsInput = inquiryForm.querySelector("#contact-details");
    const sourceUrlInput = inquiryForm.querySelector("#form-source-url");
    const submittedAtInput = inquiryForm.querySelector("#form-submitted-at");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const whatsapp = whatsappInput ? whatsappInput.value.trim() : "";
    const projectDetails = detailsInput ? detailsInput.value.trim() : "";

    // Validation
    if (!name || !email || !projectDetails) {
      if (statusBox) {
        statusBox.className = "form-status form-error";
        statusBox.textContent = "Please fill in all required fields (Name, Email, and Project Details).";
      }
      if (!name && nameInput) nameInput.focus();
      else if (!email && emailInput) emailInput.focus();
      else if (!projectDetails && detailsInput) detailsInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (statusBox) {
        statusBox.className = "form-status form-error";
        statusBox.textContent = "Please provide a valid email address.";
      }
      if (emailInput) emailInput.focus();
      return;
    }

    const submittedAt = new Date().toISOString();
    const sourceUrl = window.location.href;
    if (sourceUrlInput) sourceUrlInput.value = sourceUrl;
    if (submittedAtInput) submittedAtInput.value = submittedAt;

    // Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.innerHTML = "<span>Sending Enquiry...</span>";
    }
    if (statusBox) {
      statusBox.className = "form-status";
      statusBox.textContent = "";
    }

    const payload = {
      name,
      email,
      whatsapp: whatsapp || "Not provided",
      projectDetails,
      sourceUrl,
      submittedAt
    };

    const webhookUrl = "https://connect.pabbly.com/webhook-listener/webhook/IjU3NjMwNTZmMDYzMDA0M2M1MjZkNTUzNCI_3D_pc/IjU3NjcwNTY4MDYzZTA0MzM1MjZjNTUzMjUxMzUi_pc";
    let delivered = false;

    // Strategy 1: URLSearchParams fetch
    try {
      const bodyParams = new URLSearchParams(payload);
      const res = await fetch(webhookUrl, {
        method: "POST",
        body: bodyParams
      });
      if (res.ok || res.status === 200 || res.status === 201) {
        delivered = true;
      }
    } catch (err) {
      console.warn("URLSearchParams fetch error:", err);
    }

    // Strategy 2: JSON fetch
    if (!delivered) {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok || res.status === 200 || res.status === 201) {
          delivered = true;
        }
      } catch (err) {
        console.warn("JSON fetch error:", err);
      }
    }

    // Strategy 3: no-cors fetch
    if (!delivered) {
      try {
        const bodyParams = new URLSearchParams(payload);
        await fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          body: bodyParams
        });
        delivered = true;
      } catch (err) {
        console.warn("no-cors fetch error:", err);
      }
    }

    // Strategy 4: Iframe fallback
    if (!delivered) {
      try {
        inquiryForm.target = "pabbly-target-frame";
        inquiryForm.action = webhookUrl;
        inquiryForm.method = "POST";
        inquiryForm.submit();
        delivered = true;
      } catch (err) {
        console.error("Iframe submit error:", err);
      }
    }

    if (delivered) {
      inquiryForm.reset();
      if (statusBox) {
        statusBox.className = "form-status form-success";
        statusBox.textContent = "Thanks! Your enquiry has been received. I'll get back to you soon.";
        try {
          statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (e) {}
      }
    } else {
      if (statusBox) {
        statusBox.className = "form-status form-error";
        statusBox.innerHTML = 'Something went wrong. Please try again or contact me directly by email at <a href="mailto:mrswar4264pass@gmail.com">mrswar4264pass@gmail.com</a>.';
      }
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("is-loading");
      submitBtn.innerHTML = "<span>Send My Enquiry</span> <span>↗</span>";
    }
  });
}

