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
        dragDropEnabled: false,
        showMenuIcon: true,
        menuIcon: "🕓"
      };
    }
    return extensionSettings[MODULE_KEY];
  }

  function parseTimeString(str, dateFormat, timeFormat) {
    const mDay = str.match(/day\s*(\d+),\s*(\d+):(\d+)/i);
    if (mDay) {
      const dayNum = parseInt(mDay[1], 10);
      const h = parseInt(mDay[2], 10);
      const min = parseInt(mDay[3], 10);
      return dayNum * 24 * 60 + h * 60 + min;
    }
    // Additional parsing logic for other formats could go here
    return null;
  }

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
      return meta.storyOrder;
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

  function makeDraggableList(items, onReorder) {
    const list = document.createElement('ul');
    list.className = 'story-timeline-draggable';

    items.forEach(item => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.idx = item.idx;
      li.innerHTML = `<strong>${item.storyTime}:</strong> ${item.excerpt.substring(0,50)}...`;
      list.appendChild(li);
    });

    let dragSrcEl = null;

    function handleDragStart(e) {
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
      this.classList.add('dragging');
    }
    function handleDragOver(e) {
      if (e.preventDefault) e.preventDefault();
      this.classList.add('over');
      e.dataTransfer.dropEffect = 'move';
      return false;
    }
    function handleDragLeave(e) {
      this.classList.remove('over');
    }
    function handleDrop(e) {
      if (e.stopPropagation) e.stopPropagation();
      if (dragSrcEl && dragSrcEl !== this) {
        const tmp = this.innerHTML;
        this.innerHTML = dragSrcEl.innerHTML;
        dragSrcEl.innerHTML = tmp;
        const newOrder = Array.from(list.querySelectorAll('li')).map(li => parseInt(li.dataset.idx,10));
        onReorder(newOrder);
      }
      return false;
    }
    function handleDragEnd(e) {
      list.querySelectorAll('li').forEach(li => {
        li.classList.remove('over');
        li.classList.remove('dragging');
      });
    }

    const lis = list.querySelectorAll('li');
    lis.forEach(li => {
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
    });

    return list;
  }

  function showDraggableTimeline() {
    const timeline = buildTimeline();
    const old = document.getElementById('story-timeline-panel');
    if (old) old.remove();

    const container = document.createElement('div');
    container.id = 'story-timeline-panel';
    container.className = 'story-timeline';

    const title = document.createElement('h3');
    title.textContent = 'Story Timeline (Drag & Drop)';
    container.appendChild(title);

    const list = makeDraggableList(timeline, newOrder => {
      newOrder.forEach((msgIdx, newPos) => {
        const msg = ctx.chat[msgIdx];
        if (!msg.metadata) msg.metadata = {};
        msg.metadata.storyOrder = newPos;
      });
      if (typeof ctx.saveMetadata === "function") {
        ctx.saveMetadata();
      }
    });
    container.appendChild(list);
    document.body.appendChild(container);
  }

  function showSimpleTimeline() {
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

  function findUnTaggedMessages() {
    const chat = ctx.chat || [];
    return chat.map((msg, idx) => ({ msg, idx }))
               .filter(({ msg }) => {
                 const meta = msg.metadata || {};
                 return meta.storyTime === undefined || meta.storyTime === null;
               });
  }

  function promptTagMessages() {
    const unTagged = findUnTaggedMessages();
    if (unTagged.length === 0) {
      console.log("StoryTimeline: No un-tagged messages found");
      return;
    }

    const containerId = "story-timeline-tagger";
    let container = document.getElementById(containerId);
    if (container) container.remove();
    container = document.createElement("div");
    container.id = containerId;
    container.className = "story-timeline-tagger";

    let html = `<h3>Tag Story Time for Messages</h3><ul>`;
    unTagged.forEach(({ msg, idx }) => {
      html += `<li>Msg #${idx}: ${msg.message.substring(0,50)}… 
        <input type="text" data-idx="${idx}" placeholder="Enter story time (e.g. Day 1, 08:30)" /></li>`;
    });
    html += `</ul><button id="st-applyTags">Apply Tags</button>`;
    container.innerHTML = html;
    document.body.appendChild(container);

    document.getElementById("st-applyTags").addEventListener("click", () => {
      const inputs = container.querySelectorAll("input[data-idx]");
      inputs.forEach(input => {
        const idx = parseInt(input.getAttribute("data-idx"),10);
        const value = input.value.trim();
        const msg = ctx.chat[idx];
        if (!msg.metadata) msg.metadata = {};
        msg.metadata.storyTime = value;
        console.log(`Tagged message #${idx} with storyTime=${value}`);
      });
      container.remove();
      showSimpleTimeline();
    });
  }

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
      <label><input type="checkbox" id="st-showicon" ${settings.showMenuIcon ? "checked": ""}/> Show icon in menu</label><br/><br/>
      <label>Menu icon (emoji or URL):<br/>
        <input type="text" id="st-menuicon" value="${settings.menuIcon}" placeholder="🕓 or https://...png"/>
      </label><br/><br/>
      <button id="st-save">Save Settings</button>
      <button id="st-tagMessages">Tag un-tagged messages</button>
    `;
    document.body.appendChild(container);

    document.getElementById("st-save").addEventListener("click", () => {
      settings.enabled = document.getElementById("st-enable").checked;
      settings.dateFormat = document.getElementById("st-dateformat").value;
      settings.timeFormat = document.getElementById("st-timeformat").value;
      settings.dragDropEnabled = document.getElementById("st-dragdrop").checked;
      settings.showMenuIcon = document.getElementById("st-showicon").checked;
      const iconVal = document.getElementById("st-menuicon").value.trim();
      if (iconVal) settings.menuIcon = iconVal;
      console.log("StoryTimeline settings saved:", settings);
      alert("Settings saved. Please reopen the timeline menu.");
      container.remove();
    });

    document.getElementById("st-tagMessages").addEventListener("click", () => {
      promptTagMessages();
    });
  }

  function registerMenu() {
    const checkMenu = setInterval(() => {
      if (window.getExtensionMenu) {
        clearInterval(checkMenu);
        const settings = getSettings();
        const menuParams = {
          name: "Story Timeline Viewer",
          description: "View & configure story timeline",
          action: showSettingsPanel
        };
        if (settings.showMenuIcon && settings.menuIcon) {
          menuParams.icon = settings.menuIcon;
        }
        window.getExtensionMenu().addMenuItem(menuParams);
        console.log("Story Timeline Viewer: menu registered with icon:", menuParams.icon);
      }
    }, 1000);
  }

  // Fallback manual register
  function manualMenuFallback() {
    const checkDOM = setInterval(() => {
      const menuList = document.querySelector('.extension-menu-list');
      if (menuList) {
        clearInterval(checkDOM);
        const settings = getSettings();
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.innerText = (settings.showMenuIcon && settings.menuIcon ? settings.menuIcon + " " : "") + "Story Timeline Viewer";
        li.addEventListener('click', showSettingsPanel);
        menuList.appendChild(li);
        console.log("Story Timeline Viewer: manually added to Extensions menu (fallback)");
      }
    }, 1000);
  }

  function init() {
    const settings = getSettings();
    if (!settings.enabled) return;
    registerMenu();
    manualMenuFallback();
    if (ctx.events && typeof ctx.events.on === "function") {
      ctx.events.on("CHAT_CHANGED", () => {
        const s = getSettings();
        if (s.dragDropEnabled) {
          showDraggableTimeline();
        } else {
          showSimpleTimeline();
        }
      });
    } else {
      console.warn("Story Timeline Viewer: ctx.events.on not available");
    }
  }

  try {
    init();
    console.log("Story Timeline Viewer loaded successfully");
  } catch (err) {
    console.error("Story Timeline Viewer: initialization error", err);
  }
}
