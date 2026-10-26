// PGN dates ("2026.10.06", with "??" for unknown parts) in a readable form.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayDate(pgnDate) {
  const [year, month, day] = String(pgnDate || "").split(".");
  if (!/^\d{4}$/.test(year || "")) return "";
  const m = Number(month);
  if (!(m >= 1 && m <= 12)) return year;
  const d = Number(day);
  return (d >= 1 && d <= 31 ? `${d} ` : "") + `${MONTHS[m - 1]} ${year}`;
}

module.exports = { displayDate };
