// Sorted cue store with binary-search lookup by timestamp
var SubtitleStore = (function () {
  'use strict';

  function create(cues) {
    // cues must be sorted by start time
    const sorted = cues.slice().sort((a, b) => a.start - b.start);
    return { cues: sorted, _lastIdx: 0, _lastTime: 0 };
  }

  // Return all cues active at the given time
  function getCuesAt(store, time) {
    if (!store.cues.length) return [];

    // Detect seek or non-sequential playback — always binary search
    let idx = store._lastIdx;
    const lastStart = idx < store.cues.length ? store.cues[idx].start : Infinity;
    const delta = time - store._lastTime;

    if (
      idx >= store.cues.length ||
      delta < -0.05 ||          // backward seek
      delta > 2 ||              // forward seek / jump
      lastStart > time + 0.5    // cached position is ahead
    ) {
      idx = binarySearch(store.cues, time);
    }

    const active = [];
    // Scan forward from the found position
    for (let i = Math.max(0, idx - 2); i < store.cues.length; i++) {
      const cue = store.cues[i];
      if (cue.start > time) break;
      if (cue.end > time) {
        active.push(cue);
      }
    }

    // Always update last position — including during gaps
    store._lastIdx = idx;
    store._lastTime = time;

    return active;
  }

  // Find the rightmost cue whose start <= time
  function binarySearch(cues, time) {
    let lo = 0;
    let hi = cues.length - 1;
    let result = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (cues[mid].start <= time) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  }

  return { create, getCuesAt };
})();
