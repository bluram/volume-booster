const slider = document.getElementById("slider");
const valueEl = document.getElementById("value");
const presetBtns = document.querySelectorAll(".presets button");
const darkBtn = document.getElementById("darkBtn");
const lightBtn = document.getElementById("lightBtn");

function getTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

/* ---------- Theme handling ---------- */
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme === "light" ? "light" : "darcula");
  darkBtn.classList.toggle("active", theme !== "light");
  lightBtn.classList.toggle("active", theme === "light");
  chrome.storage.local.set({ theme });
}

darkBtn.addEventListener("click", () => applyTheme("darcula"));
lightBtn.addEventListener("click", () => applyTheme("light"));

chrome.storage.local.get(["theme"], (res) => applyTheme(res.theme || "darcula"));

/* ---------- Volume handling ---------- */
function syncPresetHighlight(val) {
  presetBtns.forEach((b) => b.classList.toggle("active", Number(b.dataset.v) === Number(val)));
}

async function applyGain(gain) {
  const tab = await getTab();
  if (!tab || !tab.id) return;

  chrome.storage.local.set({ ["gain_" + tab.id]: gain, lastGain: gain });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: setTabGain,
    args: [gain / 100]
  });
}

// Runs INSIDE the page
function setTabGain(multiplier) {
  if (!window.__volumeBooster) {
    window.__volumeBooster = {
      ctx: new (window.AudioContext || window.webkitAudioContext)(),
      nodes: new WeakMap(),
      gainValue: 1
    };
  }
  const vb = window.__volumeBooster;
  vb.gainValue = multiplier;

  const attach = (media) => {
    if (vb.nodes.has(media)) {
      vb.nodes.get(media).gain.gain.value = vb.gainValue;
      return;
    }
    try {
      const source = vb.ctx.createMediaElementSource(media);
      const gainNode = vb.ctx.createGain();
      gainNode.gain.value = vb.gainValue;
      source.connect(gainNode);
      gainNode.connect(vb.ctx.destination);
      vb.nodes.set(media, { source, gain: gainNode });
    } catch (e) { /* already connected */ }
  };

  document.querySelectorAll("video, audio").forEach(attach);
  if (vb.ctx.state === "suspended") vb.ctx.resume();

  if (!vb.observer) {
    vb.observer = new MutationObserver(() => {
      document.querySelectorAll("video, audio").forEach(attach);
    });
    vb.observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

// Load saved value for this tab
(async () => {
  const tab = await getTab();
  const key = "gain_" + (tab ? tab.id : "x");
  chrome.storage.local.get([key, "lastGain"], (res) => {
    const val = res[key] ?? res.lastGain ?? 100;
    slider.value = val;
    valueEl.textContent = val;
    syncPresetHighlight(val);
  });
})();

slider.addEventListener("input", () => {
  valueEl.textContent = slider.value;
  syncPresetHighlight(slider.value);
  applyGain(Number(slider.value));
});

presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.dataset.v;
    slider.value = v;
    valueEl.textContent = v;
    syncPresetHighlight(v);
    applyGain(Number(v));
  });
});
