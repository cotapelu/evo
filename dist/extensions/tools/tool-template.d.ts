#!/usr/bin/env node
/**
 * ============================================================================
 * KIcad TOOL TEMPLATE
 * ============================================================================
 * Copy này và chỉnh sửa để tạo tool mới.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  CẤU TRÚC THƯ MỤC (BẮT BUỘC KHI TẠO TOOL MỚI)                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  src/extensions/tools/                                                   ║
 * ║  ├── your-tool-name.ts          ← File chính (như file này)             ║
 * ║  └── your-tool-name/           ← Thư mục chứa các command files         ║
 * ║      ├── command-1.js          ← MỖI FILE LÀ 1 COMMAND                 ║
 * ║      ├── command-2.js                                               ║
 * ║      └── ...                                                             ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * Pattern:
 * 1. Định nghĩa commands registry (dynamic import)
 * 2. Tạo ToolDefinition với name, description, promptGuidelines, parameters
 * 3. execute() router: nhận params, gọi command module, trả về result
 * 4. registerTool() để đăng ký với extension API
 *
 * Mỗi command là FILE RIÊNG trong thư mục tool (KHÔNG CẦN thư mục commands/).
 * File command export: { schema: Type.Object(...), execute: async (args, cwd, signal, ctx) => { ... } }
 * ============================================================================
 */
import { ToolDefinition } from "@earendil-works/pi-coding-agent";
/**
 * Tạo ToolDefinition cho tool của bạn.
 *
 * QUAN TRỌNG:
 * - name: ID duy nhất, dùng trong prompt LLM (ví dụ: your_tool_name)
 * - label: Tên hiển thị
 * - description: Mô tả ngắn gọn + liệt kê commands
 * - promptSnippet: Cú pháp gọi tool (dùng trong system prompt)
 * - promptGuidelines: Các ví dụ cụ thể để LLM hiểu cách dùng
 * - parameters: JSON Schema cho tham số đầu vào
 */
export declare function createYourTool(): ToolDefinition;
/**
 * Đăng ký tool với extension API.
 *
 * Trong file index.ts của extension, import và gọi:
 *   import { registerToolTemplate } from './tools/tool-template.js';
 *   registerToolTemplate(api);
 */
export declare function registerToolTemplate(api: import("@earendil-works/pi-coding-agent").ExtensionAPI): void;
//# sourceMappingURL=tool-template.d.ts.map