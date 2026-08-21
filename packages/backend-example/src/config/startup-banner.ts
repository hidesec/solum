import { styleText } from "util";
import { env } from "./env";

export function printStartupBanner(port: number): void {
  const banner = `
${styleText("cyan", "╔══════════════════════════════════════════════╗")}
${styleText("green", "         Server started successfully")}
${styleText("dim", "  Environment")} : ${styleText("yellow", env.NODE_ENV)}
${styleText("dim", "  Port")}        : ${styleText("yellow", String(port))}
${styleText("dim", "  URL")}         : ${styleText("blue", `http://localhost:${port}`)}
${styleText("dim", "  Health")}      : ${styleText("blue", `http://localhost:${port}/health`)}
${styleText("dim", "  PID")}         : ${process.pid}
${styleText("dim", "  Node")}        : ${process.version}
${styleText("cyan", "╚══════════════════════════════════════════════╝")}
`;

  console.log(banner);
}
