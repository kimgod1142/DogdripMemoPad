function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderList(notes, query) {
  const list = document.getElementById("memo-list");
  const countEl = document.getElementById("memo-count");

  const filtered = notes.filter(({ key, note }) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const srl = key.replace("note_", "");
    return (note.name || "").toLowerCase().includes(q) ||
           (note.text || "").toLowerCase().includes(q) ||
           srl.includes(q);
  });

  countEl.textContent = `총 ${notes.length}개`;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="emoji">📝</span>
        ${notes.length === 0 ? "저장된 메모가 없어요" : "검색 결과가 없어요"}
      </div>
    `;
    return;
  }

  list.innerHTML = "";
  filtered.forEach(({ key, note }) => {
    const srl = key.replace("note_", "");
    const li = document.createElement("li");
    li.className = "memo-item";
    li.innerHTML = `
      <div class="memo-item-header">
        <span class="memo-nick">
          ${note.name || "(닉네임 미확인)"}
          <span class="memo-srl">#${srl}</span>
        </span>
        <button class="memo-delete-btn" data-key="${key}" title="삭제">×</button>
      </div>
      <div class="memo-text">${note.text}</div>
      ${note.updatedAt ? `<div class="memo-time">${formatDate(note.updatedAt)} 수정</div>` : note.createdAt ? `<div class="memo-time">${formatDate(note.createdAt)} 작성</div>` : ""}
    `;
    list.appendChild(li);
  });

  list.querySelectorAll(".memo-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      chrome.storage.sync.remove(key, () => loadMemos());
    });
  });
}

function loadMemos() {
  chrome.storage.sync.get(null, (items) => {
    const notes = Object.entries(items)
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

    const query = document.getElementById("search-input").value.trim();
    renderList(notes, query);

    // 검색 이벤트는 최초 1회만 등록
    if (!document.getElementById("search-input").dataset.bound) {
      document.getElementById("search-input").dataset.bound = "1";
      document.getElementById("search-input").addEventListener("input", (e) => {
        renderList(notes, e.target.value.trim());
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", loadMemos);
