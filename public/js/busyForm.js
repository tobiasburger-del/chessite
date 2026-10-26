// Disables a form's submit button while the request runs, so slow imports
// show progress and can't be double-submitted.
document.querySelectorAll(".js-busy-form").forEach((form) => {
  form.addEventListener("submit", () => {
    const button = form.querySelector("button[type=submit]");
    if (!button) return;
    button.disabled = true;
    if (button.dataset.busy) button.textContent = button.dataset.busy;
  });
});
