// 커스텀 모달 DOM을 최초 한 번만 생성
function ensureModal() {
  if (document.getElementById("dogdrip-memo-modal")) return;

  const overlay = document.createElement("div");
  overlay.id = "dogdrip-memo-overlay";

  const modal = document.createElement("div");
  modal.id = "dogdrip-memo-modal";
  modal.innerHTML = `
    <h3 id="dogdrip-modal-title"></h3>
    <textarea id="dogdrip-modal-textarea" placeholder="메모를 입력하세요"></textarea>
    <p id="dogdrip-modal-confirm-text"></p>
    <div class="dogdrip-modal-actions">
      <button class="btn-cancel" id="dogdrip-modal-cancel">취소</button>
      <button class="btn-confirm" id="dogdrip-modal-confirm">확인</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

function openModal({ mode, initialValue = "", onConfirm }) {
  ensureModal();

  const overlay    = document.getElementById("dogdrip-memo-overlay");
  const modal      = document.getElementById("dogdrip-memo-modal");
  const title      = document.getElementById("dogdrip-modal-title");
  const textarea   = document.getElementById("dogdrip-modal-textarea");
  const confirmP   = document.getElementById("dogdrip-modal-confirm-text");
  const cancelBtn  = document.getElementById("dogdrip-modal-cancel");
  const confirmBtn = document.getElementById("dogdrip-modal-confirm");

  if (mode === "delete") {
    title.textContent = "메모 삭제";
    textarea.style.display = "none";
    confirmP.style.display = "block";
    confirmP.textContent = "메모를 삭제하시겠습니까?";
  } else {
    title.textContent = mode === "add" ? "메모 추가" : "메모 수정";
    textarea.style.display = "block";
    textarea.value = initialValue;
    confirmP.style.display = "none";
  }

  overlay.style.display = "block";
  modal.style.display = "block";
  if (mode !== "delete") textarea.focus();

  function close() {
    overlay.style.display = "none";
    modal.style.display = "none";
    cancelBtn.removeEventListener("click", onCancel);
    confirmBtn.removeEventListener("click", onOk);
    overlay.removeEventListener("click", onCancel);
    document.removeEventListener("keydown", onKeydown);
  }

  function onCancel() { close(); }
  function onOk() {
    if (mode !== "delete") {
      const val = textarea.value.trim();
      if (!val) return;
      close();
      onConfirm(val);
    } else {
      close();
      onConfirm();
    }
  }
  function onKeydown(e) { if (e.key === "Escape") close(); }

  cancelBtn.addEventListener("click", onCancel);
  confirmBtn.addEventListener("click", onOk);
  overlay.addEventListener("click", onCancel);
  document.addEventListener("keydown", onKeydown);
}

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 기존 문자열 데이터를 새 구조로 마이그레이션
function normalizeNote(raw, name) {
  if (!raw) return null;
  if (typeof raw === "string") {
    return { text: raw, name: name || "", createdAt: "", updatedAt: "" };
  }
  return raw;
}

function renderNoteActions(popupMenu, memberSrl, memberName) {
  let noteLi = popupMenu.querySelector(".dogdrip-note-actions");
  if (!noteLi) {
    noteLi = document.createElement("li");
    noteLi.className = "dogdrip-note-actions";
    popupMenu.querySelector("ul").appendChild(noteLi);
  }

  chrome.storage.sync.get([`note_${memberSrl}`], (result) => {
    if (chrome.runtime.lastError) return;

    const note = normalizeNote(result[`note_${memberSrl}`], memberName);

    if (note) {
      noteLi.innerHTML = `
        <span class="dogdrip-note-text">메모: ${note.text}</span>
        ${note.updatedAt ? `<span class="dogdrip-note-time">${formatDate(note.updatedAt)} 수정</span>` : ""}
        <a href="#" class="dogdrip-note-link edit">메모 수정</a>
        <a href="#" class="dogdrip-note-link delete">메모 삭제</a>
      `;

      noteLi.querySelector(".edit").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal({ mode: "edit", initialValue: note.text, onConfirm: (newText) => {
          const updated = { ...note, text: newText, name: memberName, updatedAt: new Date().toISOString() };
          chrome.storage.sync.set({ [`note_${memberSrl}`]: updated }, () => {
            if (chrome.runtime.lastError) return;
            renderNoteActions(popupMenu, memberSrl, memberName);
          });
        }});
      });

      noteLi.querySelector(".delete").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal({ mode: "delete", onConfirm: () => {
          chrome.storage.sync.remove(`note_${memberSrl}`, () => {
            if (chrome.runtime.lastError) return;
            renderNoteActions(popupMenu, memberSrl, memberName);
          });
        }});
      });
    } else {
      noteLi.innerHTML = `<a href="#" class="dogdrip-note-link add">메모 추가</a>`;

      noteLi.querySelector(".add").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal({ mode: "add", onConfirm: (text) => {
          const now = new Date().toISOString();
          const newNote = { text, name: memberName, createdAt: now, updatedAt: now };
          chrome.storage.sync.set({ [`note_${memberSrl}`]: newNote }, () => {
            if (chrome.runtime.lastError) return;
            renderNoteActions(popupMenu, memberSrl, memberName);
          });
        }});
      });
    }
  });
}

const observer = new MutationObserver(() => {
  const popupMenu = document.querySelector("#popup_menu_area");
  if (!popupMenu) return;
  if (popupMenu.querySelector(".dogdrip-note-actions")) return;

  const memberInfoLink = popupMenu.querySelector(".dispMemberInfo a");
  if (!memberInfoLink) return;

  const memberSrl = new URLSearchParams(memberInfoLink.href.split("?")[1]).get("member_srl");
  if (!memberSrl) return;

  const nameEl = popupMenu.querySelector(".member_info_name, .nick, .disp_member_name");
  const memberName = nameEl ? nameEl.textContent.trim() : memberInfoLink.textContent.trim();

  renderNoteActions(popupMenu, memberSrl, memberName);
});

observer.observe(document.body, { childList: true, subtree: true });
