/* 场景：渲染器 / 灯光 / 木桌 / 切割垫 / LS-8 红色主板 */
(function (LS8) {
  var M = {};      // 共享材质
  var fanBlades = null;
  var boardGroup = null;

  function mesh(geo, mat, x, y, z, cast, receive) {
    var m = new THREE.Mesh(geo, mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = cast !== false;
    m.receiveShadow = receive !== false;
    return m;
  }

  function init() {
    var stage = document.getElementById("stage");
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    // 软件渲染（SwiftShader 等）下降像素比 + 精简阴影，保证可交互帧率
    var softGL = false;
    try {
      var gl = renderer.getContext();
      var ext = gl.getExtension("WEBGL_debug_renderer_info");
      var gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
      softGL = /swiftshader|software|basic render/i.test(String(gpu));
    } catch (e) { /* 保留默认 */ }
    renderer.setPixelRatio(softGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = softGL ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    // 物理光照：去掉 legacy 模式的 π 增益，否则暗色材质会被抬成灰白
    renderer.physicallyCorrectLights = true;
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = LS8.Textures.sky();

    var camera = new THREE.PerspectiveCamera(38, stage.clientWidth / stage.clientHeight, 0.1, 80);
    camera.position.set(4.5, 4.2, 6.4);

    var hemi = new THREE.HemisphereLight(0xfff2df, 0x8a7f66, 1.0);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(4.5, 8, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(softGL ? 1024 : 2048, softGL ? 1024 : 2048);
    sun.shadow.camera.left = -6.5; sun.shadow.camera.right = 6.5;
    sun.shadow.camera.top = 6.5; sun.shadow.camera.bottom = -6.5;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 22;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    /* ---- 木桌 ---- */
    var desk = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({ map: LS8.Textures.wood(), roughness: 0.92 })
    );
    desk.rotation.x = -Math.PI / 2;
    desk.receiveShadow = true;
    scene.add(desk);

    /* ---- 切割垫 ---- */
    var matTex = LS8.Textures.mat();
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x16233f, roughness: 0.85 });
    var topMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.82 });
    var matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(7.3, 0.09, 4.8),
      [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
    );
    matMesh.position.y = 0.048;
    matMesh.rotation.y = 0.045;
    matMesh.receiveShadow = true;
    matMesh.castShadow = true;
    scene.add(matMesh);

    /* ---- 共享材质（先建，主板/零件都依赖） ---- */
    M.plastic = new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.85 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.8 });
    M.silver = new THREE.MeshStandardMaterial({ color: 0xc9cdd4, metalness: 0.75, roughness: 0.32 });
    M.alu = new THREE.MeshStandardMaterial({ color: 0xd8dade, metalness: 0.6, roughness: 0.4 });
    M.gold = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 0.85, roughness: 0.35 });
    M.copper = new THREE.MeshStandardMaterial({ color: 0xb0703c, metalness: 0.8, roughness: 0.4 });
    M.navy = new THREE.MeshStandardMaterial({ color: 0x2a3a66, roughness: 0.5 });
    M.pink = new THREE.MeshStandardMaterial({ color: 0xe84f8e, roughness: 0.5 });
    M.white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 });
    M.red = new THREE.MeshStandardMaterial({ map: LS8.Textures.pcb("#c23b30", "rgba(90,16,12,0.55)", "LODESTAR"), roughness: 0.6 });
    M.purple = new THREE.MeshStandardMaterial({ map: LS8.Textures.pcb("#8b5fd0", "rgba(50,26,90,0.5)"), roughness: 0.6 });
    M.green = new THREE.MeshStandardMaterial({ map: LS8.Textures.pcb("#4ca66b", "rgba(20,60,34,0.5)"), roughness: 0.6 });
    M.blue = new THREE.MeshStandardMaterial({ map: LS8.Textures.pcb("#3b5bd6", "rgba(18,30,80,0.5)"), roughness: 0.6 });
    M.chip = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.2 });
    M.yellow = new THREE.MeshStandardMaterial({ color: 0xe6b93f, roughness: 0.5 });

    /* ---- 主板（预置，不参与飞行） ---- */
    boardGroup = buildMainBoard();
    boardGroup.position.set(0.62, 0.095, 0.12);
    boardGroup.rotation.y = -0.06;
    scene.add(boardGroup);

    LS8.Scene3D = {
      scene: scene,
      camera: camera,
      renderer: renderer,
      board: boardGroup,
      mesh: mesh,
      M: M,
      setFanSpeed: function (s) { fanSpeed = s; }
    };
  }

  var fanSpeed = 0;

  /* 主板细节 */
  function buildMainBoard() {
    var g = new THREE.Group();
    var pcbBase = mesh(new THREE.BoxGeometry(1.78, 0.05, 1.14), M.red, 0, 0.025, 0);
    g.add(pcbBase);

    // 散热器 + 风扇
    var hs = mesh(new THREE.BoxGeometry(0.46, 0.2, 0.46), M.navy, -0.34, 0.155, -0.16);
    g.add(hs);
    for (var i = 0; i < 4; i++) {
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), M.navy, -0.34, 0.26 + i * 0.035, -0.16));
    }
    var fanRim = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 24), M.plastic, -0.34, 0.3, -0.16);
    g.add(fanRim);
    fanBlades = new THREE.Group();
    fanBlades.position.set(-0.34, 0.315, -0.16);
    for (var b = 0; b < 5; b++) {
      var blade = mesh(new THREE.BoxGeometry(0.13, 0.012, 0.05), M.dark, 0, 0, 0);
      blade.rotation.y = (b / 5) * Math.PI * 2;
      blade.position.set(Math.cos(blade.rotation.y) * 0.075, 0, Math.sin(blade.rotation.y) * 0.075);
      blade.rotation.y += 0.5;
      fanBlades.add(blade);
    }
    var hub = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 16), M.pink, 0, 0.004, 0);
    fanBlades.add(hub);
    g.add(fanBlades);

    // FPGA 白色 BGA
    g.add(mesh(new THREE.BoxGeometry(0.24, 0.07, 0.24), M.white, 0.18, 0.075, -0.3));
    // DDR3L 小条
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.12), M.chip, 0.35, 0.06, 0.05));
    // 时钟发生器 XO（SI5351 级金属罐）+ 27 MHz 晶振
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), M.chip, -0.1, 0.05, 0.24));
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), M.silver, -0.02, 0.055, 0.36));
    // 音频 codec（I-Q 基带）
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.035, 0.1), M.chip, 0.62, 0.055, 0.18));
    // 3.3V LDO（SOT-223，电源轨前端）
    g.add(mesh(new THREE.BoxGeometry(0.11, 0.03, 0.09), M.chip, 0.72, 0.05, 0.4));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.07), M.silver, 0.72, 0.042, 0.46));
    // 去耦电容群（0402 深灰小块，FPGA/DDR/CODEC 每颗 IC 旁成组）
    for (var d = 0; d < 12; d++) {
      g.add(mesh(new THREE.BoxGeometry(0.022, 0.012, 0.014), M.dark,
        0.06 + (d % 4) * 0.09, 0.035, -0.42 + Math.floor(d / 4) * 0.05));
    }

    // 电容（蓝色圆柱）
    for (var c = 0; c < 6; c++) {
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 12),
        new THREE.MeshStandardMaterial({ color: 0x3b5bd6, roughness: 0.45 }),
        -0.72 + (c % 3) * 0.1, 0.09, 0.38 + Math.floor(c / 3) * 0.12));
    }

    // 前沿 SMA 金口 x4（J1-J4，50Ω 射频链路入口）
    for (var s = 0; s < 4; s++) {
      var sma = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 12), M.gold, -0.55 + s * 0.18, 0.06, 0.62);
      sma.rotation.x = Math.PI / 2;
      g.add(sma);
    }
    // 射频前段屏蔽罐（J1 输入端镀锡罩）
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.07, 0.24), M.silver, -0.55, 0.1, 0.42));

    // USB / 网口（右缘银块）
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.09, 0.22), M.silver, 0.9, 0.09, -0.28));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.3), M.silver, 0.9, 0.095, 0.12));

    // PMOD 排针（后缘黑块）
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), M.plastic, 0.15, 0.08, -0.5));

    // JTAG 排针
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.07, 0.07), M.plastic, 0.68, 0.075, -0.42));

    // microSD 座
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.04, 0.16), M.silver, -0.72, 0.055, 0.1));

    // 安装孔 x4（M3 边角）
    [[-0.82, -0.5], [0.82, -0.5], [-0.82, 0.5], [0.82, 0.5]].forEach(function (hp) {
      g.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.055, 10), M.gold, hp[0], 0.02, hp[1]));
    });

    return g;
  }

  function update(dt) {
    if (fanBlades && fanSpeed > 0) fanBlades.rotation.y += fanSpeed * dt;
  }

  LS8.SceneInit = init;
  LS8.SceneUpdate = update;
})(window.LS8 = window.LS8 || {});
