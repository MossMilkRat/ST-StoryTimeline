// index.js

// Grab the ST context via its global API
const ctx = (typeof window !== "undefined" && window.SillyTavern && typeof window.SillyTavern.getContext === "function")
  ? window.SillyTavern.getContext()
  : null;

if (!ctx) {
  console.error("Story Timeline Viewer: Failed to get SillyTavern context (getContext returned null)");
} else {
  const MODULE_KEY = "storyTimeline";

  function getSettings() {
    const { extensionSettings } = ctx;
    if (!extensionSettings[MODULE_KEY]) {
      extensionSettings[MODULE_KEY] = { enabled: true };
    }
    return extensionSettings[MODULE_KEY];
  }

  // If you still want to parse string times
  function parseTimeString(str) {
    const m = str.match(/day\s*(\d+),\s*(\d+):(\d+)/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const h = parseInt(m[2], 10);
      const min = parseInt(m[3], 10);
      return day * 24 * 60 + h * 60 + min;
    }
    // fallback
    return null;
  }

  function parseStoryTime(msg) {
    const meta = msg.metadata || {};
    if (meta.storyTime != null) {
      if (typeof meta.storyTime === "string") {
        const parsed = parseTimeString(meta.storyTime);
        if (parsed != null) return parsed;
      }
      // if numeric already
      if (typeof meta.storyTime === "number") {
        return meta.storyTime;
      }
    }
    return null;
  }

  function buildTimeline() {
    const chat = ctx.chat || [];
    const timeline = [];

    chat.forEach((msg, idx) => {
      const storyTime = parseStoryTime(msg);
      if (storyTime !== null) {
        timeline.push({ idx, storyTime, excerpt: msg.message });
      }
    });

    timeline.sort((a, b) => {
      if (a.storyTime < b.storyTime) return -1;
      if (a.storyTime > b.storyTime) return +1;
      return a.idx - b.idx;
    });

    return timeline;
  }

  function showTimelineUI() {
    const settings = getSettings();
    if (!settings.enabled) return;

    const timeline = buildTimeline();

    const old = document.getElementById("story-timeline-panel");
    if (old) old.remove();

    const container = document.createElement("div");
    container.id = "story-timeline-panel";
    container.className = "story-timeline";

    let html = `<h3>Story Timeline</h3><ul>`;
    timeline.forEach(item => {
      html += `<li><strong>${item.storyTime}:</strong> ${item.excerpt.substring(0,50)}... (msg #${item.idx})</li>`;
    });
    html += `</ul>`;

    container.innerHTML = html;
    document.body.appendChild(container);
  }

  function addButton() {
    const btn = document.createElement("button");
    btn.id = "story-timeline-button";
    btn.textContent = "Show Story Timeline";
    btn.style.position = "fixed";
    btn.style.right = "20px";
    btn.style.top = "20px";
    btn.style.zIndex = 10000;
    btn.onclick = showTimelineUI;
    document.body.appendChild(btn);
  }

  function init() {
    const settings = getSettings();
    if (!settings.enabled) return;

    // Safe bind when chat changes
    if (ctx.events && typeof ctx.events.on === "function") {
      ctx.events.on("CHAT_CHANGED", () => {
        showTimelineUI();
      });
    } else {
      console.warn("Story Timeline Viewer: ctx.events.on not available, cannot auto‐refresh timeline");
    }

    addButton();
  }

  try {
    init();
    console.log("Story Timeline Viewer loaded successfully");
  } catch (err) {
    console.error("Story Timeline Viewer: initialization error", err);
  }
}
