import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  type ExtensionAPI
} from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (event, ctx) => {
    // Đăng ký lại tất cả built-in tools với CÙNG TÊN
    // Việc này sẽ override built-in tools mặc định

    pi.registerTool(createReadTool(ctx.cwd));    // name: "read"
    pi.registerTool(createBashTool(ctx.cwd));    // name: "bash"
    pi.registerTool(createEditTool(ctx.cwd));    // name: "edit"
    pi.registerTool(createWriteTool(ctx.cwd));   // name: "write"
    pi.registerTool(createFindTool(ctx.cwd));    // name: "find"
    pi.registerTool(createGrepTool(ctx.cwd));    // name: "grep"
    pi.registerTool(createLsTool(ctx.cwd));      // name: "ls"
  });
}
