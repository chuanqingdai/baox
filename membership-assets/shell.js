(() => {
  const dialog = document.querySelector("#mobile-nav"),
    toggle = document.querySelector(".menu-toggle");
  toggle?.addEventListener("click", () => {
    dialog.showModal();
    toggle.setAttribute("aria-expanded", "true");
  });
  dialog
    ?.querySelector(".menu-close")
    ?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () =>
    toggle?.setAttribute("aria-expanded", "false"),
  );
})();
