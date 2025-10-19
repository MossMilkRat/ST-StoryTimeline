// index.js

// Acquire SillyTavern context
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
      extensionSettings[MODULE_KEY] = {
        enabled: true,
        dateFormat: "mm/dd/yyyy",
        timeFormat: "24h",
        dragDropEnabled: false
      };
    }
    return extensionSettings[MODULE_KEY];
  }

  import { parseTimeString } from "./utils/parser.js";

  function parseStoryTime(msg) {
    const meta = msg.metadata || {};
    if (meta.storyTime != null) {
      if (typeof meta.storyTime === "string") {
        const settings = getSettings();
        const val = parseTimeString(meta.storyTime, settings.dateFormat, settings.timeFormat);
        if (val != null) return val;
      }
      if (typeof meta.storyTime === "number") {
        return meta.storyTime;
      }
    }
    if (meta.storyOrder != null) {
      return meta.storyOrder; // fallback ordering by storyOrder if provided
    }
    return null;
  }

  function buildTimeline() {
    const chat = ctx.chat || [];
    const timeline = [];

    chat.forEach((msg, idx) => {
      const st = parseStoryTime(msg);
      if (st !== null) {
        timeline.push({ idx, storyTime: st, excerpt: msg.message });
      }
    });

    timeline.sort((a, b) => {
      if (a.storyTime < b.storyTime) return -1;
      if (a.storyTime > b.storyTime) return +1;
      return a.idx - b.idx;
    });

    return timeline;
  }

  function showTimeline() {
    const settings = getSettings();
    if (!settings.enabled) return;

    if (settings.dragDropEnabled) {
      showDraggableTimeline();
    } else {
      // simple list view
      const old = document.getElementById('story-timeline-panel');
      if (old) old.remove();

      const container = document.createElement('div');
      container.id = 'story-timeline-panel';
      container.className = 'story-timeline';

      const timeline = buildTimeline();
      let html = `<h3>Story Timeline</h3><ul>`;
      timeline.forEach(item => {
        html += `<li><strong>${item.storyTime}:</strong> ${item.excerpt.substring(0,50)}... (msg #${item.idx})</li>`;
      });
      html += `</ul>`;
      container.innerHTML = html;
      document.body.appendChild(container);
    }
  }

  // Include previously defined showDraggableTimeline, makeDraggableList etc here

  function showSettingsPanel() {
    const containerId = "story-timeline-settings";
    let container = document.getElementById(containerId);
    if (container) container.remove();
    container = document.createElement("div");
    container.id = containerId;
    container.className = "story-timeline-settings";

    const settings = getSettings();

    container.innerHTML = `
      <h3>Story Timeline Viewer Settings</h3>
      <label><input type="checkbox" id="st-enable" ${settings.enabled ? "checked":""}/> Enable extension</label><br/><br/>
      <label>Date format: 
        <select id="st-dateformat">
          <option value="mm/dd/yyyy" ${settings.dateFormat==="mm/dd/yyyy"?"selected":""}>MM/DD/YYYY</option>
          <option value="dd/mm/yyyy" ${settings.dateFormat==="dd/mm/yyyy"?"selected":""}>DD/MM/YYYY</option>
          <option value="day-num" ${settings.dateFormat==="day-num"?"selected":""}>Day 1, Day 2…</option>
        </select>
      </label><br/><br/>
      <label>Time format:
        <select id="st-timeformat">
          <option value="24h" ${settings.timeFormat==="24h"?"selected":""}>24-hour</option>
          <option value="ampm" ${settings.timeFormat==="ampm"?"selected":""}>AM/PM</option>
        </select>
      </label><br/><br/>
      <label><input type="checkbox" id="st-dragdrop" ${settings.dragDropEnabled?"checked":""}/> Enable drag/drop reorder</label><br/><br/>
      <button id="st-save">Save Settings</button>
      <button id="st-tagMessages">Tag un-tagged messages</button>
    `;

    document.body.appendChild(container);

    document.getElementById("st-save").addEventListener("click", () => {
      settings.enabled = document.getElementById("st-enable").checked;
      settings.dateFormat = document.getElementById("st-dateformat").value;
      settings.timeFormat = document.getElementById("st-timeformat").value;
      settings.dragDropEnabled = document.getElementById("st-dragdrop").checked;
      console.log("StoryTimeline settings saved:", settings);
      alert("Settings saved. Please reopen the timeline.");
      container.remove();
    });

    document.getElementById("st-tagMessages").addEventListener("click", () => {
      promptTagMessages();
    });
  }

  function registerMenu() {
    ctx.registerMenuItem?.({
      id: "story-timeline-settings",
      title: "Story Timeline Settings",
      onClick: showSettingsPanel
    });
  }

  function init() {
    const settings = getSettings();
    if (!settings.enabled) return;

    registerMenu();
    // Instead of floating button, rely on menu.
    if (ctx.events && typeof ctx.events.on === "function") {
      ctx.events.on("CHAT_CHANGED", () => {
        showTimeline();
      });
    } else {
      console.warn("Story Timeline: events.on not available");
    }
  }

  try {
    init();
    console.log("Story Timeline Viewer loaded successfully");
  } catch (err) {
    console.error("Story Timeline Viewer: initialization error", err);
  }
}
