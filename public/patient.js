//temporary file (para lang magwork ung chevroon ng patient (to be moved sa script.js if want niu)

const menuBtn = document.getElementById("userMenuBtn");
const userMenu = document.getElementById("userMenu");

if (menuBtn && userMenu) {
  const setMenu = (open) => {
    userMenu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open);
  };

  menuBtn.addEventListener("click", () => setMenu(userMenu.hidden));

  document.addEventListener("click", (e) => {
    if (!menuBtn.contains(e.target) && !userMenu.contains(e.target)) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setMenu(false); menuBtn.focus(); }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
