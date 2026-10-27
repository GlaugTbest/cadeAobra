for (let n = 0; n < 60; n++) {
  try {
    if ((await fetch("http://localhost:3000")).ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
throw Error("Servidor não iniciou.");
