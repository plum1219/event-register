const STORAGE_KEY = "event-register-prototype-v1";

const defaultState = {
  settings: {
    circleName: "",
    eventName: "",
    spaceNo: ""
  },
  items: [
    {
      id: crypto.randomUUID(),
      name: "新刊",
      price: 500,
      stock: 30,
      sold: 0,
      mailReserve: 5,
      icon: "📘",
      soldoutNotice: "none"
    },
    {
      id: crypto.randomUUID(),
      name: "ポストカード",
      price: 200,
      stock: 20,
      sold: 0,
      mailReserve: 0,
      icon: "🖼️",
      soldoutNotice: "none"
    }
  ],
  reservations: [
    {
      id: crypto.randomUUID(),
      name: "サンプルさん",
      itemId: null,
      qty: 1,
      done: false
    }
  ]
};

let state = loadState();

if (state.reservations[0] && state.reservations[0].itemId === null && state.items[0]) {
  state.reservations[0].itemId = state.items[0].id;
}

const el = {
  circleName: document.querySelector("#circleName"),
  eventName: document.querySelector("#eventName"),
  spaceNo: document.querySelector("#spaceNo"),
  itemForm: document.querySelector("#itemForm"),
  itemName: document.querySelector("#itemName"),
  itemPrice: document.querySelector("#itemPrice"),
  itemStock: document.querySelector("#itemStock"),
  itemReserveMail: document.querySelector("#itemReserveMail"),
  itemIcon: document.querySelector("#itemIcon"),
  items: document.querySelector("#items"),
  totalSales: document.querySelector("#totalSales"),
  totalSold: document.querySelector("#totalSold"),
  unsentSoldout: document.querySelector("#unsentSoldout"),
  pendingReservations: document.querySelector("#pendingReservations"),
  resForm: document.querySelector("#reservationForm"),
  resName: document.querySelector("#resName"),
  resItem: document.querySelector("#resItem"),
  resQty: document.querySelector("#resQty"),
  reservations: document.querySelector("#reservations"),
  toast: document.querySelector("#toast"),
  soldoutDialog: document.querySelector("#soldoutDialog"),
  soldoutText: document.querySelector("#soldoutText"),
  tweetText: document.querySelector("#tweetText"),
  tweetBtn: document.querySelector("#tweetBtn"),
  laterBtn: document.querySelector("#laterBtn"),
  noTweetBtn: document.querySelector("#noTweetBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importFile: document.querySelector("#importFile"),
  resetBtn: document.querySelector("#resetBtn")
};

let currentSoldoutItemId = null;

function yen(num) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(num || 0);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultState);
  }
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  setTimeout(() => el.toast.classList.add("hidden"), 2200);
}

function render() {
  saveState();

  el.circleName.value = state.settings.circleName || "";
  el.eventName.value = state.settings.eventName || "";
  el.spaceNo.value = state.settings.spaceNo || "";

  renderStats();
  renderItems();
  renderReservationSelect();
  renderReservations();
}

function renderStats() {
  const totalSales = state.items.reduce((sum, item) => sum + item.price * item.sold, 0);
  const totalSold = state.items.reduce((sum, item) => sum + item.sold, 0);
  const unsentSoldout = state.items.filter(item => remaining(item) === 0 && item.soldoutNotice === "later").length;
  const pendingReservations = state.reservations.filter(res => !res.done).length;

  el.totalSales.textContent = yen(totalSales);
  el.totalSold.textContent = totalSold;
  el.unsentSoldout.textContent = unsentSoldout;
  el.pendingReservations.textContent = pendingReservations;
}

function remaining(item) {
  return Math.max(0, item.stock - item.sold);
}

function renderItems() {
  if (state.items.length === 0) {
    el.items.innerHTML = `<p class="empty">まだ商品がありません。上のフォームから追加してください。</p>`;
    return;
  }

  el.items.innerHTML = state.items.map(item => {
    const rest = remaining(item);
    const isSoldout = rest === 0;
    const needsNotice = isSoldout && item.soldoutNotice === "later";
    return `
      <article class="item-card ${isSoldout ? "soldout" : ""}">
        <div class="item-top">
          <div class="icon">${escapeHtml(item.icon)}</div>
          <div>
            <h3 class="item-title">${escapeHtml(item.name)}</h3>
            <div class="badges">
              <span class="badge">${yen(item.price)}</span>
              ${isSoldout ? `<span class="badge alert">完売</span>` : ""}
              ${needsNotice ? `<span class="badge alert">告知待ち</span>` : ""}
            </div>
          </div>
        </div>
        <div class="item-numbers">
          <div class="number-box"><span>残り</span><strong>${rest}</strong></div>
          <div class="number-box"><span>販売済</span><strong>${item.sold}</strong></div>
          <div class="number-box"><span>通販用</span><strong>${item.mailReserve || 0}</strong></div>
        </div>
        <div class="item-actions">
          <button class="primary" onclick="sellItem('${item.id}')" ${rest <= 0 ? "disabled" : ""}>+1 販売</button>
          <button class="secondary" onclick="undoSell('${item.id}')" ${item.sold <= 0 ? "disabled" : ""}>戻す</button>
          <button class="secondary" onclick="openSoldoutNotice('${item.id}')">告知文</button>
          <button class="danger" onclick="deleteItem('${item.id}')">削除</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderReservationSelect() {
  el.resItem.innerHTML = state.items.map(item => {
    return `<option value="${item.id}">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</option>`;
  }).join("");
}

function renderReservations() {
  const sorted = [...state.reservations].sort((a, b) => Number(a.done) - Number(b.done));
  if (sorted.length === 0) {
    el.reservations.innerHTML = `<p class="empty">取り置きはまだありません。</p>`;
    return;
  }

  el.reservations.innerHTML = sorted.map(res => {
    const item = state.items.find(item => item.id === res.itemId);
    const itemName = item ? `${item.icon} ${item.name}` : "削除済みの商品";
    return `
      <article class="reservation ${res.done ? "done" : ""}">
        <input type="checkbox" ${res.done ? "checked" : ""} onchange="toggleReservation('${res.id}')">
        <div class="res-main">
          <strong>${escapeHtml(res.name)}</strong>
          <span>${escapeHtml(itemName)} × ${res.qty}</span>
        </div>
        <button class="secondary" onclick="toggleReservation('${res.id}')">${res.done ? "未完了に戻す" : "受け渡し済み"}</button>
        <button class="danger" onclick="deleteReservation('${res.id}')">削除</button>
      </article>
    `;
  }).join("");
}

function sellItem(id) {
  const item = state.items.find(item => item.id === id);
  if (!item || remaining(item) <= 0) return;

  item.sold += 1;

  if (remaining(item) === 0 && item.soldoutNotice === "none") {
    currentSoldoutItemId = id;
    const text = makeTweetText(item);
    el.soldoutText.textContent = `「${item.name}」が完売しました。告知しますか？`;
    el.tweetText.value = text;
    el.soldoutDialog.showModal();
  }

  render();
}

function undoSell(id) {
  const item = state.items.find(item => item.id === id);
  if (!item || item.sold <= 0) return;
  item.sold -= 1;
  if (remaining(item) > 0 && item.soldoutNotice !== "sent") {
    item.soldoutNotice = "none";
  }
  render();
}

function deleteItem(id) {
  const item = state.items.find(item => item.id === id);
  if (!item) return;
  if (!confirm(`「${item.name}」を削除しますか？`)) return;
  state.items = state.items.filter(item => item.id !== id);
  render();
}

function openSoldoutNotice(id) {
  const item = state.items.find(item => item.id === id);
  if (!item) return;
  currentSoldoutItemId = id;
  el.soldoutText.textContent = `「${item.name}」の告知文です。`;
  el.tweetText.value = makeTweetText(item);
  el.soldoutDialog.showModal();
}

function makeTweetText(item) {
  const lines = [];
  if (state.settings.eventName) lines.push(`【${state.settings.eventName}】`);
  lines.push(`${item.name}は完売しました。お手に取ってくださった皆さま、ありがとうございます！`);
  if (state.settings.spaceNo) lines.push(`スペース：${state.settings.spaceNo}`);
  if (state.settings.circleName) lines.push(`#${state.settings.circleName.replace(/\s/g, "")}`);
  return lines.join("\n");
}

function markSoldoutNotice(status) {
  const item = state.items.find(item => item.id === currentSoldoutItemId);
  if (!item) return;
  item.soldoutNotice = status;
  currentSoldoutItemId = null;
  render();
}

el.itemForm.addEventListener("submit", event => {
  event.preventDefault();
  state.items.push({
    id: crypto.randomUUID(),
    name: el.itemName.value.trim(),
    price: Number(el.itemPrice.value || 0),
    stock: Number(el.itemStock.value || 0),
    sold: 0,
    mailReserve: Number(el.itemReserveMail.value || 0),
    icon: el.itemIcon.value,
    soldoutNotice: "none"
  });
  el.itemForm.reset();
  el.itemReserveMail.value = 0;
  toast("商品を追加しました");
  render();
});

el.resForm.addEventListener("submit", event => {
  event.preventDefault();
  state.reservations.push({
    id: crypto.randomUUID(),
    name: el.resName.value.trim(),
    itemId: el.resItem.value,
    qty: Number(el.resQty.value || 1),
    done: false
  });
  el.resForm.reset();
  el.resQty.value = 1;
  toast("取り置きを追加しました");
  render();
});

["circleName", "eventName", "spaceNo"].forEach(key => {
  el[key].addEventListener("input", () => {
    state.settings[key] = el[key].value;
    render();
  });
});

el.tweetBtn.addEventListener("click", event => {
  event.preventDefault();
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", el.tweetText.value);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
  markSoldoutNotice("sent");
  el.soldoutDialog.close();
});

el.laterBtn.addEventListener("click", () => markSoldoutNotice("later"));
el.noTweetBtn.addEventListener("click", () => markSoldoutNotice("no"));

el.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `event-register-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

el.importFile.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported.items || !Array.isArray(imported.items)) throw new Error("invalid");
    state = imported;
    toast("データを読み込みました");
    render();
  } catch {
    alert("読み込みに失敗しました。書き出したJSONファイルを選択してください。");
  } finally {
    el.importFile.value = "";
  }
});

el.resetBtn.addEventListener("click", () => {
  if (!confirm("すべてのデータを初期状態に戻しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  render();
});

function toggleReservation(id) {
  const res = state.reservations.find(res => res.id === id);
  if (!res) return;
  res.done = !res.done;
  render();
}

function deleteReservation(id) {
  state.reservations = state.reservations.filter(res => res.id !== id);
  render();
}

function deleteReservationSafe(id) {
  deleteReservation(id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.sellItem = sellItem;
window.undoSell = undoSell;
window.deleteItem = deleteItem;
window.openSoldoutNotice = openSoldoutNotice;
window.toggleReservation = toggleReservation;
window.deleteReservation = deleteReservation;

render();
