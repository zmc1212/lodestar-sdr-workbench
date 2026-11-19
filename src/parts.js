/* 22 个零件建模 + 飞行装配控制器 */
(function (LS8) {
  var list = [];          // {id,name,sub,group,delay,start,mid,pos,yaw,line,dur}
  var root = null;
  var seatedCount = 0;
  var flying = false, phaseOut = false;
  var t0 = 0;

  /* LED 数码管动态贴图 */
  var ledCv = document.createElement("canvas");
  ledCv.width = 512; ledCv.height = 160;
  var ledTex = new THREE.CanvasTexture(ledCv);
  ledTex.anisotropy = 8;
  ledTex.encoding = THREE.sRGBEncoding;
  function drawLed(text) {
    var ctx = ledCv.getContext("2d");
    ctx.fillStyle = "#160505";
    ctx.fillRect(0, 0, 512, 160);
    for (var x = 14; x < 498; x += 58) { ctx.fillStyle = "#2a0a08"; ctx.fillRect(x, 20, 50, 120); }
    if (text) {
      ctx.font = "bold 72px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(255,70,50,0.95)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#ff4a38";
      ctx.fillText(text, 256, 84, 480);
      ctx.shadowBlur = 0;
    }
    ledTex.needsUpdate = true;
  }

  /* 万用表屏幕贴图 */
  var meterCv = document.createElement("canvas");
  meterCv.width = 128; meterCv.height = 80;
  var meterTex = new THREE.CanvasTexture(meterCv);
  meterTex.encoding = THREE.sRGBEncoding;
  function drawMeter(text) {
    var ctx = meterCv.getContext("2d");
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, 128, 80);
    if (text) {
      ctx.font = "bold 34px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#d8e6c8";
      ctx.fillText(text, 64, 42);
    }
    meterTex.needsUpdate = true;
  }

  /* 触摸屏贴图 */
  var touchOffTex = LS8.Textures.makeTex(256, 160, function (ctx) {
    ctx.fillStyle = "#0a0f18";
    ctx.fillRect(0, 0, 256, 160);
  });
  var touchOnTex = LS8.Textures.screenUI("437.800 MHz");
  var touchScreenMat = new THREE.MeshStandardMaterial({ map: touchOffTex, roughness: 0.3, metalness: 0.1 });

  function setAnchor(g, y) {
    g.userData.tagAnchor = new THREE.Vector3(0, y, 0);
  }

  /* ============ 零件建模 ============ */
  function build() {
    var M = LS8.Scene3D.M, mesh = LS8.Scene3D.mesh;
    var defs = [];

    function def(id, name, sub, pos, yaw, anchorY, buildFn, delay) {
      var g = buildFn();
      g.position.set(pos[0], 0.093, pos[1]);
      g.rotation.y = yaw || 0;
      setAnchor(g, anchorY);
      root.add(g);
      defs.push({ id: id, name: name, sub: sub, group: g, pos: pos, yaw: yaw || 0, anchorY: anchorY, delay: delay });
    }

    /* 1 · 7W 扬声器 */
    def("speaker", "扬声器", "7W SPEAKER", [-2.05, -1.35], 0.15, 0.34, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.13, 28), M.plastic, 0, 0.065, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 28), M.dark, 0, 0.14, 0));
      g.add(mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.dark, 0, 0.15, 0));
      g.add(mesh(new THREE.TorusGeometry(0.27, 0.02, 10, 28), M.dark, 0, 0.135, 0).rotateX(Math.PI / 2));
      return g;
    }, 0);

    /* 2 · ADC 板（AD9226，中频 10.7 MHz 采样） */
    def("adc", "ADC 采样板 · 56 MS/s", "AD9226 · IF 10.7 MHZ", [-0.85, -1.6], 0.32, 0.3, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.52, 0.035, 0.36), M.purple));
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), M.chip, -0.1, 0.04, 0));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.035, 0.1), M.chip, 0.14, 0.035, 0.08));
      for (var i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), M.gold, 0.2 - i * 0.05, 0.045, -0.12));
      return g;
    }, 1);

    /* 3 · GPS 时钟模块 */
    def("gpsclk", "GPS 时钟模块", "GPS CLOCK · OCXO 10 MHZ", [-1.5, -0.85], -0.2, 0.28, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.56, 0.035, 0.4), M.green));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.13, 0.14), M.silver, -0.12, 0.08, 0));
      g.add(mesh(new THREE.BoxGeometry(0.12, 0.035, 0.1), M.chip, 0.14, 0.035, -0.08));
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10), M.gold, 0.22, 0.04, 0.1));
      return g;
    }, 2);

    /* 4 · OCXO 恒温晶振 */
    def("ocxo", "恒温晶振 · 10 MHZ", "OCXO · WARM 3 MIN", [-2.5, -0.4], 0.1, 0.26, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.32, 0.16, 0.22), M.alu));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), M.silver, 0, 0.09, 0));
      return g;
    }, 3);

    /* 5 · 7寸触摸屏 */
    def("touch", '7 寸触摸屏', '7" TOUCH · PMOD', [1.95, -1.3], -0.32, 0.3, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.88, 0.05, 0.52), M.plastic));
      var scr = mesh(new THREE.PlaneGeometry(0.78, 0.42), touchScreenMat, 0, 0.028, -0.01, false);
      scr.rotation.x = -Math.PI / 2;
      g.add(scr);
      return g;
    }, 4);

    /* 6 · 8位数码管显示 */
    var ledFaceMat = new THREE.MeshStandardMaterial({ map: ledTex, emissiveMap: ledTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
    def("led", "8 位数码管", "8 DIGIT · LED · 437.800", [-0.35, 1.25], 0.12, 0.3, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.64, 0.035, 0.24), M.blue));
      var mod = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.16),
        [M.plastic, M.plastic, M.plastic, M.plastic, ledFaceMat, M.plastic]);
      mod.position.set(0, 0.085, 0);
      mod.castShadow = true;
      g.add(mod);
      return g;
    }, 5);

    /* 7 · 调谐编码器 */
    def("encoder", "调谐编码器", "TUNE ENCODER · BAND DIAL", [0.95, 1.3], -0.15, 0.26, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.16), M.blue));
      g.add(mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.14, 20), M.plastic, 0, 0.1, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M.silver, 0, 0.175, 0));
      return g;
    }, 6);

    /* 8 · 偶极天线 */
    def("dipole", "偶极天线", "DIPOLE ANTENNA · 2M", [-3.1, -1.0], 0.5, 0.72, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.035, 0.14), M.green));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), M.plastic, 0, 0.06, 0));
      var l1 = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), M.copper, -0.18, 0.34, 0);
      l1.rotation.z = 0.28;
      var l2 = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), M.copper, 0.18, 0.34, 0);
      l2.rotation.z = -0.28;
      g.add(l1); g.add(l2);
      return g;
    }, 7);

    /* 9 · GPS 贴片天线 */
    def("patch", "贴片天线", "PATCH · RHCP · 7 DBIC", [-2.85, 0.4], -0.1, 0.22, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.3), M.green));
      g.add(mesh(new THREE.BoxGeometry(0.17, 0.014, 0.17), M.yellow, 0, 0.025, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), M.gold, 0.12, 0.03, 0.12));
      return g;
    }, 8);

    /* 10 · 腔体滤波器 */
    def("cavity", "腔体滤波器", "CAVITY BPF · 5 POLE", [-1.8, 0.6], 0.08, 0.3, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.64, 0.2, 0.3), M.alu, 0, 0.1, 0));
      for (var i = 0; i < 5; i++) {
        g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), M.gold, -0.24 + i * 0.12, 0.23, 0));
      }
      return g;
    }, 9);

    /* 11 · 二功分器 */
    def("splitter", "二功分器", "2 WAY SPLITTER · 50 Ω", [-1.0, 0.45], -0.25, 0.2, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.2), M.alu, 0, 0.05, 0));
      var p1 = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 10), M.gold, 0, 0.12, 0);
      var p2 = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 10), M.gold, -0.1, 0.1, 0.08).rotateX(Math.PI / 2).rotateZ(0);
      p2.rotation.set(Math.PI / 2, 0, 0);
      p2.position.set(-0.1, 0.08, 0.1);
      var p3 = p2.clone(); p3.position.set(0.1, 0.08, 0.1);
      g.add(p1); g.add(p2); g.add(p3);
      return g;
    }, 10);

    /* 12 · 50Ω 假负载 */
    def("load", "假负载", "50 Ω LOAD · 2W", [-0.45, 0.75], 0.2, 0.18, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.04, 16), M.silver, 0, 0.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.085, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.plastic, 0, 0.04, 0));
      return g;
    }, 11);

    /* 13 · LNA 模块 */
    def("lna", "低噪声放大器", "LNA · NF 0.6 DB", [-2.35, 1.35], 0.18, 0.18, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.42, 0.1, 0.26), M.silver, 0, 0.05, 0));
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.18), M.blue, 0, 0.11, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 10), M.gold, -0.2, 0.06, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 10), M.gold, 0.2, 0.06, 0));
      return g;
    }, 12);

    /* 14 · 衰减器 */
    def("pad", "衰减器 · 20 dB", "20 DB PAD · 50 Ω", [-1.25, 1.5], -0.4, 0.16, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.1), M.alu, 0, 0.04, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), M.gold, -0.1, 0.05, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 8), M.gold, 0.1, 0.05, 0));
      return g;
    }, 13);

    /* 15 · Logic 8 逻辑分析仪 */
    var wireCols = [0xe84f8e, 0xf2a53a, 0xf5e04b, 0x7fd8d8, 0x5b8cff, 0x8b5fd0, 0x57c46b, 0xe8e4da];
    def("logic8", "逻辑分析仪", "LOGIC 8 · 24 MS/S", [1.6, 1.6], 0.35, 0.18, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.32, 0.09, 0.2), M.plastic, 0, 0.05, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), M.gold, 0, 0.101, 0));
      for (var i = 0; i < 8; i++) {
        var w = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6),
          new THREE.MeshStandardMaterial({ color: wireCols[i], roughness: 0.7 }),
          -0.12 + i * 0.034, 0.16, 0.12);
        w.rotation.x = -0.5;
        w.rotation.z = (i - 3.5) * 0.1;
        g.add(w);
      }
      return g;
    }, 14);

    /* 16 · 万用表 */
    var meterScreenMat = new THREE.MeshStandardMaterial({ map: meterTex, roughness: 0.35 });
    def("meter", "万用表", "METER · 12 V RAIL", [2.6, 0.7], -0.55, 0.42, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.55, 0.09), M.yellow, 0, 0.275, 0));
      g.add(mesh(new THREE.BoxGeometry(0.34, 0.05, 0.09), M.dark, 0, 0.525, 0));
      var scr = mesh(new THREE.PlaneGeometry(0.2, 0.14), meterScreenMat, 0, 0.42, 0.048, false);
      g.add(scr);
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 18), M.dark, 0, 0.18, 0.05).rotateX(Math.PI / 2));
      var probeR = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), M.plastic, 0.2, 0.1, -0.05);
      probeR.rotation.z = -1.2;
      g.add(probeR);
      var probeK = probeR.clone(); probeK.position.set(-0.2, 0.08, 0.02); probeK.material = new THREE.MeshStandardMaterial({ color: 0x8c2f1e, roughness: 0.6 });
      g.add(probeK);
      return g;
    }, 15);

    /* 17 · 跳线卷轴 */
    def("spool", "杜邦跳线", "JUMPER WIRES ×140", [-1.95, 1.95], 0.4, 0.3, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.15, 22), M.plastic, 0, 0.08, 0));
      var coil = mesh(new THREE.TorusGeometry(0.19, 0.045, 10, 30), new THREE.MeshStandardMaterial({ color: 0xd98a2b, roughness: 0.75 }), 0, 0.17, 0);
      coil.rotation.x = Math.PI / 2;
      g.add(coil);
      return g;
    }, 16);

    /* 18 · 电烙铁 */
    def("iron", "电烙铁", "SOLDER IRON · 380°C", [-0.5, 2.05], 1.15, 0.16, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.18), M.plastic, 0.3, 0.03, 0));
      var handle = mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.34, 12), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.7 }), 0.05, 0.06, 0);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      var tip = mesh(new THREE.ConeGeometry(0.02, 0.12, 8), M.copper, -0.15, 0.06, 0);
      tip.rotation.z = -Math.PI / 2;
      g.add(tip);
      return g;
    }, 17);

    /* 19 · 放大镜台灯 */
    def("lamp", "放大镜台灯", "MAG LAMP", [-3.15, 1.85], 0.7, 0.75, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), M.plastic, 0, 0.02, 0));
      var a1 = mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), M.dark, 0, 0.27, 0);
      var a2 = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), M.dark, 0.14, 0.55, 0);
      a2.rotation.z = -0.5;
      g.add(a1); g.add(a2);
      var head = mesh(new THREE.TorusGeometry(0.12, 0.03, 10, 26), M.white, 0.34, 0.7, 0);
      head.rotation.x = Math.PI / 2.4;
      g.add(head);
      return g;
    }, 18);

    /* 20 · 螺丝盒 */
    def("tray", "螺丝盒", "SCREWS · M2 · M3", [-1.4, 2.0], -0.2, 0.16, function () {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.1, 20), M.plastic, 0, 0.05, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), M.dark, 0, 0.1, 0));
      for (var i = 0; i < 7; i++) {
        var s = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), M.silver,
          (Math.random() - 0.5) * 0.22, 0.12, (Math.random() - 0.5) * 0.22);
        s.rotation.z = Math.PI / 2 + (Math.random() - 0.5);
        g.add(s);
      }
      return g;
    }, 19);

    /* 21 · 粉色便签 */
    def("note1", "粉色便签", "STICKY NOTE · CORNER", [-2.7, -1.65], 0.35, 0.1, function () {
      var g = new THREE.Group();
      var p = mesh(new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshStandardMaterial({ map: LS8.Textures.note("#f6c6dc", "#8c2f5e", ["LNA 5V from J11", "NOT the 12V rail!", "dip 2 + BPF", "NF 0.6 dB"], -0.06), roughness: 0.9, side: THREE.DoubleSide }), 0, 0.006, 0, true, true);
      p.rotation.x = -Math.PI / 2;
      g.add(p);
      return g;
    }, 20);

    /* 22 · 白+蓝+黄便签组 */
    def("note2", "便签组 ×3", "NOTES ×3", [0.5, 1.85], -0.18, 0.12, function () {
      var g = new THREE.Group();
      var mk = function (bg, ink, lines, dx, dz, rot, w) {
        var p = mesh(new THREE.PlaneGeometry(w, w),
          new THREE.MeshStandardMaterial({ map: LS8.Textures.note(bg, ink, lines, rot / 2), roughness: 0.9, side: THREE.DoubleSide }), dx, 0.006, dz, true, true);
        p.rotation.x = -Math.PI / 2;
        p.rotation.z = rot;
        g.add(p);
      };
      mk("#f7f4e8", "#35528c", ["LNA 5 V from J11", "OSCS on LOS 437.800", "UTC 14:30:15.8"], 0, 0, 0.06, 0.5);
      mk("#cfe0f4", "#8c2f1e", ["buy SMA torque w", "check 12V 1.9 A"], 0.3, 0.12, 0.5, 0.36);
      mk("#f3e6a8", "#35528c", ["REF 10M → J8", "OCXO lock < 1 ppm"], -0.24, 0.28, -0.4, 0.42);
      return g;
    }, 21);

    return defs;
  }

  /* ============ 飞行控制 ============ */
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function init() {
    root = new THREE.Group();
    LS8.Scene3D.scene.add(root);
    drawLed(null);
    drawMeter(null);
    list = build();
    list.forEach(function (p, i) {
      p.duration = 1.15;
      p.startIndex = i;
      // 飞行起点（画面左侧外）
      p.start = new THREE.Vector3(-7.8 - (i % 4) * 0.5, 0.6 + (i % 5) * 0.42, -1.6 + ((i * 37) % 17) / 9);
      p.target = p.group.position.clone();
      p.mid = new THREE.Vector3(
        p.start.x + (p.target.x - p.start.x) * 0.42,
        1.9 + (i % 3) * 0.35,
        p.start.z + (p.target.z - p.start.z) * 0.55 - 0.3
      );
      p.group.visible = false;
    });
  }

  function bez(p0, p1, p2, t) {
    var a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    return new THREE.Vector3(
      a * p0.x + b * p1.x + c * p2.x,
      a * p0.y + b * p1.y + c * p2.y,
      a * p0.z + b * p1.z + c * p2.z
    );
  }

  function begin(now) {
    flying = true; phaseOut = false; seatedCount = 0;
    t0 = now;
    list.forEach(function (p) {
      p.sealed = false;
      p.landed = false; p.tagShown = false;
      p.group.visible = false;
      if (p.line) { p.line.material.dispose(); LS8.Scene3D.scene.remove(p.line); }
      // 虚线轨迹
      var pts = [];
      for (var i = 0; i <= 30; i++) pts.push(bez(p.start, p.mid, p.target, i / 30));
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var line = new THREE.Line(geo, new THREE.LineDashedMaterial({
        color: 0xff7ab8, dashSize: 0.11, gapSize: 0.075, transparent: true, opacity: 0.8
      }));
      line.computeLineDistances();
      LS8.Scene3D.scene.add(line);
      p.line = line;
      p.lineUntil = Infinity;
    });
  }

  function flyOut(now) {
    if (!flying) return;
    phaseOut = true;
    t0 = now;
    list.forEach(function (p, i) {
      p.outDelay = i * 0.13;
      p.outDone = false;
      // 反向轨迹：抬升后飞向左侧
      p.outMid = new THREE.Vector3(p.target.x - 2.2, 2.4, p.target.z - 0.6);
      p.outStart = p.target.clone();
      var pts = [];
      for (var k = 0; k <= 30; k++) pts.push(bez(p.outStart, p.outMid, p.start, k / 30));
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var line = new THREE.Line(geo, new THREE.LineDashedMaterial({
        color: 0xff7ab8, dashSize: 0.11, gapSize: 0.075, transparent: true, opacity: 0.6
      }));
      line.computeLineDistances();
      LS8.Scene3D.scene.add(line);
      p.outLine = line;
    });
  }

  function update(now) {
    if (!flying) return;
    list.forEach(function (p) {
      if (p.sealed) return;
      if (!phaseOut) {
        var t = (now - t0 - p.delay * 0.62) / p.duration;
        if (t <= 0) return;
        if (!p.tagShown) {
          p.tagShown = true;
          p.group.visible = true;
          LS8.Labels.announce(p.id, p.group, p.name, p.sub, performance.now(), 2600);
        }
        var tt = easeInOut(Math.min(t, 1));
        var pos = bez(p.start, p.mid, p.target, tt);
        p.group.position.copy(pos);
        p.group.rotation.y = p.yaw + (1 - tt) * 1.4;
        if (t >= 1 && !p.landed) {
          p.landed = true;
          seatedCount++;
          if (LS8.Audio) LS8.Audio.play("land");
          p.lineUntil = now + 0.55;
        }
        if (p.line) {
          if (now > p.lineUntil) {
            LS8.Scene3D.scene.remove(p.line);
            p.line.geometry.dispose(); p.line.material.dispose();
            p.line = null;
          } else if (p.landed) {
            p.line.material.opacity = Math.max(0, (p.lineUntil - now) / 0.55) * 0.8;
          }
        }
      } else {
        if (p.outDone) return;
        var ot = (now - t0 - p.outDelay) / 0.85;
        if (ot <= 0) return;
        var ott = easeInOut(Math.min(ot, 1));
        p.group.position.copy(bez(p.outStart, p.outMid, p.start, ott));
        p.group.rotation.y = p.yaw + ott * 1.6;
        if (p.outLine) {
          p.outLine.material.opacity = Math.max(0.1, 0.6 - ott * 0.5);
        }
        if (ot >= 1) {
          p.outDone = true;
          seatedCount = Math.max(0, seatedCount - 1);
          p.group.visible = false;
          if (p.outLine) {
            LS8.Scene3D.scene.remove(p.outLine);
            p.outLine.geometry.dispose(); p.outLine.material.dispose();
            p.outLine = null;
          }
        }
      }
    });
  }

  function reset() {
    flying = false; phaseOut = false; seatedCount = 0;
    list.forEach(function (p) {
      p.sealed = false;
      p.group.visible = false;
      if (p.line) { LS8.Scene3D.scene.remove(p.line); p.line = null; }
      if (p.outLine) { LS8.Scene3D.scene.remove(p.outLine); p.outLine = null; }
    });
    drawLed(null);
    drawMeter(null);
  }

  function groupById(id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].group;
    return null;
  }

  /* 调试/跳转用：所有零件直接落位 */
  function sealAll() {
    flying = true; phaseOut = false;
    seatedCount = list.length;
    list.forEach(function (p) {
      p.sealed = true;
      p.landed = true; p.tagShown = true;
      p.group.visible = true;
      p.group.position.copy(p.target);
      p.group.rotation.y = p.yaw;
      if (p.line) { LS8.Scene3D.scene.remove(p.line); p.line = null; }
    });
  }

  LS8.Parts = {
    init: init,
    begin: begin,
    flyOut: flyOut,
    update: update,
    reset: reset,
    group: groupById,
    sealAll: sealAll,
    get seatedCount() { return seatedCount; },
    get flying() { return flying && !phaseOut; },
    list: function () { return list; },
    setLedText: drawLed,
    setLedOn: function (on) { LS8.Parts._ledMat && (LS8.Parts._ledMat.emissiveIntensity = on ? 0.85 : 0); },
    setScreensOn: function (on) {
      touchScreenMat.map = on ? touchOnTex : touchOffTex;
      touchScreenMat.needsUpdate = true;
      drawMeter(on ? "11.99" : null);
    }
  };

  // 把 LED 面板材质暴露给 timeline 控制亮度
  Object.defineProperty(LS8.Parts, "_ledMat", {
    get: function () {
      var p = list[5];
      var mod = p && p.group.children[1];
      return mod ? mod.material[4] : null;
    }
  });
})(window.LS8 = window.LS8 || {});
