// DOM 변화를 감지하여 popup_menu_area에 버튼 추가
const observer = new MutationObserver(() => {
  const popupMenu = document.querySelector("#popup_menu_area");
  if (popupMenu && !popupMenu.querySelector(".note-actions")) {
    // 메모 기능 추가 영역
    const noteLi = document.createElement("li");
    noteLi.className = "note-actions";

    // .dispMemberInfo a 요소 확인
    const memberInfoLink = popupMenu.querySelector(".dispMemberInfo a");
    if (!memberInfoLink) return;

    // 회원 번호 추출
    const memberSrl = new URLSearchParams(memberInfoLink.href.split("?")[1]).get("member_srl");

    // 저장된 메모 확인
    chrome.storage.sync.get([`note_${memberSrl}`], (result) => {
      const existingNote = result[`note_${memberSrl}`] || "";

      // 버튼 내용 구성
      if (existingNote) {
        noteLi.innerHTML = `
          <span style="color: green; display: block; margin-bottom: 5px;">메모: ${existingNote}</span>
          <a href="#" class="edit-note" style="color: blue; margin-right: 10px;">메모 수정</a>
          <a href="#" class="delete-note" style="color: red;">메모 삭제</a>
        `;
      } else {
        noteLi.innerHTML = `
          <a href="#" class="add-note" style="color: blue;">메모 추가</a>
        `;
      }

      // 버튼을 메뉴에 추가
      popupMenu.querySelector("ul").appendChild(noteLi);

      // 스크롤 위치 저장
      const preserveScroll = (event) => {
        event.preventDefault();
        event.stopPropagation();
      };

      // 메모 추가 버튼 클릭 이벤트
      const addButton = noteLi.querySelector(".add-note");
      if (addButton) {
        addButton.addEventListener("click", (event) => {
          preserveScroll(event);
          const note = prompt("메모를 입력하세요:");
          if (note !== null && note.trim() !== "") {
            const data = {};
            data[`note_${memberSrl}`] = note;
            chrome.storage.sync.set(data, () => {
              alert("메모 저장 완료");
              observer.disconnect(); // 기존 메뉴 삭제 방지
              observer.observe(document.body, { childList: true, subtree: true });
            });
          }
        });
      }

      // 메모 수정 버튼 클릭 이벤트
      const editButton = noteLi.querySelector(".edit-note");
      if (editButton) {
        editButton.addEventListener("click", (event) => {
          preserveScroll(event);
          const newNote = prompt("새 메모를 입력하세요:", existingNote);
          if (newNote !== null && newNote.trim() !== "") {
            const data = {};
            data[`note_${memberSrl}`] = newNote;
            chrome.storage.sync.set(data, () => {
              alert("메모 수정 완료");
              observer.disconnect(); // 기존 메뉴 삭제 방지
              observer.observe(document.body, { childList: true, subtree: true });
            });
          }
        });
      }

      // 메모 삭제 버튼 클릭 이벤트
      const deleteButton = noteLi.querySelector(".delete-note");
      if (deleteButton) {
        deleteButton.addEventListener("click", (event) => {
          preserveScroll(event);
          if (confirm("메모를 삭제하시겠습니까?")) {
            chrome.storage.sync.remove(`note_${memberSrl}`, () => {
              alert("메모 삭제 완료");
              observer.disconnect(); // 기존 메뉴 삭제 방지
              observer.observe(document.body, { childList: true, subtree: true });
            });
          }
        });
      }
    });
  }
});

// observer 시작
observer.observe(document.body, { childList: true, subtree: true });