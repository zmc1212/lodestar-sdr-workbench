/* 时间线：装配 → 布线 → 上电 → 调谐 → 扫描 → 跟踪 → 锁定 → 归位（循环） */
(function (LS8) {
  var phases = [
    { id: "assembly", name: "整机装配 · LS-8 SDR", dur: 16.4, dot: "yellow",
      cam: { theta: -0.62, phi: 0.96, r: 8.2, target: [0, 0.25, 0] }, drift: 0.045 },
    { id: "cabling", name: "布线连接 · PORT TO PORT", dur: 4.6, dot: "teal",
      cam: { theta: -0.95, phi: 0.88, r: 6.2, target: [-0.5, 0.2, 0.3] }, drift: 0.02 },
    { id: "power", name: "上电 · 13.5V 输入 → 12V 电源轨", dur: 2.8, dot: "green",
      cam: { theta: -0.7, phi: 0.85, r: 4.4, target: [0.62, 0.25, 0.12] }, drift: 0.015 },
    { id: "tune", name: "调谐 · 数码显示 · PMOD", dur: 3.2, dot: "blue",
      cam: { theta: -1.3, phi: 0.98, r: 3.6, target: [0.3, 0.15, 1.25] }, drift: 0.012 },
    { id: "scan", name: "频谱扫描 · 射频前端", dur: 3.0, dot: "blue",
      cam: { theta: -0.45, phi: 0.85, r: 4.8, target: [-1.2, 0.15, 0.3] }, drift: 0.02 },
    { id: "track", name: "卫星跟踪 · FPGA · DDR3L · JTAG", dur: 3.0, dot: "blue",
      cam: { theta: -1.9, phi: 0.88, r: 4.0, target: [0.9, 0.2, -0.1] }, drift: 0.012 },
    { id: "lock", name: "载波锁定 · PATCH · FILTER · LNA · GPS", dur: 3.2, dot: "pink",
      cam: { theta: -2.6, phi: 0.95, r: 4.4, target: [-2.0, 0.15, 0.8] }, drift: 0.015 },
    { id: "home", name: "零件归位", dur: 5.4, dot: "yellow",
      cam: { theta: -0.62, phi: 0.98, r: 8.6, target: [0, 0.25, 0] }, drift: 0.03 }
  ];

  var PINNED = {
    cabling: function () {
      return [
        { id: "p-led", obj: LS8.Parts.group("led"), text: "8 位数码管 · PMOD", sub: "8 DIGIT · PMOD" },
        { id: "p-enc", obj: LS8.Parts.group("encoder"), text: "调谐编码器 · 波段旋钮", sub: "ENCODER · BAND DIAL" },
        { id: "p-lg8", obj: LS8.Parts.group("logic8"), text: "触发 · PPS · 8 通道", sub: "TRIGGER · PPS · 8 CH", tone: "white" }
      ];
    },
    power: function () {
      return [{ id: "p-board", obj: LS8.Scene3D.board, text: "13.5V 输入 → 12V 电源轨", sub: "13.5V IN → 12V RAIL" }];
    },
    tune: function () {
      return [
        { id: "p-led", obj: LS8.Parts.group("led"), text: "数码管 · 437 MHZ", sub: "8 DIGIT · 437 MHZ" },
        { id: "p-enc", obj: LS8.Parts.group("encoder"), text: "调谐 · 10.2 PPM", sub: "TUNE · 10.2 PPM", tone: "white" }
      ];
    },
    scan: function () {
      return [
        { id: "p-lg8", obj: LS8.Parts.group("logic8"), text: "逻辑分析仪 · 24 MS/S", sub: "LOGIC 8 · 24 MS/S" },
        { id: "p-mtr", obj: LS8.Parts.group("meter"), text: "万用表 · 12V 轨", sub: "METER · 12 V RAIL", tone: "white" }
      ];
    },
    track: function () {
      return [
        { id: "p-board", obj: LS8.Scene3D.board, text: "主控芯片 · FPGA + DDR3L", sub: "FPGA · DDR3L · JTAG" },
        { id: "p-tch", obj: LS8.Parts.group("touch"), text: "JTAG 排线 · 至调试器", sub: "JTAG · RIBBON TO POD", tone: "white" }
      ];
    },
    lock: function () {
      return [
        { id: "p-ptc", obj: LS8.Parts.group("patch"), text: "贴片天线 · RHCP · 7 dBic", sub: "PATCH · RHCP · 7 DBIC" },
        { id: "p-cav", obj: LS8.Parts.group("cavity"), text: "腔体滤波器 · 5 阶", sub: "CAVITY BPF · 5 POLE" },
        { id: "p-lna", obj: LS8.Parts.group("lna"), text: "低噪放 · NF 0.6 dB", sub: "LNA · NF 0.6 DB" }
      ];
    }
  };

  var state = {};
  var idx = -1, pt = 0, cycleT = 0, paused = false;
  var powerOnAt = -1, packetsOnAt = -1, ledLast = "";
  var dom = {};

  function resetState() {
    state = {
      time: 0, power: false, powerT: 0,
      freq: 100.0, mode: "BAND", dop: 0,
      parts: 0, seated: 0,
      packets: 0, packetsActive: false, evm: 30, snr: 9.2, rms: 0.78,
      ppm: 0, temp: 24, satFactor: 0,
      rails: { v12: 0, v5: 0, v33: 0, v18: 0, vio: 0 }, totalW: 0,
      fpgaTemp: 31, fpgaCount: 0, lut: 0, ff: 0, dsp: 0, bram: 0,
      up: 0, specPeak: 0, specPeakPos: 0.5, waterGain: 0
    };
    powerOnAt = -1; packetsOnAt = -1; ledLast = "";
  }

  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    dom = {
      mode: $("st-mode"), freq: $("st-freq"), dop: $("st-dop"), parts: $("st-parts"),
      pill: $("phase-text"), dot: $("phase-dot")
    };
  }

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  var PHASE_SFX = { cabling: "insert", power: "power", lock: "chime", home: "whoosh" };

  /* 状态卡 MODE 显示文案（逻辑态 state.mode 仍为英文代号，比较逻辑不变） */
  var MODE_TXT = { BAND: "频段 BAND", SCAN: "扫描 SCAN", TRACK: "跟踪 TRACK", LOCK: "锁定 LOCK" };

  function enterPhase(i) {
    idx = i; pt = 0;
    var ph = phases[i];
    if (ph.id === "assembly") {
      LS8.Parts.begin(0);
      LS8.Labels.clearAnnounce();
    } else if (ph.id === "cabling") {
      LS8.Cables.begin(0);
    } else if (ph.id === "power") {
      state.power = true;
      powerOnAt = state.time;
      LS8.Parts.setScreensOn(true);
      LS8.Parts.setLedOn(true);
      LS8.Scene3D.setFanSpeed(9);
    } else if (ph.id === "tune") {
      state.mode = "BAND";
    } else if (ph.id === "scan") {
      state.mode = "SCAN";
      state.packetsActive = true;
      packetsOnAt = state.time;
    } else if (ph.id === "track") {
      state.mode = "TRACK";
    } else if (ph.id === "lock") {
      state.mode = "LOCK";
    } else if (ph.id === "home") {
      LS8.Parts.flyOut(0);
    }
    if (LS8.Audio && PHASE_SFX[ph.id]) LS8.Audio.play(PHASE_SFX[ph.id]);
    var pins = PINNED[ph.id];
    LS8.Labels.setPinned(pins ? pins() : []);
  }

  function restartCycle() {
    LS8.Parts.reset();
    LS8.Cables.reset();
    LS8.Labels.clearAnnounce();
    LS8.Scene3D.setFanSpeed(0);
    resetState();
    cycleT = 0;
    enterPhase(0);
  }

  function update(dt) {
    if (paused) return;
    dt = Math.min(dt, 0.05);
    state.time += dt;
    cycleT += dt;
    pt += dt;

    var ph = phases[idx];
    if (pt >= ph.dur) {
      if (idx >= phases.length - 1) restartCycle();
      else enterPhase(idx + 1);
      ph = phases[idx];
    }

    /* ---- 相机 ---- */
    LS8.orbitCtl.autoDrift = ph.drift;
    LS8.orbitCtl.flyTo(ph.cam);

    /* ---- 零件 / 布线 ---- */
    LS8.Parts.update(pt);
    LS8.Cables.update(pt);
    state.seated = LS8.Parts.seatedCount;
    state.parts = state.seated;

    /* ---- 上电斜坡 ---- */
    if (state.power) {
      state.powerT = Math.min(1, state.powerT + dt / 1.7);
      state.up += dt;
    }
    var e = smooth(state.powerT);
    state.rails.v12 = 11.99 * e;
    state.rails.v5 = 5.01 * smooth(state.powerT * 1.5 - 0.06);
    state.rails.v33 = 3.30 * smooth(state.powerT * 1.7 - 0.12);
    state.rails.v18 = 1.80 * smooth(state.powerT * 1.8 - 0.18);
    state.rails.vio = 1.000 * smooth(state.powerT * 2 - 0.24);
    var flutter = Math.sin(state.time * 2.3) * 0.12 + Math.sin(state.time * 5.1) * 0.06;
    state.totalW = state.power
      ? state.rails.v12 * 0.42 + state.rails.v5 * 0.55 + state.rails.v33 * 0.6 + state.rails.v18 * 0.8 + state.rails.vio * 0.45 + flutter * e
      : 0;

    /* ---- GPSDO 时钟（锁定后 <0.01 ppm，OCXO 按真实暖机速率爬温） ---- */
    if (state.power) {
      var tp = state.time - powerOnAt;
      var settle = Math.exp(-tp / 1.35);
      state.ppm = 119 * settle + 0.006 * (1 - settle) + Math.sin(state.time * 0.8) * 0.003;
      state.temp = 24 + 26 * smooth(tp / 160);
      state.satFactor = Math.min(1, Math.max(0, (tp - 0.5) / 2.5));
    } else { state.ppm = 0; state.temp = 24; state.satFactor = 0; }

    /* ---- 调谐 / 扫描 / 数据包 ---- */
    if (ph.id === "tune") {
      var f0 = 100.0, f1 = 437.8;
      state.freq = f0 + (f1 - f0) * smooth(pt / 2.4);
      var ledTxt = state.freq.toFixed(4);
      if (ledTxt !== ledLast) {
        ledLast = ledTxt;
        LS8.Parts.setLedText(ledTxt);
      }
    }
    if (ph.id === "scan" || ph.id === "track" || ph.id === "lock") {
      var ramp = ph.id === "scan" ? smooth(pt / 1.4) : 1;
      state.specPeak = 0.92 * ramp;
      state.waterGain = Math.min(1, state.waterGain + dt * 0.5);
      if (state.mode !== "LOCK" && ph.id === "lock") state.mode = "LOCK";
      /* LEO 过境多普勒：437.8 MHz 时 ±10 kHz 量级，谱峰随之漂移 */
      state.dop = state.mode === "LOCK" ? Math.sin(state.time * 0.7) * 9600
        : (ph.id === "track" ? Math.sin(state.time * 0.7) * 9600 * smooth(pt / 3) : 0);
      state.freq = 437.8 + state.dop / 1e6;
      state.specPeakPos = 0.5 + (state.freq - 437.8) / 1.0;  // 1 MHz 跨度
    }
    if (state.packetsActive) {
      var rate = ph.id === "scan" ? 0.8 : (ph.id === "track" ? 2.2 : 3.4);
      state.packets += rate * dt;
      var tpk = state.time - packetsOnAt;
      state.snr = 9.2 + 3.4 * smooth(tpk / 4);
      /* EVM 与 SNR 物理一致（QPSK：EVM% ≈ √(10^(−SNR/10))×100） */
      state.evm = Math.sqrt(Math.pow(10, -state.snr / 10)) * 100 + Math.sin(state.time * 1.3) * 0.3;
      state.rms = 0.78 + Math.sin(state.time * 0.7) * 0.02;
    }

    /* ---- FPGA ---- */
    if (state.power) {
      var tg = smooth((state.time - powerOnAt - 1.5) / 4);
      state.lut = 64 * tg; state.ff = 41 * tg; state.dsp = 57 * tg; state.bram = 57 * tg;
      if (ph.id === "track" || ph.id === "lock") state.fpgaTemp = Math.min(57, state.fpgaTemp + dt * 9);
      if (state.packetsActive) state.fpgaCount += (ph.id === "lock" ? 820 : 460) * dt;
    }

    /* ---- DOM 状态卡 / 阶段胶囊 ---- */
    dom.mode.textContent = state.power || idx > 1 ? (MODE_TXT[state.mode] || state.mode) : MODE_TXT.BAND;
    dom.mode.className = "mode" + (state.mode === "LOCK" ? " lock" : "");
    dom.freq.textContent = (ph.id === "tune" || state.mode === "SCAN" || state.mode === "TRACK" || state.mode === "LOCK")
      ? state.freq.toFixed(3) + " MHz" : "—";
    dom.dop.textContent = state.dop ? (state.dop >= 0 ? "+" : "") + (state.dop / 1000).toFixed(2) + " kHz" : "— kHz";
    dom.parts.textContent = state.parts + " / 22";
    var label = ph.name;
    if (ph.id === "assembly") label = "整机装配 · " + state.parts + " / 22";
    dom.pill.textContent = label;
    dom.dot.className = ph.dot;

    /* ---- 仪表盘 ---- */
    LS8.Dashboard.update(state, dt);
  }

  LS8.Timeline = {
    init: function () {
      resetState();
      cacheDom();
    },
    start: function () {
      enterPhase(0);
    },
    restart: restartCycle,
    /* 跳转到指定阶段（调试 / 键盘 1-8） */
    seek: function (id) {
      var i = -1;
      for (var k = 0; k < phases.length; k++) if (phases[k].id === id) i = k;
      if (i < 0) return;
      LS8.Parts.reset();
      LS8.Cables.reset();
      LS8.Labels.clearAnnounce();
      LS8.Scene3D.setFanSpeed(0);
      resetState();
      if (i >= 1) { LS8.Parts.begin(0); LS8.Parts.sealAll(); }
      if (i >= 2) LS8.Cables.completeAll();
      if (i >= 3) {
        state.power = true;
        state.powerT = 1;
        powerOnAt = 0;
        LS8.Parts.setScreensOn(true);
        LS8.Parts.setLedOn(true);
        LS8.Scene3D.setFanSpeed(9);
        LS8.Parts.setLedText("437.8000");
        ledLast = "437.8000";
        state.freq = 437.8;
      }
      if (i >= 4) { state.packetsActive = true; packetsOnAt = 0; }
      enterPhase(i);
    },
    update: update,
    togglePause: function () { paused = !paused; return paused; },
    get paused() { return paused; },
    get phaseId() { return phases[idx] ? phases[idx].id : ""; }
  };
})(window.LS8 = window.LS8 || {});
