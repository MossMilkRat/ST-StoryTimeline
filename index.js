const context = SillyTavern.getContext();

const MODULE_KEY = "storyTimeline";

function getSettings() {
  const { extensionSettings } = getContext();
  if (!extensionSettings[MODULE_KEY]) {
    extensionSettings[MODULE_KEY] = { enabled: true };
  }
  return extensionSettings[MODULE_KEY];
}

function parseStoryTime(msg) {
  const meta = msg.metadata || {};
  if (meta.storyTime != null) {
    // If it’s a string, try parsing
    if (typeof meta.storyTime === "string") {
      const parsed = parseTimeString(meta.storyTime);
      if (parsed != null) return parsed;
    }
    return meta.storyTime;
  }
  return null;
}

import { parseTimeString } from "./utils/parser.js";

function buildTimeline() {
  const ctx = getContext();
  const chat = ctx.chat;
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
  html += "</ul>";

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
  btn.style.zIndex = 1000;
  btn.onclick = showTimelineUI;
  document.body.appendChild(btn);
}

function init() {
  const settings = getSettings();
  if (!settings.enabled) return;

  const ctx = getContext();
  ctx.events.on("CHAT_CHANGED", () => {
    showTimelineUI();
  });

  addButton();
}

init();
