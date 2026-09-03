const { spawn } = require("child_process");
const path = require("path");

const extra = process.argv.slice(2).filter((arg) => arg !== "--offline");
const expoCli = require.resolve("expo/bin/cli", {
  paths: [path.join(__dirname, "..")],
});

async function expoServersReachable() {
  try {
    const response = await fetch("https://api.expo.dev/v2/versions/latest", {
      signal: AbortSignal.timeout(4000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

(async () => {
  const wantOffline =
    process.argv.includes("--offline") || process.env.EXPO_OFFLINE === "1";
  const offline = wantOffline || !(await expoServersReachable());

  if (offline && !wantOffline) {
    console.warn("Expo servers are unavailable. Starting Metro in offline mode.");
  }

  const child = spawn(
    process.execPath,
    [expoCli, "start", ...(offline ? ["--offline"] : []), ...extra],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ...(offline ? { EXPO_OFFLINE: "1" } : {}),
      },
    }
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
})();
