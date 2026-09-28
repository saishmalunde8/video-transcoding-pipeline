export interface Config {
  host: string;
  port: number;
  nodeEnv: "development" | "test" | "production";
}

const NODE_ENVS = ["development", "test", "production"] as const;

function isKnownNodeEnv(value: string): value is (typeof NODE_ENVS)[number] {
  return (NODE_ENVS as readonly string[]).includes(value);
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const errors: string[] = [];

  const host = env.HOST ?? "127.0.0.1";

  const rawPort = env.PORT ?? "3000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be an integer between 1 and 65535, got "${rawPort}"`);
  }

  const rawNodeEnv = env.NODE_ENV ?? "development";
  if (!isKnownNodeEnv(rawNodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(", ")}, got "${rawNodeEnv}"`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  // Safe: validated by isKnownNodeEnv above, but the array-of-errors
  // pattern doesn't let TypeScript narrow rawNodeEnv's type on its own.
  return { host, port, nodeEnv: rawNodeEnv as (typeof NODE_ENVS)[number] };
}

export function loadConfigOrExit(env: NodeJS.ProcessEnv): Config {
  try {
    return loadConfig(env);
  } catch (e) {
    console.error("Invalid configuration:");
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
