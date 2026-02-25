// Parse Netflix TTML/DFXP subtitle XML into cues [{start, end, text}]
var TTMLParser = (function () {
  'use strict';

  function parse(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    if (doc.querySelector('parsererror')) {
      throw new Error('TTML parse error');
    }

    const cues = [];
    // Netflix uses <p> elements with begin/end or begin/dur attributes
    const paragraphs = doc.querySelectorAll('p[begin]');

    for (const p of paragraphs) {
      const start = parseTimestamp(p.getAttribute('begin'));
      let end;

      if (p.hasAttribute('end')) {
        end = parseTimestamp(p.getAttribute('end'));
      } else if (p.hasAttribute('dur')) {
        end = start + parseTimestamp(p.getAttribute('dur'));
      } else {
        continue;
      }

      const text = extractText(p);
      if (text) {
        cues.push({ start, end, text });
      }
    }

    // Sort by start time
    cues.sort((a, b) => a.start - b.start);
    return cues;
  }

  function parseTimestamp(ts) {
    if (!ts) return 0;

    // Handle tick format: "1234t" (Netflix uses 10,000,000 ticks/sec)
    const tickMatch = ts.match(/^(\d+)t$/);
    if (tickMatch) {
      return parseInt(tickMatch[1], 10) / 10000000;
    }

    // Handle HH:MM:SS.mmm or HH:MM:SS:FF (frames)
    const parts = ts.split(':');
    if (parts.length >= 3) {
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      // Last part may contain seconds.ms or seconds.frames
      const secParts = parts[2].split('.');
      const seconds = parseInt(secParts[0], 10) || 0;
      const frac = secParts[1]
        ? parseInt(secParts[1], 10) / Math.pow(10, secParts[1].length)
        : 0;

      // If there's a 4th part, it's frames (typically 24fps)
      let frameSec = 0;
      if (parts.length === 4) {
        frameSec = (parseInt(parts[3], 10) || 0) / 24;
      }

      return hours * 3600 + minutes * 60 + seconds + frac + frameSec;
    }

    // Plain seconds
    return parseFloat(ts) || 0;
  }

  function extractText(node) {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeName === 'br' || child.localName === 'br') {
        text += '\n';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += extractText(child);
      }
    }
    return text.trim();
  }

  return { parse };
})();
