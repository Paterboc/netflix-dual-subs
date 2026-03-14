// Parse SRT subtitle text into cues [{start, end, text}]
var SRTParser = (function () {
  'use strict';

  function parse(srtString) {
    const cues = [];
    const blocks = srtString
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n\n');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

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

      const text = lines
        .slice(timingIdx + 1)
        .join('\n')
        .replace(/<[^>]+>/g, '')
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
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!match) return null;

    return {
      start: +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000,
      end: +match[5] * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000,
    };
  }

  return { parse };
})();
