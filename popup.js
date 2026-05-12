function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let allNotes = [];
let filteredNotes = [];
let selectionMode = false;
let selectedKeys = new Set();

// ── 렌더 ──────────────────────────────────────────────
function renderList() {
  const list = document.getElementById("memo-list");
  const countEl = document.getElementById("memo-count");
  countEl.textContent = `총 ${allNotes.length}개`;

  if (filteredNotes.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📝</span>
        ${allNotes.length === 0 ? "저장된 메모가 없어요" : "검색 결과가 없어요"}
      </div>`;
    return;
  }

  list.innerHTML = "";
  filteredNotes.forEach(({ key, note }) => {
    const srl = key.replace("note_", "");
    const checked = selectedKeys.has(key);

    const li = document.createElement("li");
    li.className = "memo-item";
    li.dataset.key = key;
    li.innerHTML = `
      <div class="item-check ${checked ? "checked" : ""}"></div>
      <div class="item-body">
        <div class="memo-item-header">
          <span class="memo-nick">
            ${note.name || "(닉네임 미확인)"}
            <span class="memo-srl">#${srl}</span>
          </span>
          <button class="memo-delete-btn" data-key="${key}">×</button>
        </div>
        <div class="memo-text">${note.text}</div>
        ${note.updatedAt
          ? `<div class="memo-time">${formatDate(note.updatedAt)} 수정</div>`
          : note.createdAt
          ? `<div class="memo-time">${formatDate(note.createdAt)} 작성</div>`
          : ""}
      </div>`;

    // 체크 클릭
    li.querySelector(".item-check").addEventListener("click", () => toggleItem(key));
    // 아이템 자체 클릭도 선택 (선택 모드일 때)
    li.querySelector(".item-body").addEventListener("click", () => {
      if (selectionMode) toggleItem(key);
    });
    // 단일 삭제
    li.querySelector(".memo-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.storage.sync.remove(key, loadMemos);
    });

    list.appendChild(li);
  });

  updateSelectAllBtn();
}

// ── 선택 모드 ─────────────────────────────────────────
function enterSelectMode() {
  selectionMode = true;
  selectedKeys.clear();
  document.body.classList.add("select-mode");
  document.getElementById("normal-header").classList.add("hidden");
  document.getElementById("select-header").classList.add("active");
  updateSelectAllBtn();
  renderList();
}

function exitSelectMode() {
  selectionMode = false;
  selectedKeys.clear();
  document.body.classList.remove("select-mode");
  document.getElementById("normal-header").classList.remove("hidden");
  document.getElementById("select-header").classList.remove("active");
  renderList();
}

function toggleItem(key) {
  if (selectedKeys.has(key)) {
    selectedKeys.delete(key);
  } else {
    selectedKeys.add(key);
  }
  // 해당 아이템 체크 표시만 토글 (전체 리렌더 없이)
  const li = document.querySelector(`.memo-item[data-key="${key}"]`);
  if (li) li.querySelector(".item-check").classList.toggle("checked", selectedKeys.has(key));
  updateSelectAllBtn();
}

function updateSelectAllBtn() {
  const btn = document.getElementById("select-all-btn");
  const label = document.getElementById("select-all-label");
  const delBtn = document.getElementById("del-selected-btn");
  const total = filteredNotes.length;
  const isAll = total > 0 && selectedKeys.size >= total;

  btn.classList.toggle("all-selected", isAll);
  label.textContent = isAll ? "전체 해제" : "전체 선택";
  delBtn.textContent = selectedKeys.size > 0 ? `삭제 (${selectedKeys.size}개)` : "삭제";
  delBtn.disabled = selectedKeys.size === 0;
}

// ── 로드 ──────────────────────────────────────────────
function loadMemos() {
  chrome.storage.sync.get(null, (items) => {
    allNotes = Object.entries(items)
      .filter(([key]) => key.startsWith("note_"))
      .map(([key, raw]) => ({
        key,
        note: typeof raw === "string"
          ? { text: raw, name: "", createdAt: "", updatedAt: "" }
          : raw,
      }))
      .sort((a, b) => {
        const ta = a.note.updatedAt || a.note.createdAt || "";
        const tb = b.note.updatedAt || b.note.createdAt || "";
        return tb.localeCompare(ta);
      });

    // 선택 목록에서 삭제된 키 정리
    selectedKeys = new Set([...selectedKeys].filter(k => allNotes.some(n => n.key === k)));

    applyFilter();
  });
}

function applyFilter() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  filteredNotes = allNotes.filter(({ key, note }) => {
    if (!query) return true;
    const srl = key.replace("note_", "");
    return (note.name || "").toLowerCase().includes(query) ||
           (note.text || "").toLowerCase().includes(query) ||
           srl.includes(query);
  });
  renderList();
}

// ── 이벤트 ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadMemos();

  document.getElementById("search-input").addEventListener("input", applyFilter);

  document.getElementById("select-mode-btn").addEventListener("click", enterSelectMode);
  document.getElementById("cancel-select-btn").addEventListener("click", exitSelectMode);

  document.getElementById("select-all-btn").addEventListener("click", () => {
    const isAll = selectedKeys.size >= filteredNotes.length;
    if (isAll) {
      selectedKeys.clear();
    } else {
      filteredNotes.forEach(({ key }) => selectedKeys.add(key));
    }
    renderList();
  });

  document.getElementById("del-selected-btn").addEventListener("click", () => {
    if (selectedKeys.size === 0) return;
    chrome.storage.sync.remove([...selectedKeys], () => {
      exitSelectMode();
      loadMemos();
    });
  });

  // 전체 삭제: 버튼 두 번 클릭으로 확인 (첫 클릭 → 텍스트 바뀜, 3초 후 복귀)
  let deleteAllPending = false;
  let deleteAllTimer = null;
  const deleteAllBtn = document.getElementById("delete-all-btn");

  deleteAllBtn.addEventListener("click", () => {
    if (!deleteAllPending) {
      deleteAllPending = true;
      deleteAllBtn.textContent = "정말요?";
      deleteAllTimer = setTimeout(() => {
        deleteAllPending = false;
        deleteAllBtn.textContent = "전체 삭제";
      }, 3000);
    } else {
      clearTimeout(deleteAllTimer);
      deleteAllPending = false;
      deleteAllBtn.textContent = "전체 삭제";
      const keys = allNotes.map(({ key }) => key);
      chrome.storage.sync.remove(keys, loadMemos);
    }
  });
});
