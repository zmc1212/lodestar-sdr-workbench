/* 程序化 Canvas 贴图：木纹 / 切割垫 / PCB / 便签 / LED 数码管 / 屏幕UI */
(function (LS8) {
  function makeTex(w, h, draw, opts) {
    opts = opts || {};
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.encoding = THREE.sRGBEncoding;
    if (opts.repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    return tex;
  }

  /* 浅木纹桌面 */
  function wood() {
    return makeTex(512, 512, function (ctx, w, h) {
      ctx.fillStyle = "#dcbd8f";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        var y = Math.random() * h;
        var a = 0.05 + Math.random() * 0.06;
        ctx.strokeStyle = "rgba(150,105,55," + a + ")";
        ctx.lineWidth = 1 + Math.random() * 2.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (var x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 2.5);
        ctx.stroke();
      }
      for (var k = 0; k < 26; k++) {
        ctx.fillStyle = "rgba(170,125,70," + (0.06 + Math.random() * 0.06) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 60 + Math.random() * 120, 2 + Math.random() * 5);
      }
    }, { repeat: [5, 5] });
  }

  /* 深蓝切割垫 + 网格 */
  function mat() {
    return makeTex(1024, 680, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#22345c");
      g.addColorStop(0.5, "#1c2b50");
      g.addColorStop(1, "#18244a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 细网格
      ctx.strokeStyle = "rgba(120,150,210,0.16)";
      ctx.lineWidth = 1;
      for (var x = 40; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      // 主网格
      ctx.strokeStyle = "rgba(130,160,220,0.28)";
      ctx.lineWidth = 1.6;
      for (var x2 = 200; x2 < w; x2 += 200) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h); ctx.stroke(); }
      for (var y2 = 200; y2 < h; y2 += 200) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(w, y2); ctx.stroke(); }
      // 边缘刻度
      ctx.fillStyle = "rgba(190,205,235,0.4)";
      ctx.font = "13px monospace";
      for (var t = 0; t < w; t += 100) ctx.fillText(String(t / 40 + 10), t + 4, 16);
      // 角标
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = "rgba(190,205,235,0.35)";
      ctx.fillText("LS-8 BENCH MAT · 60 x 40", 24, h - 20);
      ctx.fillText("MAT-A", w - 110, h - 20);
    });
  }

  /* PCB：基色 + 正交铜箔走线 + 环形过孔/焊点 + 丝印（主板附带位号） */
  function pcb(base, trace, silk) {
    return makeTex(512, 384, function (ctx, w, h) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      var seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      /* RF 段铺铜（接地铜箔） */
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, h * 0.62, w, h * 0.38);
      /* 正交走线 + 环形过孔 */
      ctx.strokeStyle = trace;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (var i = 0; i < 30; i++) {
        ctx.beginPath();
        var x = rnd() * w, y = rnd() * h;
        ctx.moveTo(x, y);
        for (var s = 0; s < 3; s++) {
          if (s % 2 === 0) x += (rnd() > 0.5 ? 1 : -1) * (50 + rnd() * 150);
          else y += (rnd() > 0.5 ? 1 : -1) * (35 + rnd() * 110);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = trace;
        ctx.beginPath(); ctx.arc(x, y, 4.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.arc(x, y, 2.0, 0, Math.PI * 2); ctx.fill();
      }
      /* 焊点（环） */
      for (var p = 0; p < 90; p++) {
        var px = rnd() * w, py2 = rnd() * h;
        ctx.fillStyle = trace;
        ctx.beginPath(); ctx.arc(px, py2, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.arc(px, py2, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      if (silk) {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "bold 30px monospace";
        ctx.fillText(silk, 22, 46);
        ctx.font = "15px monospace";
        ctx.fillText("REV B · 437.8 MHz", 22, 70);
      }
      if (silk === "LODESTAR") {
        /* 主板位号丝印：U/C/R/J/Y + 接地过孔排 */
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "bold 13px monospace";
        var tags = [
          ["U1 FPGA", 300, 96], ["U2 DDR3L", 388, 176], ["U3 CODEC", 240, 210],
          ["U4 LDO", 120, 200], ["U5 XO", 176, 250], ["Y1 27 MHZ", 60, 260],
          ["J1", 118, 330], ["J2", 212, 330], ["J3", 306, 330], ["J4", 400, 330],
          ["J8 USB", 468, 120], ["J11 PWR", 468, 250], ["JTAG J5", 350, 60]
        ];
        tags.forEach(function (t) { ctx.fillText(t[0], t[1], t[2]); });
        /* 去耦电容丝印 C1-C12 */
        ctx.font = "10px monospace";
        for (var c = 0; c < 12; c++) {
          ctx.fillText("C" + (c + 1), 268 + (c % 4) * 34, 140 + Math.floor(c / 4) * 18);
        }
        ctx.font = "10px monospace";
        for (var r6 = 0; r6 < 6; r6++) ctx.fillText("R" + (r6 + 1), 60 + r6 * 30, 150);
      }
    });
  }

  /* 便签纸（手写感） */
  function note(bg, ink, lines, rot) {
    return makeTex(256, 256, function (ctx, w, h) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, w, 26);
      ctx.save();
      ctx.translate(w / 2 + 6, 58);
      ctx.rotate(rot || -0.05);
      ctx.font = "italic 24px 'Marker Felt', 'Segoe Print', cursive";
      ctx.fillStyle = ink;
      lines.forEach(function (ln, i) {
        ctx.fillText(ln, -w / 2 + 16, i * 34);
      });
      ctx.restore();
    });
  }

  /* LED 数码管屏（红字） */
  function led(text) {
    return makeTex(512, 160, function (ctx, w, h) {
      ctx.fillStyle = "#140404";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2a0a08";
      for (var x = 14; x < w - 14; x += 58) ctx.fillRect(x, 20, 50, h - 40);
      if (text) {
        ctx.font = "bold 74px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(255,70,50,0.9)";
        ctx.shadowBlur = 22;
        ctx.fillStyle = "#ff4a38";
        ctx.fillText(text, w / 2, h / 2 + 4, w - 30);
      }
    });
  }

  /* 7寸触摸屏 UI（开机后） */
  function screenUI(freq) {
    return makeTex(512, 320, function (ctx, w, h) {
      ctx.fillStyle = "#0c1626";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(127,216,216,0.25)";
      ctx.lineWidth = 1;
      for (var x = 40; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, h - 50); ctx.stroke(); }
      for (var y = 30; y < h - 50; y += 40) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke(); }
      // 频谱线
      ctx.strokeStyle = "#7fd8d8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (var px = 10; px < w - 10; px++) {
        var d = Math.abs(px - w * 0.52) / 26;
        var v = 60 - d * 46 + Math.random() * 5;
        if (px === 10) ctx.moveTo(px, h - 50 - 8); else ctx.lineTo(px, h - 50 - Math.max(6, Math.min(210, v * 2.1)));
      }
      ctx.stroke();
      ctx.fillStyle = "#f0ead8";
      ctx.font = "bold 44px monospace";
      ctx.fillText(freq || "437.800 MHz", 26, 62);
      ctx.font = "16px monospace";
      ctx.fillStyle = "rgba(240,234,216,0.65)";
      ctx.fillText("LS-8 · RX1 · QPSK 96k · LOCK", 26, 92);
      ctx.fillStyle = "#e84f8e";
      ctx.beginPath();
      ctx.arc(w - 56, 52, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* 天空渐变背景 */
  function sky() {
    return makeTex(1024, 512, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, "#f6d9e8");
      g.addColorStop(0.35, "#f3e6d8");
      g.addColorStop(0.65, "#dfe6f2");
      g.addColorStop(1, "#e6e2f0");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      function blob(x, y, r, c) {
        var rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      blob(w * 0.16, h * 0.2, 240, "rgba(244,166,208,0.5)");
      blob(w * 0.8, h * 0.3, 260, "rgba(160,190,240,0.45)");
      blob(w * 0.5, h * 0.14, 200, "rgba(230,200,240,0.4)");
      blob(w * 0.3, h * 0.75, 220, "rgba(255,244,214,0.5)");
    });
  }

  LS8.Textures = {
    wood: wood,
    mat: mat,
    pcb: pcb,
    note: note,
    led: led,
    screenUI: screenUI,
    sky: sky,
    makeTex: makeTex
  };
})(window.LS8 = window.LS8 || {});
