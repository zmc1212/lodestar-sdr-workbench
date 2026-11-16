# LODESTAR · LS-8 SDR — 电路装配模拟工作台

一个纯前端 3D 演示：22 个射频零件从画面左侧依次飞入深蓝切割垫、自动装配到红色
LS-8 软件无线电主板上，随后自动布线、上电、调谐、扫描，最终锁定 437.8 MHz 卫星
信号 —— 底部五块仪器面板（频谱/瀑布、I/Q 星座、GPSDO 时钟、电源轨、FPGA）全程
实时联动，约 41 秒一个循环。

参考对象：小红书视频「天呐！这才是Ai该干的事情啊」（国外大佬用 Claude 做的
电路设计模拟）。整站零依赖、零构建：three.js UMD 内置于 `vendor/`，所有贴图
（切割垫网格、PCB 走线、手写便签、LED 数码管、屏幕 UI、木纹、天空）均由
Canvas 程序化绘制。

## 运行

```bash
python3 tools/serve.py 8080     # http://127.0.0.1:8080
```

或直接**双击 `index.html`**（file:// 下行为完全一致，无需构建）。

## 交互

| 操作 | 效果 |
| --- | --- |
| 拖动 / 滚轮 | 环绕相机（短暂接管自动运镜） |
| 点击零件 | 弹出该零件标签 |
| 空格 | 暂停 / 继续 |
| R | 重播 |
| 1-8 | 跳转到指定阶段 |

## 代码结构

```
index.html          入口（file:// 与 HTTP 同一入口，加载失败显示引导横幅）
vendor/three.min.js three.js r149 UMD
src/textures.js     Canvas 程序化贴图（垫子/PCB/便签/LED/屏幕/木纹/天空）
src/scene.js        渲染器、灯光、木桌、切割垫、LS-8 主板
src/parts.js        22 个零件建模 + 飞行装配/归位控制器
src/cables.js       同轴/排线/电源线沿曲线生长（TubeGeometry drawRange）
src/timeline.js     8 阶段状态机 + 相机运镜 + 仪表联动状态
src/dashboard.js    底部五仪表盘（DOM + Canvas：频谱瀑布/IQ/时钟/电源轨/FPGA）
src/labels.js       CSS 标签层（黄色/白色零件标签，世界坐标投影）
src/orbit.js        自写轨道相机（拖拽/缩放/自动运镜接管）
src/main.js         装配入口、主循环、交互
tools/serve.py      本地预览服务器（no-store）
```

## 技术要点

- three.js `physicallyCorrectLights = true`：避免 legacy 光照的 π 增益把暗色
  材质抬成灰白。
- 所有颜色贴图 `encoding = sRGBEncoding`，配合 `outputEncoding` 与 ACES 色调映射。
- 线缆生长用 `geometry.setDrawRange` 推进索引，无需重建几何。
- 标签为 CSS 元素，每帧把 3D 锚点 `localToWorld` 后投影到屏幕。
