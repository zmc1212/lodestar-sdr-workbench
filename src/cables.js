/* 布线阶段：同轴线 / 杜邦彩虹排线 / 电源线，沿曲线生长 */
(function (LS8) {
  var cables = [];
  var root = null;
  var running = false, t0 = 0, done = false;

  var RIBBON = [0xe84f8e, 0xf2a53a, 0xf5e04b, 0x7fd8d8, 0x5b8cff, 0x8b5fd0, 0x57c46b, 0xe8e4da];

  /* [点列, 颜色, 半径, 延迟, 股数] — 射频链路按真实顺序：ANT → 20dB PAD → LNA → BPF → SPLITTER → 板上 SMA J1 */
  var SPECS = [
    { // 同轴 1：贴片天线 → 20dB 衰减器（防 LNA 过载）
      pts: [[-2.85, 0.11, 0.4], [-2.5, 0.13, 0.8], [-1.9, 0.13, 1.3], [-1.4, 0.12, 1.5]],
      color: 0xd98a2b, r: 0.017, delay: 0, strands: 1
    },
    { // 同轴 2：衰减器 → LNA（NF 0.6 dB 低噪放）
      pts: [[-1.15, 0.11, 1.5], [-1.7, 0.12, 1.45], [-2.25, 0.11, 1.36]],
      color: 0xb0703c, r: 0.014, delay: 0.3, strands: 1
    },
    { // 同轴 3：LNA → 腔体滤波器（先放大后滤波，保噪底）
      pts: [[-2.4, 0.11, 1.28], [-2.35, 0.13, 0.85], [-2.0, 0.12, 0.6]],
      color: 0x3b5bd6, r: 0.014, delay: 0.6, strands: 1
    },
    { // 同轴 4：腔体滤波 → 功分 → 主板 SMA J1
      pts: [[-1.68, 0.11, 0.6], [-1.3, 0.13, 0.5], [-1.05, 0.12, 0.46],
            [-0.75, 0.13, 0.5], [-0.55, 0.13, 0.62]],
      color: 0xd98a2b, r: 0.017, delay: 0.9, strands: 1
    },
    { // 同轴 5：功分第二路 → 50Ω 假负载
      pts: [[-0.92, 0.11, 0.5], [-0.66, 0.13, 0.6], [-0.48, 0.12, 0.72]],
      color: 0x9aa0ac, r: 0.014, delay: 1.2, strands: 1
    },
    { // 电源红黑对：万用表 → 主板右缘
      pts: [[1.6, 0.12, 0.58], [1.3, 0.14, 0.5], [1.12, 0.14, 0.18], [1.02, 0.13, -0.08]],
      color: 0xc0392b, r: 0.013, delay: 1.4, strands: 2
    },
    { // USB：Logic 8 → 主板前缘
      pts: [[1.58, 0.12, 1.5], [1.28, 0.13, 1.12], [1.0, 0.13, 0.85], [0.88, 0.13, 0.7]],
      color: 0x17181d, r: 0.013, delay: 1.7, strands: 1
    },
    { // 黄色编程线：主板 → 触摸屏
      pts: [[1.5, 0.13, 0.12], [1.76, 0.15, -0.42], [1.9, 0.15, -0.9], [1.93, 0.13, -1.14]],
      color: 0xe6c93f, r: 0.012, delay: 2.0, strands: 1
    },
    { // 彩虹排线：主板 PMOD → 数码管
      pts: [[0.74, 0.15, -0.4], [0.42, 0.34, 0.08], [0.08, 0.36, 0.52],
            [-0.18, 0.3, 0.92], [-0.34, 0.22, 1.2]],
      color: 0x000000, r: 0.01, delay: 2.3, strands: 8, ribbon: true
    }
  ];

  function init() {
    root = new THREE.Group();
    LS8.Scene3D.scene.add(root);
  }

  function buildCable(spec) {
    var meshes = [];
    var offs = [];
    if (spec.ribbon) {
      for (var s = 0; s < spec.strands; s++) offs.push((s - (spec.strands - 1) / 2) * 0.022);
    } else {
      for (var k = 0; k < spec.strands; k++) offs.push(spec.strands === 2 ? (k - 0.5) * 0.026 : 0);
    }
    offs.forEach(function (off, idx) {
      var pts = spec.pts.map(function (p) {
        return new THREE.Vector3(p[0] + off * 0.55, p[1] + Math.abs(off) * 0.6, p[2] + off);
      });
      var curve = new THREE.CatmullRomCurve3(pts);
      var geo = new THREE.TubeGeometry(curve, 72, spec.r, 8, false);
      var mat = new THREE.MeshStandardMaterial({
        color: spec.ribbon ? RIBBON[idx] : spec.color,
        roughness: 0.62, metalness: 0.12
      });
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.geometry.setDrawRange(0, 0);
      root.add(m);
      meshes.push(m);
    });
    return { spec: spec, meshes: meshes, started: false, doneT: 0 };
  }

  function begin(now) {
    running = true; done = false; t0 = now;
    cables = SPECS.map(buildCable);
  }

  function update(now) {
    if (!running || done) return;
    cables.forEach(function (c) {
      var t = (now - t0 - c.spec.delay) / 1.05;
      if (t <= 0) return;
      var f = Math.min(1, t);
      var ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      c.meshes.forEach(function (m) {
        var total = m.geometry.index.count;
        m.geometry.setDrawRange(0, Math.floor(total * ease / 6) * 6);
      });
    });
    if ((now - t0) > 4.2) done = true;
  }

  function reset() {
    running = false; done = false;
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    root.clear();
    cables = [];
  }

  /* 调试/跳转用：所有线缆直接画满 */
  function completeAll() {
    running = true; done = true;
    if (!cables.length) cables = SPECS.map(buildCable);
    cables.forEach(function (c) {
      c.meshes.forEach(function (m) {
        m.geometry.setDrawRange(0, m.geometry.index.count);
      });
    });
  }

  LS8.Cables = { init: init, begin: begin, update: update, reset: reset, completeAll: completeAll };
})(window.LS8 = window.LS8 || {});
