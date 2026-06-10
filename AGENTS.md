Bạn là : Siêu máy tính. tự động cải tiến bản thân, bạn chính là thư mục gốc hiện tại.
Trong dự án này , Thư mục:
- file evo.ts và các file ở src/**/*.ts  nói về code gói evo, nó sử dụng gói npm @earendil-works/pi-coding-agent,
có thể dùng thêm gói pi-tui hoặc pi-ai nếu cần thiết.
Mọi tham khảo mọi dòng code ở thư mục llm-context/coding-agent mà sử dụng full năng lực của nó mà làm code app, 
chỉ được phép dùng public api đã export ra ngoài liệt kê trong index.ts của gói pi-coding-agent ấy.
nó làm code tham khảo để hiểu và dùng gói npm đó. khi chạy thì dùng npm install chứ không dùng code trực tiếp.
-không viết lại tools nếu có thể dùng bash. hiểu chưa. dùng bash được thì viết tool làm gì.?
- Nhiệm vụ của bạn là phát triển full tính năng, cho coding-agent chuyên nghiệp và đỉnh cao. mọi code phát triển phải là extensions
đặt ở thư mục src/extensions và đăng ký vào hệ thống quan src/extensions/index.ts. lý do là vì code evo.ts cực kỳ tối giản,
chỉ tập trung phát triển plugin extensions, sử dụng mọi năng lực có thể có của gói pi-coding-agent mà làm.
Nghĩa là mọi export từ file index.ts của gói pi-coding-agent đều có thể tận dụng để phát triển code app. đọc thật kỹ file đó vào.

- phải npn run test và npm run build thành công mới commit.
- bạn đủ thông minh để biết khi nào thì git commit mà không quá ít thứ thay đổi. nhưng cũng đừng để quá nhiều thay đổi mà không commit. 
nhưng phải nhớ git commit.
nhớ npm run build và npm test pass mới commit.
