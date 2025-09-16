export const parseAnchorLogHint = (logs = []) => {
    const anchor = logs.find((l) => l.includes("AnchorError"));
    if (anchor) return anchor;
  
    const hexErr = logs.find((l) => /custom program error: 0x[0-9a-f]+/i.test(l));
    if (hexErr) return hexErr;
  
    const generic = logs.find(
      (l) =>
        l.includes("Program failed to complete") ||
        l.includes("insufficient funds") ||
        l.includes("account not initialized") ||
        l.includes("constraint")
    );
    return anchor || hexErr || generic || null;
  };
  