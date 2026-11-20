# LODESTAR · LS-8 SDR 电路装配模拟工作台

复刻自小红书视频「天呐！这才是Ai该干的事情啊」（ANTHROPIC · LODESTAR · LS-8 SDR，
Fig. 07 — one software radio, one satellite pass, 22 parts in from the left）。

## 启动方式

- 本地 HTTP（推荐）：

  ```bash
  cd lodestar-sdr-workbench
  python3 tools/serve.py 8080     # 或 python3 -m http.server 8080
  # 打开 http://127.0.0.1:8080
  ```

  `tools/serve.py` 额外发送 `Cache-Control: no-store`，改源码后刷新即是最新效果。

- **双击支持**：`index.html` 可直接双击打开（file://）。源码全部是经典 `<script>`
  （非 ES 模块）、无 fetch/XHR、贴图全部 Canvas 程序化生成、three.js 内置于
  `vendor/three.min.js`，因此 file:// 与 HTTP 行为完全一致，无需任何构建步骤。
  入口加载失败时页面会显示引导横幅（含 HTTP 启动命令）。

## 交互

- 拖动旋转 / 滚轮缩放；点击零件显示其标签。
- 空格：暂停；R：重播；数字键 1-8：跳转到 装配/布线/上电/调谐/扫描/跟踪/锁定/归位 阶段。
- 时间线约 41s 自动循环：ASSEMBLY → CABLING → POWER ON → TUNE → SCAN → TRACK →
  LOCK → PARTS HOME。

## 验收

1. HTTP 打开 → 进入装配阶段，零件逐个飞入、黄色标签逐一出现，控制台无资源加载错误。
2. 按 4（TUNE）：LED 数码管开始显示频率；按 8（LOCK）：右下 MODE 变粉色 LOCK，
   底部仪表盘出现信号峰、IQ 星座收敛、电源轨/时钟/FPGA 读数全部变化。
3. 双击 index.html：与 1、2 相同表现。

浏览器实现说明：标签用 CSS 层投影（`src/labels.js`），仪表盘为 DOM+Canvas
（`src/dashboard.js`），3D 为 three.js r149（UMD 版）+ 自写轨道相机。改代码后若
画面未更新，先确认没有使用缓存（tools/serve.py 已禁缓存）。

音效：默认开启，页面加载即尝试出声（浏览器拦截自动播放时，首次点击/按键/触摸页面立即恢复；合成音，零素材），右上角 🔊/🔇 可切换；零件落座、阶段切换、打字均配音。

## 界面语言（双语约定）
中文为主、英文为副的双语风格：标题卡/状态卡/阶段胶囊/仪表盘为中文主文案，
英文原文退到小字副位（`.tag .sub`、面板 `.meta`、状态卡「模式 MODE」小字）；
型号代号与单位（LS-8、SDR、MHz、dB、MS/S、PPM、SNR）保留英文；仪器屏幕读数与
3D 零件丝印贴图（PCB 位号、切割垫印字、便签手写内容）保持英文（真实硬件即英文标注）。
改动文案时遵循同一约定：主位中文、副位英文、代号不译。
