const textarea = document.getElementById("notes");
const status = document.getElementById("save-status");

if (textarea && status) {
  const gameId = textarea.dataset.gameId;
  let timer = null;

  textarea.addEventListener("focusout", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      status.className = "mono";
      status.textContent = "saving…";
      fetch(`/games/${gameId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ notes: textarea.value }).toString(),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
          status.className = "mono is-saved";
          status.textContent = "saved ✓";
        })
        .catch(() => {
          status.className = "mono is-error";
          status.textContent = "save failed";
        });
    }, 1000);
  });
}
