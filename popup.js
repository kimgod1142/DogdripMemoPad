document.addEventListener("DOMContentLoaded", () => {
  const confirmButton = document.getElementById("confirm-button");
  const popup = document.getElementById("custom-popup");
  const overlay = document.getElementById("popup-overlay");
  const closeButton = document.getElementById("popup-close-button");

  // 버튼 클릭 시 커스텀 팝업 열기
  confirmButton.addEventListener("click", () => {
    popup.style.display = "block";
    overlay.style.display = "block";
  });

  // 팝업 닫기 버튼 클릭 시
  closeButton.addEventListener("click", () => {
    popup.style.display = "none";
    overlay.style.display = "none";
  });

  // 오버레이 클릭 시 팝업 닫기
  overlay.addEventListener("click", () => {
    popup.style.display = "none";
    overlay.style.display = "none";
  });
});