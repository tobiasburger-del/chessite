// Leitner-style spaced repetition for drills. A drill sits in a box; solving
// it moves it up a box (longer wait), missing it sends it back to box 0.

// Days until the next review once a drill reaches each box.
const INTERVAL_DAYS = [1, 1, 3, 7, 21, 60];
const MAX_BOX = INTERVAL_DAYS.length - 1;
const DAY_MS = 86400000;

function nextReview(box, correct, now = new Date()) {
  const newBox = correct ? Math.min(box + 1, MAX_BOX) : 0;
  return {
    box: newBox,
    dueAt: new Date(now.getTime() + INTERVAL_DAYS[newBox] * DAY_MS),
  };
}

module.exports = { nextReview, INTERVAL_DAYS, MAX_BOX };
