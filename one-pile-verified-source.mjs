// Transport normalization never grants authority: every accepted candidate must
// still match the exact approved donor hash, including all engineering scripts.
export async function verifyOnePileSource(source, expected, file, digest) {
  const original = source.replace(/\r\n/g, '\n');
  if (await digest(original) === expected) return original;
  if (file.endsWith('.html')) {
    // Deploy-Preview adds this exact private-index directive to donor HTML.
    const deployed = original.replace('    <meta name="robots" content="noindex, nofollow, noarchive" />\n', '');
    if (await digest(deployed) === expected) return deployed;
    // Only these observed terminal edge scripts are transport candidates.
    // Removing one never grants acceptance without the complete donor hash.
    const terminalScript = /<script>[^<]*<\/script>(?=<\/body>\s*<\/html>\s*$)/;
    const match = deployed.match(terminalScript);
    const knownEdgePaths = [
      '/cdn-cgi/challenge-platform/scripts/jsd/main.js',
      '/cdn-cgi/challenge-platform/scripts/precursor/main.js',
    ];
    if (match && match[0].includes('window.__CF$cv$params=') &&
        knownEdgePaths.some(path => match[0].includes(path))) {
      const candidate = deployed.replace(terminalScript, '');
      if (await digest(candidate) === expected) return candidate;
    }
  }
  throw new Error('ต้นฉบับไม่ตรงแฮชที่อนุมัติ: ' + file);
}
