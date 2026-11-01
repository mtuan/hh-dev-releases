# HayHay Dev Tools

Electron app chạy độc lập, dùng để build nhiều project Cocos Creator qua CLI headless build
(`CocosCreator --project <path> --build "platform=...;debug=...;buildPath=..."`), xem log/tiến trình theo thời gian thực.

Tool này không phụ thuộc vào bất kỳ project Cocos Creator cụ thể nào — mỗi project được thêm qua UI với
đường dẫn project và đường dẫn thực thi Cocos Creator riêng (mỗi project có thể dùng version Creator khác nhau).

Nếu Cocos Editor đang mở project, dashboard gửi job vào build queue của chính Editor qua project extension
`extensions/cocos-build-dashboard-bridge`; không cần đóng Editor. Nếu Editor không mở, dashboard dùng CLI
headless như bình thường. Dashboard tự kiểm tra bridge theo từng project; nếu thiếu hoặc chưa chạy,
banner cảnh báo và nút **Install/Update bridge** sẽ copy bản bridge đúng vào project. Nếu Editor đã
mở trước khi cài, refresh/enable bridge trong **Extension > Extension Manager**, hoặc mở lại project một lần.

## Cài đặt

```bash
npm install
```

## Chạy

```bash
npm start
```

Lệnh này build TypeScript (`electron/`, `src/`) sang `dist/` rồi mở app Electron.

### Phát triển với live reload

```bash
npm run dev
```

Lệnh dev build một lần rồi watch TypeScript, renderer bundle, HTML và CSS. Electron tự restart/reload khi source
thay đổi; không cần chạy `npm run package` cho từng thay đổi. `npm run package` chỉ dùng để tạo artifact `.app`/`.exe`
trước khi phát hành hoặc kiểm tra bản đóng gói.

Bản development dùng tên **HayHay Dev Tools — Development**, application ID
`com.hayhay.cocos-build-dashboard.dev`, và icon development riêng. Bản đóng gói dùng tên **HayHay Dev Tools**,
application ID `com.hayhay.cocos-build-dashboard`, và icon production. Khi chẩn đoán runtime, xác định process bằng
executable/cwd chính xác; không mở app theo display name vì macOS có thể chọn một packaging artifact cũ.

Khi `npm run dev` đang chạy, không cần chạy lại `npm run build` sau mỗi thay đổi UI. Theo dõi output của watcher
để biết lỗi type/bundle. Chỉ dùng `npm run build` cho kiểm tra one-shot có chủ đích và `npm run package` cho release.

Khi tool nằm bên trong một project Cocos Creator (ví dụ `<project>/tools/cocos-build-dashboard`),
tool tự tìm project gần nhất từ thư mục chạy, đọc version từ `package.json -> creator.version`,
và chọn Cocos Creator executable có cùng version. Project sẽ được thêm và chọn tự động
nếu cả hai đường dẫn được phát hiện. Các đường dẫn hợp lệ đã lưu thủ công không bị ghi đè.

## Đóng gói thành app chạy độc lập

Không cần `npm start`/dev mỗi lần — đóng gói 1 lần thành file `.app`, sau đó chỉ cần double-click:

```bash
npm run package
```

Mọi lệnh package/release tự xóa toàn bộ output `release/` cũ trước khi build để app bundle và icon cũ không còn
lẫn với artifact mới.

Chạy trên máy nào thì ra bản cho máy đó (dựa theo config `build` trong `package.json`):

- **macOS** (Apple Silicon): `release/mac-arm64/HayHay Dev Tools.app` — kéo vào `/Applications` để dùng như
  app bình thường. Bản CI release được ký và notarize; bản local chỉ được ký khi máy build có cấu hình certificate.
- **Windows** (x64): `release/HayHay-Dev-Tools-<version>-win-x64.exe` — chạy installer để cài đặt. Bản CI release
  được ký khi deployment có certificate Authenticode hợp lệ.

`npm run package` build theo đúng hệ điều hành đang chạy lệnh. Muốn build riêng target: `npx electron-builder --mac`
hoặc `npx electron-builder --win` (build Windows từ macOS vẫn chạy được — electron-builder tự tải Wine/NSIS cần
thiết, không cần cài gì thêm, đã test thành công).

Bản đóng gói lưu registry máy cục bộ `projects.json` ở thư mục dữ liệu người dùng chuẩn của Electron
(`~/Library/Application Support/cocos-build-dashboard/` trên macOS, `%APPDATA%\cocos-build-dashboard\` trên
Windows), tách biệt với `data/projects.json` dùng khi chạy dev qua `npm start`. Registry này chỉ chứa
path và executable riêng của từng máy; platform settings nằm trong project như mô tả bên dưới.

## Hướng dẫn sử dụng

### Giao diện

- **Route bar**: luôn nằm trên cùng ở mọi page, ví dụ `/projects/hayhaytemplatev3/fb-instant-games`; click để focus/select, hoặc dùng nút copy và refresh.
- **Projects page** (`/projects`): quản lý danh sách project, thêm folder, mở project hoặc remove khỏi dashboard.
- **Project context**: sidebar luôn cho biết project và platform đang làm việc; đổi project nằm ở link phụ **All projects**.
- **Platforms page** (`/projects/<id>/platforms`): thêm, mở, cấu hình template hoặc remove platform của project.
- **Sidebar navigation**: menu tool phẳng gồm Build, Localization và Asset optimization; cấu trúc vẫn hỗ trợ submenu khi một tool thực sự cần.
- **Build page**: platform/profile, build actions, jobs và log chỉ nằm trong page này.
- **Platforms**: danh sách platform (profile) của project, nút **+ Add platform** và **Build selected**.
- **Jobs**: hàng đợi build và trạng thái từng job (`pending` / `running` / `success` / `failed` / `canceled`).
- **Log**: output realtime của CLI build.

### Bước 1 — Thêm project

1. Bấm **+ Add project**.
2. Điền:
   - **ID (slug)**: định danh duy nhất, ví dụ `my-game`.
   - **Name**: tên hiển thị.
   - **Project path**: thư mục project Cocos Creator (bấm **Browse…** để chọn).
   - **Creator executable path**: file thực thi Cocos Creator của project đó (bấm **Browse…**).
     macOS: `.../CocosCreator.app/Contents/MacOS/CocosCreator`, Windows: `CocosCreator.exe`.
3. Bấm **Save**. Project xuất hiện ở cột trái; bấm vào để chọn.

Mỗi project dùng executable riêng nên có thể build các project khác version Creator trong cùng 1 tool.

### Bước 2 — Thêm platform và build variants

1. Chọn project, bấm **+ Add platform**.
2. Chọn **Platform**: `Android`, `iOS`, `Web Mobile`, `Web Desktop`, `Facebook Instant Game`, `macOS`,
   hoặc **Khác (nhập tay)…** để nhập tên platform theo Cocos CLI.
3. Với Android, nhập package name production, ví dụ `com.company.game`.
4. Bấm **Save**. Tool tạo hai build environment cho platform:
   - **Development**: debug, suffix `.dev`, output `build/<platform>/dev`. Dùng cho diagnostics, logging và kiểm thử nội bộ.
   - **Production**: release, package name gốc, output `build/<platform>/prod`. Dùng cho hosting hoặc phân phối app.

Local preview không phải distributable build environment. Nó sẽ được xử lý bởi workflow Preview/Run của Cocos Creator.
Project vẫn có thể khai báo thêm environment riêng như staging khi thật sự cần.

Khi build, tool expose variant qua environment variable `COCOS_BUILD_ENV` (mặc định `dev` hoặc `prod`)
để build extension/script của project chọn API endpoint, analytics ID, feature flags, v.v. Package/bundle identifier
được ghi vào đúng cấu trúc của Creator: `settings/builder.json` cho Creator 2 và
`profiles/v2/packages/<platform>.json` cho Creator 3. Các option khác như keystore và NDK được giữ nguyên.
Dashboard cũng chọn JDK theo version engine (JDK 11 cho Creator 2 và Creator 3 trước 3.7; JDK 17 từ Creator 3.7).

Dùng nút **Delete** trên từng dòng platform để xoá platform đó.

Dashboard cho phép Cocos CLI dùng default cho platform chưa từng mở trong Build panel. Theo Cocos 3.8,
nếu không truyền scene list thì tất cả scene được include và scene đầu tiên được dùng làm start scene.
Nếu một platform/plugin thật sự cần option không có default, job sẽ hiển lỗi gốc từ Cocos trong log.

### Bước 3 — Build

1. Tick 1 hoặc nhiều variant trong platform.
2. Bấm **Build selected**. Mỗi platform tạo 1 job trong mục **Jobs**.
3. Theo dõi log realtime ở mục **Log**. Job đang chạy có nút **Cancel** để huỷ.
4. Kết quả ở `<projectPath>/<buildPath>` (ví dụ `build/android/prod`).

Trước mỗi build, dashboard chỉ xóa output cũ của variant đang build, rồi truyền `buildPath` và
`outputName` tách biệt để output không bị lồng thêm một thư mục task. Ví dụ Facebook Development nằm
trực tiếp ở `build/fb-instant-games/dev/`.

Sau Facebook Instant Games build, dashboard tự validate:

- Các entry file Cocos 3.8 bắt buộc và JSON config phải tồn tại/hợp lệ.
- Mọi local `src`/`href` trong `index.html` phải trỏ tới file có thật.
- Không còn bootstrap Cocos 2.x (`settings.js`, `cocos2d-js.js`, `_CCSettings`, v.v.).
- Output và ZIP không được chứa `key.pem`, `cert.pem`, `.DS_Store`.
- ZIP phải chứa các entry file và không vượt giới hạn 500 file của Facebook.

Các job chạy **tuần tự**, không song song. Xem thêm phần "Build queue & exit code" bên dưới.

### Thêm build-template vào project

Dùng khi platform cần file tùy chỉnh (ví dụ `fbapp-config.json`, `index.html` cho Facebook Instant Game,
file override native cho Android).

1. Đặt sẵn file dùng chung vào `build-templates/<platform>/` của **tool** (xem phần bên dưới).
2. Ở dòng platform, bấm **📁 Template**.
3. Tick các file/thư mục muốn dùng (có nút chọn/bỏ chọn tất cả), bấm **Add**.
4. File được copy vào `<projectPath>/build-templates/<platform>/`.

### Add Code base (thư viện script dùng chung)

Dùng để đưa các script gameplay dùng chung vào nhiều project.

1. Đặt script vào thư mục `codebase/scripts/` của **tool**, theo cấu trúc giống `assets/scripts/` của project
   (ví dụ `codebase/scripts/core/ui/X.ts` → `<project>/assets/scripts/core/ui/X.ts`).
2. Chọn project, bấm **Add Code base** ở header.
3. Tick các file muốn thêm rồi bấm **Add**.
4. Nếu file đã tồn tại trong project, tool hiện danh sách xung đột: file được tích sẽ **bị ghi đè**,
   file bỏ tích được giữ nguyên.

Về file `.meta`: không hiện trong danh sách chọn nhưng được copy kèm. Nếu project đã có `.meta`
(của file hoặc thư mục) thì giữ nguyên, để UUID của script không bị đổi và scene/prefab không mất tham chiếu.

Với bản đóng gói (`.app` / `.exe`), codebase, build templates, bridge và loading kit được ship dưới
`dashboard-resources/` như resource chỉ đọc. Tuỳ chỉnh của từng game luôn nằm trong project game.

## Cấu hình project

Tool tách config thành hai phần:

- `data/projects.json` (dev) hoặc Electron user-data `projects.json` (app đóng gói): registry máy cục bộ,
  bị gitignore vì chứa `projectPath` và `creatorExecutable` tuyệt đối.
- `<project>/cocos-build-dashboard.json`: danh sách platform/profile của riêng project. File này nên commit
  vào Git để mọi người pull project có cùng build settings.

Có thể thêm project trực tiếp qua UI ("+ Add project", có nút Browse… để chọn thư mục project và file
thực thi Cocos Creator), hoặc copy `data/projects.example.json` thành `data/projects.json` rồi chỉnh tay. Registry local:

```json
{
  "projects": [
    {
      "id": "my-game",
      "name": "My Game",
      "projectPath": "/absolute/path/to/cocos-project",
      "creatorExecutable": "/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
    }
  ]
}
```

Config được commit trong project:

```json
{
  "version": 1,
  "profiles": [
    {
      "id": "android-prod",
      "label": "Production",
      "platform": "android",
      "environment": "prod",
      "debug": false,
      "buildPath": "build/android/prod",
      "packageName": "com.company.game"
    }
  ]
}
```

Profile từ format cũ trong `projects.json` được đọc tương thích và tự chuyển sang file project khi tool khởi động.

`creatorExecutable` khác nhau theo hệ điều hành và version Creator của từng project:

- macOS: `.../CocosCreator.app/Contents/MacOS/CocosCreator`
- Windows: `CocosCreator.exe`

## Thư viện build-template dùng chung

Mỗi profile (platform) trong project có nút **"📁 Template"** để add file vào
`<projectPath>/build-templates/<platform>/` của Cocos Creator (file đặt đúng đây sẽ được build headless dùng —
ví dụ `fbapp-config.json`, `index.html` tùy chỉnh cho Facebook Instant Game, hay override file native cho
Android).

Nguồn file lấy từ thư viện dùng chung của tool — **`resources/build-templates/<platform>/`**, không phải thư mục
của game project. Copy sẵn file bạn muốn tái sử dụng qua nhiều project vào đây trong lúc phát triển tool
(ví dụ `resources/build-templates/fb-instant-games/`); bấm "Template" sẽ hiện cây
thư mục cho tick chọn file muốn add, giống Package Manager của Unity.

## Shared tools và loading kit

Dashboard phân biệt rõ ba lớp:

- `resources/`: implementation/default được đóng gói cùng tool, không chỉnh trong game.
- `<project>/loading/` và `cocos-loading.config.json`: theme, artwork và override riêng của game, commit Git.
- `<project>/build/`: output sinh ra, không commit.

Khi chọn project, dashboard kiểm tra `cocos-tools.lock.json`. Banner **Install tools/Update tools** sẽ cài đúng
bridge theo Creator family, tạo loading config/theme mặc định nếu thiếu, và ghi hash các file do tool quản lý vào
`.cocos-build-tools/installation.json`. File đã được developer sửa sẽ không bị ghi đè im lặng.

Cocos Creator 3.x hỗ trợ build qua Editor bridge hoặc headless. Cocos Creator 2.x dùng headless adapter; tool
không cài nhầm extension API 3.x vào project 2.x. Android/iOS deploy đọc identity từ APK/.app đã build để launch,
thay vì giả định output của hai Creator family có cùng manifest/project structure.

Các lệnh dùng cho CI:

```bash
npm run cli -- doctor --project /path/to/game
npm run cli -- sync --project /path/to/game
npm run cli -- build --project /path/to/game --profile fb-instant-games-prod
```

Kế hoạch và các mốc kiến trúc nằm trong `IMPLEMENTATION_PLAN.md`.

## Build queue & exit code

Build chạy tuần tự (1 job tại 1 thời điểm) để tránh xung đột với Cocos Creator Editor. Exit code từ CLI build
được map theo tài liệu chính thức:

- `36` → thành công
- `32` → lỗi tham số không hợp lệ
- `34` → lỗi build khác (xem log)

## Kiến trúc

- `electron/main.ts` — main process: quản lý job queue, spawn CLI build, đọc/ghi `data/projects.json`.
- `resources/bridges/creator-3/` — source package của project extension nhận build job qua localhost và gửi
  `builder/add-task` vào Editor đang mở.
- `electron/preload.ts` — expose `window.buildApi` cho renderer qua `contextBridge` (contextIsolation bật, nodeIntegration tắt).
- `src/app.ts` — composition root cho shell, shared state và route dispatch; không chứa page rendering.
- `src/routes/index.ts` — root application layout `/`, chứa navigation cho global pages.
- `src/routes/projects/index.ts` — route `/projects`.
- `src/routes/projects/[projectId]/platforms/index.ts` — route `/projects/:projectId/platforms`.
- `src/routes/projects/[projectId]/[platform]/index.ts` — platform owner page `/projects/:projectId/:platform`.
- `src/routes/projects/[projectId]/[platform]/templates/index.ts` — build-template tool `/projects/:projectId/:platform/templates`.
- `src/routes/projects/[projectId]/[platform]/build/index.ts` — Build tool route `/projects/:projectId/:platform/build`.
- `src/shared/ui/` — dialog và UI primitive dùng lại; page-specific UI không được đặt ở đây.
- `AGENTS.md` — rules bắt buộc khi thêm route/tool mới.

## Giới hạn hiện tại

- Chưa hỗ trợ build song song nhiều project cùng lúc (an toàn hơn, tránh Editor lock).
- Bản đóng gói (`npm run package`) chưa ký code (code signing) — chỉ dùng nội bộ, chưa phát hành ra ngoài.
