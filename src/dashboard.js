/* 底部五仪表盘：频谱/瀑布 · IQ 星座 · GPSDO 时钟 · 电源轨 · FPGA */
(function (LS8) {
  var el = {};
  var ctxSpec, ctxIq, ctxClock;
  var wcan, wctx, rowcan, rowctx;      // 瀑布离屏
  var specW, specH, iqW, iqH, cw;
  var iqDots = [];
  var noiseFloor = [];

  function mkCanvas(id, h) {
    var c = document.getElementById(id);
    var w = c.clientWidth || 200;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr; c.height = h * dpr;
    c.style.height = h + "px";
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    return { cv: c, ctx: ctx, w: w, h: h };
  }

  function buildDOM() {
    var dash = document.getElementById("dash");
    dash.innerHTML =
      '<section class="panel"><header><i class="dot teal"></i><b>频谱</b><span class="meta">RX-1 · 1 MHZ SPAN</span></header>' +
      '<div class="body"><canvas id="c-spec"></canvas><div class="axis"><span>437.3 MHz</span><span>438.3 MHz</span></div></div></section>' +

      '<section class="panel"><header><i class="dot pink"></i><b>IQ 星座</b><span class="meta">QPSK · 96k</span></header>' +
      '<div class="body"><canvas id="c-iq"></canvas><div class="iq-stats">' +
      '<div class="r"><span>EVM</span><b id="iq-evm">—</b></div>' +
      '<div class="r"><span>RMS</span><b id="iq-rms">—</b></div>' +
      '<div class="r"><span>SNR</span><b id="iq-snr">—</b></div>' +
      '<div class="iq-packets"><div class="k">数据包 PACKETS</div><div class="v" id="iq-pk">000</div></div>' +
      '<div class="iq-chips"><span class="chip" id="ch-spa">扫描 SPA</span><span class="chip" id="ch-ter">跟踪 TER</span><span class="chip" id="ch-lock">锁定 LOCK</span></div>' +
      '</div></div></section>' +

      '<section class="panel"><header><i class="dot green"></i><b>时钟</b><span class="meta">GPSDO · 10 MHZ</span></header>' +
      '<div class="body"><div class="clk-bars">' + new Array(13).join("<i></i>") + '</div>' +
      '<div class="clk-right"><div class="clk-row"><canvas id="c-clock"></canvas><span>10 MHZ<br>REF OUT</span></div>' +
      '<div class="clk-row"><span>误差 ERROR</span><span id="clk-err">—— Hz</span></div>' +
      '<div class="clk-ppm"><div class="v" id="clk-ppm">0.0 <small>ppm</small></div></div>' +
      '<div class="clk-temp">温度 TEMP <b id="clk-temp">24.0</b> °C · <span id="clk-utc">UTC --:--:--</span></div>' +
      '</div></div></section>' +

      '<section class="panel"><header><i class="dot blue"></i><b>电源轨</b><span class="meta">5 SUPPLIES</span></header>' +
      '<div class="body"><div id="rail-rows"></div>' +
      '<div class="rails-foot"><div class="v" id="rail-w">0.00 <small>W</small></div><span class="chip" id="rail-chip">12V</span></div>' +
      '</div></section>' +

      '<section class="panel"><header><i class="dot orange"></i><b>FPGA</b><span class="meta">LS-FPGA 86K</span></header>' +
      '<div class="body"><div class="fpga-gauge">' +
      '<svg viewBox="0 0 84 66"><path d="M10 62 A32 32 0 0 1 74 62" fill="none" stroke="rgba(232,228,216,.14)" stroke-width="7" stroke-linecap="round"/>' +
      '<path id="fpga-arc" d="M10 62 A32 32 0 0 1 74 62" fill="none" stroke="#e84f8e" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 999"/>' +
      '</svg><div class="t" id="fpga-temp">31.0°</div></div>' +
      '<div class="fpga-right"><div class="fpga-count" id="fpga-count">0</div>' +
      '<div class="fpga-bars">' +
      '<div class="fbar"><span class="k">LUT</span><span class="bar"><i id="fb-lut"></i></span><span class="p" id="fp-lut">0%</span></div>' +
      '<div class="fbar"><span class="k">FF</span><span class="bar"><i id="fb-ff"></i></span><span class="p" id="fp-ff">0%</span></div>' +
      '<div class="fbar"><span class="k">DSP</span><span class="bar"><i id="fb-dsp"></i></span><span class="p" id="fp-dsp">0%</span></div>' +
      '<div class="fbar"><span class="k">BRAM</span><span class="bar"><i id="fb-bram"></i></span><span class="p" id="fp-bram">0%</span></div>' +
      '</div><div class="fpga-foot"><span id="fpga-up">UP 00:00.0</span><b id="fpga-seat">0 / 22 SEATED</b></div>' +
      '</div></div></section>';

    // 电源轨行
    var rows = document.getElementById("rail-rows");
    ["12V_3A", "5V", "3V3", "1V8", "VIO"].forEach(function (n, i) {
      var row = document.createElement("div");
      row.className = "rail-row";
      row.innerHTML = '<span class="name">' + n + '</span><span class="bar"><i id="rb-' + i + '"></i></span><span class="val" id="rv-' + i + '">0.00 V</span>';
      rows.appendChild(row);
    });

    // UTC 实时时间
    var d = new Date();
    document.getElementById("clk-utc").textContent = "UTC " +
      String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + ":" + String(d.getUTCSeconds()).padStart(2, "0");

    var spec = mkCanvas("c-spec", 80); specW = spec.w; specH = spec.h; ctxSpec = spec.ctx;
    wcan = document.createElement("canvas"); wcan.width = specW; wcan.height = 48; wctx = wcan.getContext("2d");
    rowcan = document.createElement("canvas"); rowcan.width = specW; rowcan.height = 1; rowctx = rowcan.getContext("2d");
    var iq = mkCanvas("c-iq", 80); iqW = iq.w; iqH = iq.h; ctxIq = iq.ctx;
    var clk = mkCanvas("c-clock", 40); cw = clk.w; ctxClock = clk.ctx;

    for (var i = 0; i < 140; i++) noiseFloor.push(Math.random() * 6 + 62);
  }

  function heat(v) {
    v = Math.max(0, Math.min(1, v));
    var stops = [[13, 27, 46], [26, 68, 140], [72, 170, 190], [214, 232, 230], [240, 120, 190]];
    var seg = v * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(seg));
    var f = seg - i;
    var a = stops[i], b = stops[i + 1];
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * f) + "," + Math.round(a[1] + (b[1] - a[1]) * f) + "," + Math.round(a[2] + (b[2] - a[2]) * f) + ")";
  }

  /* 频谱幅度曲线：返回 0..1 数组 */
  function spectrumLine(st) {
    var n = 140, out = [];
    for (var i = 0; i < n; i++) {
      var v = (noiseFloor[i] + Math.sin(i * 0.7 + performance.now() * 0.002) * 2) / 100;  // 底噪
      if (st.specPeak > 0) {
        var d = (i / n - st.specPeakPos);
        v += st.specPeak * Math.exp(-d * d / 0.00028);
      }
      if (st.specPeak > 0.2) {
        var d2 = (i / n - 0.82);
        v += st.specPeak * 0.12 * Math.exp(-d2 * d2 / 0.0012);
      }
      out.push(Math.max(0.03, Math.min(1, v)));
    }
    return out;
  }

  function drawSpectrum(st) {
    var ctx = ctxSpec, W = specW, H = specH;
    ctx.fillStyle = "#0c1626";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(127,216,216,0.14)";
    ctx.lineWidth = 1;
    for (var gx = 1; gx < 5; gx++) {
      ctx.beginPath(); ctx.moveTo(W * gx / 5, 0); ctx.lineTo(W * gx / 5, H); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(W, 30); ctx.stroke();

    var line = spectrumLine(st);
    // 频谱线（上部 30px）
    ctx.strokeStyle = "#7fd8d8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (var i = 0; i < line.length; i++) {
      var y = 30 - line[i] * 27;
      if (i === 0) ctx.moveTo(i / (line.length - 1) * W, y);
      else ctx.lineTo(i / (line.length - 1) * W, y);
    }
    ctx.stroke();

    // 瀑布：下移一行 + 顶行新数据
    if (st.power) {
      wctx.drawImage(wcan, 0, 0, W, 47, 0, 1, W, 47);
      for (var r = 0; r < W; r++) {
        rowctx.fillStyle = heat(line[Math.floor(r / W * line.length)] * (st.waterGain || 0));
        rowctx.fillRect(r, 0, 1, 1);
      }
      wctx.drawImage(rowcan, 0, 0);
      ctx.drawImage(wcan, 0, 31);
    } else {
      ctx.fillStyle = "#0a1220";
      ctx.fillRect(0, 31, W, H - 31);
    }
  }

  function drawIQ(st) {
    var ctx = ctxIq, W = iqW, H = iqH;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6;
    ctx.fillStyle = "#0c1626";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(240,106,168,0.2)";
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.strokeStyle = "rgba(240,106,168,0.13)";
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2); ctx.stroke();

    if (st.packetsActive) {
      var evmJit = st.evm / 100 * R * 1.05;
      var clusters = [[0.48, 0.48], [-0.48, 0.48], [0.48, -0.48], [-0.48, -0.48]];
      for (var k = 0; k < 7; k++) {
        var c = clusters[Math.floor(Math.random() * 4)];
        iqDots.push({
          x: cx + c[0] * R + (Math.random() - 0.5) * evmJit,
          y: cy + c[1] * R + (Math.random() - 0.5) * evmJit,
          age: 0
        });
      }
    }
    if (iqDots.length > 640) iqDots.splice(0, iqDots.length - 640);
    for (var i = 0; i < iqDots.length; i++) {
      var d = iqDots[i];
      d.age += 1;
      var a = Math.max(0, 1 - d.age / 110);
      if (a <= 0) continue;
      ctx.fillStyle = "rgba(240,106,168," + (a * 0.85).toFixed(2) + ")";
      ctx.fillRect(d.x, d.y, 1.8, 1.8);
    }
  }

  function drawClockFace(t) {
    var ctx = ctxClock, W = cw;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = "#f2eee2";
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#232830";
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * (W / 2 - 3), W / 2 + Math.sin(a) * (W / 2 - 3));
      ctx.lineTo(W / 2 + Math.cos(a) * (W / 2 - 6), W / 2 + Math.sin(a) * (W / 2 - 6));
      ctx.stroke();
    }
    var ha = (t * 1.6) % (Math.PI * 2);
    ctx.strokeStyle = "#e84f8e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, W / 2);
    ctx.lineTo(W / 2 + Math.cos(ha) * (W / 2 - 7), W / 2 + Math.sin(ha) * (W / 2 - 7));
    ctx.stroke();
  }

  var railsCfg = [
    { max: 12.0, col: "#5b8cff" }, { max: 6.0, col: "#5b8cff" }, { max: 4.0, col: "#7fd8d8" },
    { max: 2.5, col: "#7fd8d8" }, { max: 2.0, col: "#f06aa8" }
  ];

  function update(st, dt) {
    /* SPECTRUM */
    drawSpectrum(st);

    /* I/Q */
    drawIQ(st);
    document.getElementById("iq-evm").textContent = st.packetsActive ? st.evm.toFixed(1) + "%" : "—";
    document.getElementById("iq-rms").textContent = st.packetsActive ? st.rms.toFixed(2) : "—";
    document.getElementById("iq-snr").textContent = st.packetsActive ? st.snr.toFixed(1) + " dB" : "—";
    document.getElementById("iq-pk").textContent = String(Math.floor(st.packets)).padStart(3, "0");
    document.getElementById("ch-spa").className = "chip" + (st.mode === "SCAN" ? " on" : "");
    document.getElementById("ch-ter").className = "chip" + (st.mode === "TRACK" ? " on" : "");
    document.getElementById("ch-lock").className = "chip" + (st.mode === "LOCK" ? " lock" : "");

    /* CLOCK */
    drawClockFace(st.time);
    var bars = document.querySelectorAll(".clk-bars i");
    for (var i = 0; i < bars.length; i++) {
      var pat = [62, 78, 50, 85, 70, 44, 90, 66, 52, 80, 60, 74][i];
      var fill = st.power ? pat * Math.min(1, st.satFactor) : 0;
      if (!bars[i].firstChild) bars[i].appendChild(document.createElement("b"));
      bars[i].firstChild.style.height = fill + "%";
    }
    document.getElementById("clk-err").textContent = st.power ? (st.ppm >= 0 ? "+" : "") + (st.ppm * 10).toFixed(2) + " Hz" : "—— Hz";
    document.getElementById("clk-ppm").innerHTML = (st.power ? (st.ppm >= 0 ? "" : "") + Math.abs(st.ppm).toFixed(1) : "0.0") + " <small>ppm</small>";
    document.getElementById("clk-temp").textContent = st.temp.toFixed(1);

    /* RAILS */
    var vals = [st.rails.v12, st.rails.v5, st.rails.v33, st.rails.v18, st.rails.vio];
    vals.forEach(function (v, i) {
      document.getElementById("rb-" + i).style.width = (v / railsCfg[i].max * 100) + "%";
      document.getElementById("rb-" + i).style.background = railsCfg[i].col;
      document.getElementById("rv-" + i).textContent = (i === 4 ? v.toFixed(3) : v.toFixed(2)) + " V";
    });
    document.getElementById("rail-w").innerHTML = st.totalW.toFixed(2) + " <small>W</small>";
    document.getElementById("rail-chip").className = "chip" + (st.power ? " on" : "");

    /* FPGA */
    var frac = Math.max(0, Math.min(1, (st.fpgaTemp - 28) / 36));
    document.getElementById("fpga-arc").setAttribute("stroke-dasharray", (frac * 100.5) + " 999");
    document.getElementById("fpga-temp").textContent = st.fpgaTemp.toFixed(1) + "°";
    document.getElementById("fpga-count").textContent = String(Math.floor(st.fpgaCount)).padStart(4, "0");
    var fbars = { lut: st.lut, ff: st.ff, dsp: st.dsp, bram: st.bram };
    Object.keys(fbars).forEach(function (k) {
      document.getElementById("fb-" + k).style.width = fbars[k] + "%";
      document.getElementById("fp-" + k).textContent = Math.round(fbars[k]) + "%";
    });
    var up = st.up || 0;
    var mm = String(Math.floor(up / 60)).padStart(2, "0");
    var ss = String(Math.floor(up % 60)).padStart(2, "0");
    var ds = Math.floor((up % 1) * 10);
    document.getElementById("fpga-up").textContent = "运行 " + mm + ":" + ss + "." + ds;
    var seat = document.getElementById("fpga-seat");
    seat.textContent = "已就位 " + st.seated + " / 22";
    seat.style.color = st.seated >= 22 ? "#e9c93c" : "rgba(232,228,216,.55)";
  }

  LS8.Dashboard = { build: buildDOM, update: update };
})(window.LS8 = window.LS8 || {});
