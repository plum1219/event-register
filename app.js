const STORAGE_KEY = "event-register-prototype-v3";
const OLD_STORAGE_KEY = "event-register-prototype-v2";
const cashUnits = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

const defaultState = {
  settings: { circleName: "", eventName: "", spaceNo: "" },
  items: [
    { id: crypto.randomUUID(), name: "新刊", price: 550, stock: 30, sold: 0, mailReserve: 5, selfReserve: 1, icon: "📘", color: "#f4eadc", soldoutNotice: "none" },
    { id: crypto.randomUUID(), name: "ポストカード", price: 200, stock: 20, sold: 0, mailReserve: 0, selfReserve: 1, icon: "🖼️", color: "#e6eef8", soldoutNotice: "none" }
  ],
  reservations: [],
  calc: { items: {}, cash: {} }
};

let state = loadState();
const reservationInputState = { new: {}, edit: {} };
let currentSoldoutItemId = null;

const el = {
  circleName: document.querySelector("#circleName"), eventName: document.querySelector("#eventName"), spaceNo: document.querySelector("#spaceNo"),
  itemForm: document.querySelector("#itemForm"), itemName: document.querySelector("#itemName"), itemPrice: document.querySelector("#itemPrice"), itemStock: document.querySelector("#itemStock"), itemReserveMail: document.querySelector("#itemReserveMail"), itemReserveSelf: document.querySelector("#itemReserveSelf"), itemIcon: document.querySelector("#itemIcon"), itemColor: document.querySelector("#itemColor"),
  items: document.querySelector("#items"), totalSales: document.querySelector("#totalSales"), totalSold: document.querySelector("#totalSold"), unsentSoldout: document.querySelector("#unsentSoldout"), pendingReservations: document.querySelector("#pendingReservations"),
  calcItems: document.querySelector("#calcItems"), cashGrid: document.querySelector("#cashGrid"), calcTotal: document.querySelector("#calcTotal"), receivedTotal: document.querySelector("#receivedTotal"), changeTotal: document.querySelector("#changeTotal"), clearCalcBtn: document.querySelector("#clearCalcBtn"),
  resForm: document.querySelector("#reservationForm"), resName: document.querySelector("#resName"), reservationItemInputs: document.querySelector("#reservationItemInputs"), reservations: document.querySelector("#reservations"),
  toast: document.querySelector("#toast"), soldoutDialog: document.querySelector("#soldoutDialog"), soldoutText: document.querySelector("#soldoutText"), tweetText: document.querySelector("#tweetText"), tweetBtn: document.querySelector("#tweetBtn"), laterBtn: document.querySelector("#laterBtn"), noTweetBtn: document.querySelector("#noTweetBtn"),
  editItemDialog: document.querySelector("#editItemDialog"), editItemForm: document.querySelector("#editItemForm"), editItemId: document.querySelector("#editItemId"), editItemName: document.querySelector("#editItemName"), editItemPrice: document.querySelector("#editItemPrice"), editItemStock: document.querySelector("#editItemStock"), editMailReserve: document.querySelector("#editMailReserve"), editSelfReserve: document.querySelector("#editSelfReserve"), editItemIcon: document.querySelector("#editItemIcon"), editItemColor: document.querySelector("#editItemColor"),
  editReservationDialog: document.querySelector("#editReservationDialog"), editReservationForm: document.querySelector("#editReservationForm"), editResId: document.querySelector("#editResId"), editResName: document.querySelector("#editResName"), editReservationItemInputs: document.querySelector("#editReservationItemInputs"),
  exportBtn: document.querySelector("#exportBtn"), importFile: document.querySelector("#importFile"), resetBtn: document.querySelector("#resetBtn")
};

function migrateState(s) {
  s.items = (s.items || []).map(item => ({ color: "#f4eadc", selfReserve: 1, mailReserve: 0, soldoutNotice: "none", ...item }));
  s.reservations = (s.reservations || []).map(res => {
    if (Array.isArray(res.lines)) {
      return { id: res.id || crypto.randomUUID(), name: res.name || "", lines: res.lines.map(line => ({ itemId: line.itemId, qty: Number(line.qty || 0) })).filter(line => line.itemId && line.qty > 0), done: Boolean(res.done) };
    }
    return { id: res.id || crypto.randomUUID(), name: res.name || "", lines: res.itemId ? [{ itemId: res.itemId, qty: Number(res.qty || 1) }] : [], done: Boolean(res.done) };
  }).filter(res => res.lines.length > 0);
  s.calc = s.calc || { items: {}, cash: {} };
  s.calc.items = s.calc.items || {};
  s.calc.cash = s.calc.cash || {};
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return raw ? migrateState(JSON.parse(raw)) : structuredClone(defaultState);
  } catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function yen(num) { return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(num || 0); }
function toast(message) { el.toast.textContent = message; el.toast.classList.remove("hidden"); setTimeout(() => el.toast.classList.add("hidden"), 2200); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttr(value) { return escapeHtml(value).replaceAll(";", ""); }

function reservationQtyForItem(itemId) {
  return state.reservations.reduce((sum, res) => sum + (res.lines || []).reduce((lineSum, line) => line.itemId === itemId ? lineSum + Number(line.qty || 0) : lineSum, 0), 0);
}
function reservationTotal(res) {
  return (res.lines || []).reduce((sum, line) => {
    const item = state.items.find(item => item.id === line.itemId);
    return sum + (item ? Number(item.price || 0) * Number(line.qty || 0) : 0);
  }, 0);
}
function remaining(item) { return Math.max(0, rawRemaining(item)); }
function rawRemaining(item) { return Number(item.stock || 0) - Number(item.sold || 0) - reservationQtyForItem(item.id) - Number(item.mailReserve || 0) - Number(item.selfReserve || 0); }

function render() {
  saveState();
  el.circleName.value = state.settings.circleName || "";
  el.eventName.value = state.settings.eventName || "";
  el.spaceNo.value = state.settings.spaceNo || "";
  renderStats(); renderItems(); renderCalc(); renderReservationItemInputs(el.reservationItemInputs, "new", reservationInputState.new); renderReservations();
}

function renderStats() {
  el.totalSales.textContent = yen(state.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.sold || 0), 0));
  el.totalSold.textContent = state.items.reduce((sum, item) => sum + Number(item.sold || 0), 0);
  el.unsentSoldout.textContent = state.items.filter(item => remaining(item) === 0 && item.soldoutNotice === "later").length;
  el.pendingReservations.textContent = state.reservations.filter(res => !res.done).length;
}

function renderItems() {
  if (state.items.length === 0) { el.items.innerHTML = `<p class="empty">まだ商品がありません。上のフォームから追加してください。</p>`; return; }
  el.items.innerHTML = state.items.map((item, index) => {
    const rest = remaining(item), reserved = reservationQtyForItem(item.id), over = rawRemaining(item) < 0, isSoldout = rest === 0, needsNotice = isSoldout && item.soldoutNotice === "later";
    return `<article class="item-card ${isSoldout ? "soldout" : ""}">
      <div class="item-top"><div class="icon" style="background:${escapeAttr(item.color)}">${escapeHtml(item.icon)}</div><div><h3 class="item-title">${escapeHtml(item.name)}</h3><div class="badges"><span class="badge">${yen(item.price)}</span>${isSoldout ? `<span class="badge alert">通常頒布分なし</span>` : ""}${needsNotice ? `<span class="badge alert">告知待ち</span>` : ""}${over ? `<span class="badge alert">別在庫が総数超過</span>` : ""}</div></div><div class="sort-actions"><button class="secondary" onclick="moveItem(${index}, -1)" ${index === 0 ? "disabled" : ""}>↑</button><button class="secondary" onclick="moveItem(${index}, 1)" ${index === state.items.length - 1 ? "disabled" : ""}>↓</button></div></div>
      <div class="stock-main"><div class="remaining"><span>残り部数</span><strong>${rest}</strong></div><div class="sold-small"><span>販売済み</span><strong>${item.sold || 0}</strong></div></div>
      <div class="sub-stock"><div class="number-box"><span>取り置き</span><strong>${reserved}</strong></div><div class="number-box"><span>通販用</span><strong>${item.mailReserve || 0}</strong></div><div class="number-box"><span>自分用</span><strong>${item.selfReserve || 0}</strong></div><div class="number-box"><span>総数</span><strong>${item.stock || 0}</strong></div></div>
      <div class="item-actions"><button class="primary" onclick="sellItem('${item.id}')" ${rest <= 0 ? "disabled" : ""}>+1 販売</button><button class="secondary" onclick="undoSell('${item.id}')" ${item.sold <= 0 ? "disabled" : ""}>戻す</button><button class="secondary" onclick="editItem('${item.id}')">修正</button><button class="secondary" onclick="openSoldoutNotice('${item.id}')">告知文</button><button class="danger" onclick="deleteItem('${item.id}')">削除</button></div>
    </article>`;
  }).join("");
}

function renderCalc() {
  el.calcItems.innerHTML = state.items.length === 0 ? `<p class="empty">商品を登録すると、ここに計算用レジが表示されます。</p>` : state.items.map(item => {
    const qty = Number(state.calc.items[item.id] || 0);
    return `<div class="calc-row"><div class="icon" style="background:${escapeAttr(item.color)}">${escapeHtml(item.icon)}</div><div><strong>${escapeHtml(item.name)}</strong><br><span class="note">${yen(item.price)} / 点</span></div><div class="qty-control"><button class="secondary" onclick="changeCalcQty('${item.id}', -1)" ${qty <= 0 ? "disabled" : ""}>−</button><strong>${qty}</strong><button class="secondary" onclick="changeCalcQty('${item.id}', 1)">＋</button></div><button class="secondary" onclick="changeCalcQty('${item.id}', -${qty})" ${qty <= 0 ? "disabled" : ""}>0にする</button><strong class="row-total">${yen(qty * Number(item.price || 0))}</strong></div>`;
  }).join("");

  el.cashGrid.innerHTML = cashUnits.map(unit => {
    const qty = Number(state.calc.cash[unit] || 0);
    return `<div class="cash-control"><div class="cash-label"><strong>${yen(unit)}</strong><span>${qty}枚 / ${yen(unit * qty)}</span></div><div class="qty-control"><button class="secondary" onclick="changeCashQty(${unit}, -1)" ${qty <= 0 ? "disabled" : ""}>−</button><strong>${qty}</strong><button class="secondary" onclick="changeCashQty(${unit}, 1)">＋</button></div></div>`;
  }).join("");
  const total = calcTotal(), received = receivedTotal();
  el.calcTotal.textContent = yen(total);
  el.receivedTotal.textContent = yen(received);
  el.changeTotal.textContent = received < total ? `不足 ${yen(total - received)}` : yen(received - total);
}

function renderReservationItemInputs(target, prefix, values = {}) {
  if (!target) return;
  if (state.items.length === 0) { target.innerHTML = `<p class="empty">先に商品を登録してください。</p>`; return; }
  target.innerHTML = state.items.map(item => {
    const qty = Number(values[item.id] || 0);
    return `<div class="res-item-row"><div class="icon" style="background:${escapeAttr(item.color)}">${escapeHtml(item.icon)}</div><div><strong>${escapeHtml(item.name)}</strong><br><span class="note">${yen(item.price)} / 点</span></div><div class="qty-control"><button type="button" class="secondary" onclick="changeReservationInputQty('${prefix}', '${item.id}', -1)" ${qty <= 0 ? "disabled" : ""}>−</button><strong>${qty}</strong><button type="button" class="secondary" onclick="changeReservationInputQty('${prefix}', '${item.id}', 1)">＋</button></div></div>`;
  }).join("");
}

function renderReservations() {
  const sorted = [...state.reservations].sort((a, b) => Number(a.done) - Number(b.done));
  if (sorted.length === 0) { el.reservations.innerHTML = `<p class="empty">取り置きはまだありません。</p>`; return; }
  el.reservations.innerHTML = sorted.map(res => {
    const lines = (res.lines || []).map(line => {
      const item = state.items.find(item => item.id === line.itemId);
      const itemName = item ? `${item.icon} ${item.name}` : "削除済みの商品";
      const subtotal = item ? Number(item.price || 0) * Number(line.qty || 0) : 0;
      return `<span>${escapeHtml(itemName)} × ${line.qty}（${yen(subtotal)}）</span>`;
    }).join("");
    return `<article class="reservation ${res.done ? "done" : ""}"><input type="checkbox" ${res.done ? "checked" : ""} onchange="toggleReservation('${res.id}')"><div class="res-main"><strong>${escapeHtml(res.name)}</strong><div class="res-lines">${lines}</div></div><div class="res-total">${yen(reservationTotal(res))}</div><button class="secondary" onclick="loadReservationToCalc('${res.id}')">会計へ</button><button class="secondary" onclick="editReservation('${res.id}')">編集</button><button class="danger" onclick="deleteReservation('${res.id}')">削除</button></article>`;
  }).join("");
}

function calcTotal() { return state.items.reduce((sum, item) => sum + Number(state.calc.items[item.id] || 0) * Number(item.price || 0), 0); }
function receivedTotal() { return cashUnits.reduce((sum, unit) => sum + unit * Number(state.calc.cash[unit] || 0), 0); }
function changeCalcQty(itemId, delta) { state.calc.items[itemId] = Math.max(0, Number(state.calc.items[itemId] || 0) + Number(delta || 0)); render(); }
function changeCashQty(unit, delta) { state.calc.cash[unit] = Math.max(0, Number(state.calc.cash[unit] || 0) + Number(delta || 0)); render(); }
function changeReservationInputQty(prefix, itemId, delta) { reservationInputState[prefix] = reservationInputState[prefix] || {}; reservationInputState[prefix][itemId] = Math.max(0, Number(reservationInputState[prefix][itemId] || 0) + Number(delta || 0)); renderReservationItemInputs(prefix === "edit" ? el.editReservationItemInputs : el.reservationItemInputs, prefix, reservationInputState[prefix]); }

function sellItem(id) { const item = state.items.find(item => item.id === id); if (!item || remaining(item) <= 0) return; item.sold = Number(item.sold || 0) + 1; if (remaining(item) === 0 && item.soldoutNotice === "none") { currentSoldoutItemId = id; el.soldoutText.textContent = `「${item.name}」の通常頒布分がなくなりました。告知しますか？`; el.tweetText.value = makeTweetText(item); el.soldoutDialog.showModal(); } render(); }
function undoSell(id) { const item = state.items.find(item => item.id === id); if (!item || Number(item.sold || 0) <= 0) return; item.sold = Number(item.sold || 0) - 1; if (remaining(item) > 0 && item.soldoutNotice !== "sent") item.soldoutNotice = "none"; render(); }
function moveItem(index, direction) { const next = index + direction; if (next < 0 || next >= state.items.length) return; [state.items[index], state.items[next]] = [state.items[next], state.items[index]]; render(); }

function editItem(id) { const item = state.items.find(item => item.id === id); if (!item) return; el.editItemId.value = item.id; el.editItemName.value = item.name; el.editItemPrice.value = item.price; el.editItemStock.value = item.stock; el.editMailReserve.value = item.mailReserve || 0; el.editSelfReserve.value = item.selfReserve ?? 1; el.editItemIcon.value = item.icon; el.editItemColor.value = item.color || "#f4eadc"; el.editItemDialog.showModal(); }
el.editItemForm.addEventListener("submit", event => { event.preventDefault(); const item = state.items.find(item => item.id === el.editItemId.value); if (!item) return; item.name = el.editItemName.value.trim(); item.price = Number(el.editItemPrice.value || 0); item.stock = Number(el.editItemStock.value || 0); item.mailReserve = Number(el.editMailReserve.value || 0); item.selfReserve = Number(el.editSelfReserve.value || 0); item.icon = el.editItemIcon.value; item.color = el.editItemColor.value; el.editItemDialog.close(); toast("商品を修正しました"); render(); });
function deleteItem(id) { const item = state.items.find(item => item.id === id); if (!item) return; if (!confirm(`「${item.name}」を削除しますか？`)) return; state.items = state.items.filter(item => item.id !== id); state.reservations.forEach(res => res.lines = (res.lines || []).filter(line => line.itemId !== id)); state.reservations = state.reservations.filter(res => (res.lines || []).length > 0); delete state.calc.items[id]; render(); }

function openSoldoutNotice(id) { const item = state.items.find(item => item.id === id); if (!item) return; currentSoldoutItemId = id; el.soldoutText.textContent = `「${item.name}」の告知文です。`; el.tweetText.value = makeTweetText(item); el.soldoutDialog.showModal(); }
function makeTweetText(item) { const lines = []; if (state.settings.eventName) lines.push(`【${state.settings.eventName}】`); lines.push(`${item.name}は完売しました。お手に取ってくださった皆さま、ありがとうございます！`); if (state.settings.spaceNo) lines.push(`スペース：${state.settings.spaceNo}`); if (state.settings.circleName) lines.push(`#${state.settings.circleName.replace(/\s/g, "")}`); return lines.join("\n"); }
function markSoldoutNotice(status) { const item = state.items.find(item => item.id === currentSoldoutItemId); if (!item) return; item.soldoutNotice = status; currentSoldoutItemId = null; render(); }

el.itemForm.addEventListener("submit", event => { event.preventDefault(); state.items.push({ id: crypto.randomUUID(), name: el.itemName.value.trim(), price: Number(el.itemPrice.value || 0), stock: Number(el.itemStock.value || 0), sold: 0, mailReserve: Number(el.itemReserveMail.value || 0), selfReserve: Number(el.itemReserveSelf.value || 1), icon: el.itemIcon.value, color: el.itemColor.value, soldoutNotice: "none" }); el.itemForm.reset(); el.itemReserveMail.value = 0; el.itemReserveSelf.value = 1; el.itemColor.value = "#f4eadc"; toast("商品を追加しました"); render(); });
el.resForm.addEventListener("submit", event => { event.preventDefault(); const lines = Object.entries(reservationInputState.new).map(([itemId, qty]) => ({ itemId, qty: Number(qty || 0) })).filter(line => line.qty > 0); if (lines.length === 0) { alert("取り置きする商品を1点以上選んでください。"); return; } state.reservations.push({ id: crypto.randomUUID(), name: el.resName.value.trim(), lines, done: false }); el.resName.value = ""; reservationInputState.new = {}; toast("取り置きを追加しました"); render(); });
function editReservation(id) { const res = state.reservations.find(res => res.id === id); if (!res) return; el.editResId.value = res.id; el.editResName.value = res.name; reservationInputState.edit = {}; (res.lines || []).forEach(line => reservationInputState.edit[line.itemId] = Number(line.qty || 0)); renderReservationItemInputs(el.editReservationItemInputs, "edit", reservationInputState.edit); el.editReservationDialog.showModal(); }
el.editReservationForm.addEventListener("submit", event => { event.preventDefault(); const res = state.reservations.find(res => res.id === el.editResId.value); if (!res) return; const lines = Object.entries(reservationInputState.edit).map(([itemId, qty]) => ({ itemId, qty: Number(qty || 0) })).filter(line => line.qty > 0); if (lines.length === 0) { alert("取り置きする商品を1点以上選んでください。"); return; } res.name = el.editResName.value.trim(); res.lines = lines; el.editReservationDialog.close(); toast("取り置きを修正しました"); render(); });
function loadReservationToCalc(resId) { const res = state.reservations.find(res => res.id === resId); if (!res) return; state.calc.items = {}; (res.lines || []).forEach(line => state.calc.items[line.itemId] = Number(line.qty || 0)); state.calc.cash = {}; toast("取り置き内容を会計に読み込みました"); render(); document.querySelector("#calcItems").scrollIntoView({ behavior: "smooth", block: "center" }); }
function toggleReservation(id) { const res = state.reservations.find(res => res.id === id); if (!res) return; res.done = !res.done; render(); }
function deleteReservation(id) { state.reservations = state.reservations.filter(res => res.id !== id); render(); }

["circleName", "eventName", "spaceNo"].forEach(key => el[key].addEventListener("input", () => { state.settings[key] = el[key].value; render(); }));
el.tweetBtn.addEventListener("click", event => { event.preventDefault(); const url = new URL("https://twitter.com/intent/tweet"); url.searchParams.set("text", el.tweetText.value); window.open(url.toString(), "_blank", "noopener,noreferrer"); markSoldoutNotice("sent"); el.soldoutDialog.close(); });
el.laterBtn.addEventListener("click", () => markSoldoutNotice("later"));
el.noTweetBtn.addEventListener("click", () => markSoldoutNotice("no"));
el.clearCalcBtn.addEventListener("click", () => { state.calc.items = {}; state.calc.cash = {}; render(); });
el.exportBtn.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `event-register-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); });
el.importFile.addEventListener("change", async event => { const file = event.target.files[0]; if (!file) return; try { const imported = migrateState(JSON.parse(await file.text())); if (!imported.items || !Array.isArray(imported.items)) throw new Error("invalid"); state = imported; toast("データを読み込みました"); render(); } catch { alert("読み込みに失敗しました。書き出したJSONファイルを選択してください。"); } finally { el.importFile.value = ""; } });
el.resetBtn.addEventListener("click", () => { if (!confirm("すべてのデータを初期状態に戻しますか？")) return; localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); reservationInputState.new = {}; reservationInputState.edit = {}; render(); });

window.sellItem = sellItem; window.undoSell = undoSell; window.deleteItem = deleteItem; window.openSoldoutNotice = openSoldoutNotice; window.toggleReservation = toggleReservation; window.deleteReservation = deleteReservation; window.moveItem = moveItem; window.editItem = editItem; window.changeCalcQty = changeCalcQty; window.changeCashQty = changeCashQty; window.loadReservationToCalc = loadReservationToCalc; window.editReservation = editReservation; window.changeReservationInputQty = changeReservationInputQty;
render();
