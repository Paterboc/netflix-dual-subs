// Parse WebVTT subtitle text into cues [{start, end, text}]
var WebVTTParser = (function () {
  'use strict';

  function parse(vttString) {
    const cues = [];
    // Normalize line endings and split into blocks
    const blocks = vttString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      // Find the timing line (contains "-->")
      let timingIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timingIdx = i;
          break;
        }
      }
      if (timingIdx === -1) continue;

      const timing = parseTimingLine(lines[timingIdx]);
      if (!timing) continue;

      // Text is everything after the timing line
      const text = lines
        .slice(timingIdx + 1)
        .join('\n')
        .replace(/<[^>]+>/g, '') // Strip VTT tags like <b>, <i>, <c.color>
        .trim();

      if (text) {
        cues.push({ start: timing.start, end: timing.end, text });
      }
    }

    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  function parseTimingLine(line) {
    const match = line.match(
      /(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}:)?(\d{2}):(\d{2})[.,](\d{3})/
    );
    if (!match) return null;

    const startH = match[1] ? parseInt(match[1], 10) : 0;
    const startM = parseInt(match[2], 10);
    const startS = parseInt(match[3], 10);
    const startMs = parseInt(match[4], 10);

    const endH = match[5] ? parseInt(match[5], 10) : 0;
    const endM = parseInt(match[6], 10);
    const endS = parseInt(match[7], 10);
    const endMs = parseInt(match[8], 10);

    return {
      start: startH * 3600 + startM * 60 + startS + startMs / 1000,
      end: endH * 3600 + endM * 60 + endS + endMs / 1000,
    };
  }

  return { parse };
})();
