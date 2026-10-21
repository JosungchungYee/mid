"use strict";

const STORAGE_KEY = "vibe-midterm-roulette-v1";
const PALETTE = ["#f2bd72", "#8cb9a0", "#e9947c", "#91a9cf", "#d8a4c5", "#c8c975", "#e8a95b", "#78b6b5"];
const DEFAULT_PRESETS = {
  "점심 메뉴": ["김치찌개", "돈가스", "초밥", "파스타", "국밥", "쌀국수"],
  "간식 고르기": ["붕어빵", "아이스크림", "케이크", "쿠키", "과일"],
  "오늘의 벌칙": ["커피 쏘기", "노래 한 곡", "애교 3종", "설거지하기", "산책하기"]
};
const $ = (selector) => document.querySelector(selector);
const canvas = $("#wheel");
const context = canvas.getContext("2d");
const itemList = $("#item-list");
const presetSelect = $("#preset-select");
const spinButton = $("#spin-button");
let state = loadState();
let rotation = 0;
let spinning = false;

function makeItems(names) {
  return names.map((name, index) => ({
    name,
    weight: 1,
    color: PALETTE[index % PALETTE.length]
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.presets && typeof saved.presets === "object" &&
        Array.isArray(saved.items) && saved.items.every(isValidItem)) {
      const presets = Object.fromEntries(
        Object.entries(saved.presets)
          .filter(([name, items]) => typeof name === "string" && Array.isArray(items) && items.every(isValidItem))
          .map(([name, items]) => [name, items.map((item) => ({ ...item }))])
      );
      if (Object.keys(presets).length > 0) {
        return { presets, selected: presets[saved.selected] ? saved.selected : Object.keys(presets)[0], items: saved.items };
      }
    }
  } catch (error) {
    console.warn("저장된 룰렛 데이터를 불러오지 못했습니다.", error);
  }
  return {
    presets: Object.fromEntries(Object.entries(DEFAULT_PRESETS).map(([name, names]) => [name, makeItems(names)])),
    selected: "점심 메뉴",
    items: makeItems(DEFAULT_PRESETS["점심 메뉴"])
  };
}

function isValidItem(item) {
  return item && typeof item.name === "string" && typeof item.color === "string" &&
    Number.isFinite(Number(item.weight)) && Number(item.weight) > 0;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("룰렛 데이터를 저장하지 못했습니다.", error);
    $("#result-value").textContent = "저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요.";
  }
}

function renderPresets() {
  presetSelect.replaceChildren();
  Object.keys(state.presets).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    presetSelect.append(option);
  });
  presetSelect.value = state.selected;
  $("#delete-preset").disabled = Object.keys(state.presets).length <= 1;
}

function renderItems() {
  itemList.replaceChildren();
  $("#item-count").textContent = `${state.items.length}개`;
  if (state.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "항목을 추가해 룰렛을 채워주세요.";
    itemList.append(empty);
  }
  state.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row";

    const name = document.createElement("input");
    name.className = "item-name";
    name.type = "text";
    name.maxLength = 30;
    name.value = item.name;
    name.setAttribute("aria-label", `항목 ${index + 1} 이름`);
    name.addEventListener("input", () => {
      state.items[index].name = name.value;
      saveCurrentPreset();
      drawWheel();
    });

    const weight = document.createElement("input");
    weight.className = "item-weight";
    weight.type = "number";
    weight.min = "0.1";
    weight.max = "100";
    weight.step = "0.1";
    weight.value = item.weight;
    weight.setAttribute("aria-label", `${item.name || `항목 ${index + 1}`} 가중치`);
    weight.addEventListener("change", () => {
      const value = Number(weight.value);
      if (!Number.isFinite(value) || value <= 0 || value > 100) {
        weight.value = item.weight;
        return;
      }
      state.items[index].weight = value;
      saveCurrentPreset();
      drawWheel();
    });

    const color = document.createElement("input");
    color.className = "item-color";
    color.type = "color";
    color.value = item.color;
    color.setAttribute("aria-label", `${item.name || `항목 ${index + 1}`} 색상`);
    color.addEventListener("input", () => {
      state.items[index].color = color.value;
      saveCurrentPreset();
      drawWheel();
    });

    const remove = document.createElement("button");
    remove.className = "remove-item";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${item.name || `항목 ${index + 1}`} 삭제`);
    remove.addEventListener("click", () => {
      state.items.splice(index, 1);
      renderItems();
      saveCurrentPreset();
    });

    row.append(name, weight, color, remove);
    itemList.append(row);
  });
  drawWheel();
}

function saveCurrentPreset() {
  state.presets[state.selected] = state.items.map((item) => ({ ...item }));
  persist();
}

function drawWheel() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(rect.width, rect.height);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const center = size / 2;
  const radius = center - 2;
  context.clearRect(0, 0, size, size);
  context.save();
  context.translate(center, center);
  context.rotate(rotation);

  if (state.items.length === 0) {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = "#e9ece4";
    context.fill();
    context.fillStyle = "#778078";
    context.font = `600 ${Math.max(12, size * .045)}px "DM Sans", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("항목을 추가해 주세요", 0, 0);
    context.restore();
    return;
  }

  const totalWeight = state.items.reduce((sum, item) => sum + Number(item.weight), 0);
  let start = -Math.PI / 2;
  state.items.forEach((item) => {
    const end = start + (Number(item.weight) / totalWeight) * Math.PI * 2;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, start, end);
    context.closePath();
    context.fillStyle = item.color;
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.82)";
    context.lineWidth = 2;
    context.stroke();

    const middle = (start + end) / 2;
    context.save();
    context.rotate(middle);
    context.translate(radius * .65, 0);
    context.rotate(Math.PI / 2);
    context.fillStyle = "#29352f";
    context.font = `700 ${Math.max(10, Math.min(15, size * .038))}px "Gowun Dodum", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const label = item.name.trim() || "항목";
    context.fillText(label.length > 12 ? `${label.slice(0, 11)}…` : label, 0, 0, size * .28);
    context.restore();
    start = end;
  });

  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255,255,255,.95)";
  context.lineWidth = 3;
  context.stroke();
  context.restore();
}

function spin() {
  if (spinning) return;
  const eligible = state.items.filter((item) => item.name.trim() && Number(item.weight) > 0);
  if (eligible.length < 2) {
    $("#result-value").textContent = "룰렛을 돌리려면 이름이 있는 항목이 2개 이상 필요해요.";
    return;
  }
  const totalWeight = eligible.reduce((sum, item) => sum + Number(item.weight), 0);
  let choice = Math.random() * totalWeight;
  let winnerIndex = 0;
  for (let index = 0; index < eligible.length; index += 1) {
    choice -= Number(eligible[index].weight);
    if (choice < 0) {
      winnerIndex = index;
      break;
    }
  }

  const winner = eligible[winnerIndex];
  const wheelIndex = state.items.indexOf(winner);
  const allWeight = state.items.reduce((sum, item) => sum + Number(item.weight), 0);
  let beforeWeight = 0;
  for (let index = 0; index < wheelIndex; index += 1) beforeWeight += Number(state.items[index].weight);
  const slice = (Number(winner.weight) / allWeight) * Math.PI * 2;
  const winningCenter = beforeWeight / allWeight * Math.PI * 2 + slice / 2;
  const normalizedRotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const target = normalizedRotation + Math.PI * 2 * 6 + (Math.PI * 2 - winningCenter);
  const start = rotation;
  const distance = target - start;
  const duration = 4300;
  const startTime = performance.now();
  spinning = true;
  spinButton.disabled = true;
  $("#result-value").textContent = "두근두근… 결과를 기다려 주세요!";

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    rotation = start + distance * eased;
    drawWheel();
    if (progress < 1) {
      requestAnimationFrame(animate);
      return;
    }
    rotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    drawWheel();
    spinning = false;
    spinButton.disabled = false;
    $("#result-value").textContent = winner.name.trim();
    $("#result-card").classList.remove("is-winner");
    void $("#result-card").offsetWidth;
    $("#result-card").classList.add("is-winner");
  }
  requestAnimationFrame(animate);
}

presetSelect.addEventListener("change", () => {
  state.selected = presetSelect.value;
  state.items = state.presets[state.selected].map((item) => ({ ...item }));
  renderItems();
  persist();
  $("#result-value").textContent = "룰렛을 돌려 결과를 확인하세요!";
});

$("#save-preset").addEventListener("click", () => {
  const name = window.prompt("새 프리셋 이름을 입력하세요.");
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    window.alert("프리셋 이름을 입력해 주세요.");
    return;
  }
  if (state.presets[trimmed]) {
    window.alert("같은 이름의 프리셋이 이미 있어요.");
    return;
  }
  state.selected = trimmed;
  state.presets[trimmed] = state.items.map((item) => ({ ...item }));
  renderPresets();
  persist();
});

$("#delete-preset").addEventListener("click", () => {
  if (Object.keys(state.presets).length <= 1) return;
  const name = state.selected;
  if (!window.confirm(`'${name}' 프리셋을 삭제할까요?`)) return;
  delete state.presets[name];
  state.selected = Object.keys(state.presets)[0];
  state.items = state.presets[state.selected].map((item) => ({ ...item }));
  renderPresets();
  renderItems();
  persist();
});

$("#add-item").addEventListener("click", () => {
  state.items.push({ name: "", weight: 1, color: PALETTE[state.items.length % PALETTE.length] });
  renderItems();
  saveCurrentPreset();
  itemList.querySelector(".item-row:last-child .item-name")?.focus();
});

spinButton.addEventListener("click", spin);
window.addEventListener("resize", drawWheel);
if ("ResizeObserver" in window) new ResizeObserver(drawWheel).observe(canvas);

renderPresets();
renderItems();
