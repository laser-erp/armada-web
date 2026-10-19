/* Анимация «Ночная трасса» — только внешний скрипт (CSP script-src 'self'). */
(function () {
  var hero = document.getElementById('hero');
  var cv = document.getElementById('c');
  if (!hero || !cv) return;

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  var lite =
    reduceMotion ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ||
    (navigator.connection && navigator.connection.saveData);

  if (lite) hero.classList.add('is-static');

  var ctx = cv.getContext('2d');
  var tag = document.getElementById('tag');
  var W = 0;
  var H = 0;
  var DPR = Math.min(lite ? 1 : 2, window.devicePixelRatio || 1);
  var mx = 0;
  var my = 0;
  var tmx = 0;
  var tmy = 0;

  function spr(r, g, b) {
    var s = document.createElement('canvas');
    s.width = s.height = 128;
    var x = s.getContext('2d');
    var gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.12, 'rgba(' + r + ',' + g + ',' + b + ',.95)');
    gr.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',.25)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    return s;
  }

  var SW = spr(200, 220, 255);
  var SR = spr(255, 30, 40);
  var SO = spr(255, 160, 60);
  var SA = spr(255, 190, 40);
  var city = [];

  function resize() {
    var r = hero.getBoundingClientRect();
    W = r.width;
    H = r.height;
    cv.width = W * DPR;
    cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    city = [];
    var x = -20;
    while (x < W + 20) {
      var w = 14 + Math.random() * 46;
      var h = 10 + Math.pow(Math.random(), 2) * (H * 0.16);
      var wins = [];
      for (var i = 0; i < w * h / 90; i++) {
        if (Math.random() < 0.5) wins.push([Math.random() * (w - 3), Math.random() * (h - 3), Math.random() < 0.85 ? '#FFC56A' : '#9FD3FF']);
      }
      city.push({ x: x, w: w, h: h, wins: wins });
      x += w + Math.random() * 4;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    tmx = (e.clientX - r.left) / r.width - 0.5;
    tmy = (e.clientY - r.top) / r.height - 0.5;
  });

  var starCount = lite ? 40 : 120;
  var stars = Array.from({ length: starCount }, function () {
    return [Math.random(), Math.random() * 0.45, Math.random() * 1.2 + 0.2, Math.random() * 6];
  });
  var FAR = lite ? 280 : 420;
  var HC = 2.4;
  var cars = [];

  function spawn(init) {
    var opp = Math.random() < 0.5;
    var lane = opp ? (Math.random() < 0.5 ? -1.9 : -5.5) : Math.random() < 0.5 ? 1.9 : 5.5;
    cars.push({
      x: lane,
      z: init ? 3 + Math.random() * FAR : FAR,
      opp: opp,
      v: opp ? 38 + Math.random() * 20 : -6 - Math.random() * 10,
      truck: Math.random() < 0.45,
    });
  }

  var initialCars = lite ? 22 : 44;
  for (var i = 0; i < initialCars; i++) spawn(true);
  var tracked = { x: 1.9, z: 20, opp: false, v: 0, truck: true, tracked: true };
  cars.push(tracked);

  var t0 = performance.now();
  var dist = 0;
  var running = true;
  var frameSkip = 0;

  function drawStatic(now) {
    mx = tmx;
    my = tmy;
    var hy = H * 0.6;
    var vx = W > 760 ? W * 0.66 : W / 2;
    var f = H * 0.9;
    var g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#03040A');
    g.addColorStop(0.7, '#0B0D1C');
    g.addColorStop(1, '#2A1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hy + 1);
    ctx.fillStyle = '#05060A';
    ctx.fillRect(0, hy, W, H - hy);
    var near = HC * f / (H - hy + 1);
    function P(X, Y, z) {
      return [vx + (X * f) / z, hy + (HC - Y) * f / z, f / z];
    }
    var a = P(-8.5, 0, near);
    var b = P(8.5, 0, near);
    var c = P(8.5, 0, FAR);
    var d = P(-8.5, 0, FAR);
    var rg = ctx.createLinearGradient(0, hy, 0, H);
    rg.addColorStop(0, '#0B0C12');
    rg.addColorStop(1, '#15161D');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
    if (tag) {
      var p = P(tracked.x, 3.3, tracked.z);
      tag.style.left = p[0] + 'px';
      tag.style.top = p[1] + 'px';
    }
  }

  function frame(now) {
    if (!running) return;
    if (reduceMotion) {
      drawStatic(now);
      return;
    }
    if (lite) {
      frameSkip++;
      if (frameSkip % 2 !== 0) {
        requestAnimationFrame(frame);
        return;
      }
    }
    var dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;
    var hy = H * 0.6 + my * 24;
    var vx = (W > 760 ? W * 0.66 : W / 2) + mx * -80;
    var f = H * 0.9;
    function P(X, Y, z) {
      return [vx + (X * f) / z, hy + (HC - Y) * f / z, f / z];
    }
    var speed = lite ? 14 : 22;
    dist += speed * dt;
    var g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#03040A');
    g.addColorStop(0.7, '#0B0D1C');
    g.addColorStop(1, '#2A1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hy + 1);
    for (var si = 0; si < stars.length; si++) {
      var s = stars[si];
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now / 900 + s[3]);
      ctx.fillStyle = '#fff';
      ctx.fillRect(s[0] * W, s[1] * hy, s[2], s[2]);
    }
    ctx.globalAlpha = 1;
    var hz = ctx.createRadialGradient(vx, hy, 0, vx, hy, W * 0.7);
    hz.addColorStop(0, 'rgba(255,90,60,.35)');
    hz.addColorStop(0.4, 'rgba(120,30,60,.12)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, hy + 40);
    ctx.save();
    ctx.translate(mx * -30, 0);
    for (var bi = 0; bi < city.length; bi++) {
      var bld = city[bi];
      ctx.fillStyle = '#07080F';
      ctx.fillRect(bld.x, hy - bld.h, bld.w, bld.h + 2);
      for (var wi = 0; wi < bld.wins.length; wi++) {
        var w = bld.wins[wi];
        ctx.fillStyle = w[2];
        ctx.globalAlpha = 0.55;
        ctx.fillRect(bld.x + w[0], hy - bld.h + w[1], 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.fillStyle = '#05060A';
    ctx.fillRect(0, hy, W, H - hy);
    var near = HC * f / (H - hy + 1);
    var a = P(-8.5, 0, near);
    var b = P(8.5, 0, near);
    var c = P(8.5, 0, FAR);
    var d = P(-8.5, 0, FAR);
    var rg = ctx.createLinearGradient(0, hy, 0, H);
    rg.addColorStop(0, '#0B0C12');
    rg.addColorStop(1, '#15161D');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
    for (var ei = 0; ei < 2; ei++) {
      var Xe = ei === 0 ? -8.2 : 8.2;
      var p1 = P(Xe, 0, near);
      var p2 = P(Xe, 0, FAR);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
    var p1, p2, p3, p4;
    for (var di = 0; di < 2; di++) {
      var Xd = di === 0 ? -0.12 : 0.12;
      p1 = P(Xd, 0, near);
      p2 = P(Xd, 0, FAR);
      ctx.strokeStyle = 'rgba(245,196,0,.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (var lanei = 0; lanei < 2; lanei++) {
      var Xl = lanei === 0 ? -3.7 : 3.7;
      for (var k = 0; k < (lite ? 30 : 60); k++) {
        var z = k * 9 - (dist % 9);
        if (z < near) continue;
        var z2 = z + 3.5;
        p1 = P(Xl - 0.08, 0, z);
        p2 = P(Xl + 0.08, 0, z);
        p3 = P(Xl + 0.08, 0, z2);
        p4 = P(Xl - 0.08, 0, z2);
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.lineTo(p4[0], p4[1]);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    var lampCount = lite ? 8 : 16;
    for (var k = 0; k < lampCount; k++) {
      var zl = k * 28 - (dist % 28) + near + 2;
      for (var li = 0; li < 2; li++) {
        var Xlp = li === 0 ? -10.5 : 10.5;
        var pl = P(Xlp, 7, zl);
        var sl = Math.max(4, pl[2] * 1.8);
        ctx.globalAlpha = Math.min(1, 40 / zl);
        ctx.drawImage(SO, pl[0] - sl, pl[1] - sl, sl * 2, sl * 2);
      }
    }
    ctx.globalAlpha = 1;
    for (var ci = 0; ci < cars.length; ci++) {
      var car = cars[ci];
      car.z -= (car.opp ? car.v : car.v) * dt;
      if (car.tracked) car.z = 20 + Math.sin(now / 2600) * 3;
      if (!car.tracked && (car.z < near * 0.9 || car.z > FAR + 5)) car.dead = true;
    }
    for (ci = cars.length - 1; ci >= 0; ci--) {
      if (cars[ci].dead) {
        cars.splice(ci, 1);
        spawn(false);
      }
    }
    cars.sort(function (p, q) {
      return q.z - p.z;
    });
    for (ci = 0; ci < cars.length; ci++) {
      car = cars[ci];
      var sp = car.opp ? SW : SR;
      var y = car.truck ? 1.0 : 0.6;
      var fog = Math.min(1, Math.max(0.15, 60 / car.z));
      for (var dxi = 0; dxi < 2; dxi++) {
        var dx = dxi === 0 ? -0.85 : 0.85;
        var pc = P(car.x + dx, y, car.z);
        var sc = Math.max(1.6, pc[2] * (car.opp ? 0.55 : 0.4));
        ctx.globalAlpha = fog;
        ctx.drawImage(sp, pc[0] - sc, pc[1] - sc, sc * 2, sc * 2);
      }
      if (car.tracked && tag) {
        var pt = P(car.x, 3.3, car.z);
        tag.style.left = pt[0] + 'px';
        tag.style.top = pt[1] + 'px';
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) {
      t0 = performance.now();
      requestAnimationFrame(frame);
    }
  });

  requestAnimationFrame(frame);
})();
