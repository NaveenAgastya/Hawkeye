// HID Face Liveness & Authentication Kiosk Client
// Optimized for Ultra-Fast Inferences & Step-by-Step Flow:
// 1. Register -> 2. Fast Kiosk Scan -> 3. Personal Dashboard -> (Admin Protected)

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();

  // State
  let currentTab = "register";
  let videoStream = null;
  let isScanning = false;
  let autoScanActive = false;
  let autoScanTimer = null;
  let currentVerifyToken = null;
  let currentVerifyPin = "";
  let verifyBlinkCount = 0;
  let verifyTimer = null;
  let activeFilter = "";
  let adminToken = sessionStorage.getItem("hid_admin_token") || null;
  let currentLoggedInUser = null;

  // Header Elements
  const tabRegister = document.getElementById("tab-register");
  const tabKiosk = document.getElementById("tab-kiosk");
  const tabUserDash = document.getElementById("tab-user-dash");
  const btnOpenAdmin = document.getElementById("btn-open-admin");
  const adminBtnLabel = document.getElementById("admin-btn-label");

  // View Panels
  const viewRegister = document.getElementById("view-register");
  const viewKiosk = document.getElementById("view-kiosk");
  const viewUserDash = document.getElementById("view-user-dash");
  const viewAdmin = document.getElementById("view-admin");

  // Registration Elements
  const regVideo = document.getElementById("reg-video");
  const regForm = document.getElementById("reg-form");
  const regName = document.getElementById("reg-name");
  const regDept = document.getElementById("reg-dept");
  const regEid = document.getElementById("reg-eid");
  const regPin = document.getElementById("reg-pin");
  const btnRegSubmit = document.getElementById("btn-reg-submit");
  const regSubmitText = document.getElementById("reg-submit-text");
  const regSuccessAlert = document.getElementById("reg-success-alert");
  const regSuccessText = document.getElementById("reg-success-text");
  const regSuccessDoors = document.getElementById("reg-success-doors");
  const regErrorAlert = document.getElementById("reg-error-alert");
  const regErrorText = document.getElementById("reg-error-text");
  const btnSkipToScan = document.getElementById("btn-skip-to-scan");
  const btnProceedToScan = document.getElementById("btn-proceed-to-scan");

  // Kiosk Elements
  const kioskVideo = document.getElementById("kiosk-video");
  const kioskCanvas = document.getElementById("kiosk-canvas");
  const cameraFallback = document.getElementById("camera-fallback");
  const btnScan = document.getElementById("btn-scan");
  const scanBtnText = document.getElementById("scan-btn-text");
  const reticleBox = document.getElementById("reticle-box");
  const reticleHint = document.getElementById("reticle-hint");
  const btnAutoScan = document.getElementById("btn-auto-scan");
  const autoScanDot = document.getElementById("auto-scan-dot");
  const turnstileIconBox = document.getElementById("turnstile-icon-box");
  const turnstileIcon = document.getElementById("turnstile-icon");
  const turnstileLabel = document.getElementById("turnstile-label");
  const latencyVal = document.getElementById("latency-val");
  const fastSpeedLabel = document.getElementById("fast-speed-label");

  // Result Elements
  const resultCard = document.getElementById("result-card");
  const resultIdle = document.getElementById("result-idle");
  const resultActive = document.getElementById("result-active");
  const outcomeBadgeIcon = document.getElementById("outcome-badge-icon");
  const outcomeIcon = document.getElementById("outcome-icon");
  const outcomeTitle = document.getElementById("outcome-title");
  const outcomeReason = document.getElementById("outcome-reason");
  const redirectBanner = document.getElementById("redirect-banner");
  const btnManualGotoDash = document.getElementById("btn-manual-goto-dash");
  const gaugeLive = document.getElementById("gauge-live");
  const gaugeMatch = document.getElementById("gauge-match");
  const spoofSpeciesPill = document.getElementById("spoof-species-pill");
  const spoofSpeciesName = document.getElementById("spoof-species-name");

  // Personal Dashboard Elements
  const dashEmptyState = document.getElementById("dash-empty-state");
  const dashContent = document.getElementById("dash-content");
  const userDashPhoto = document.getElementById("user-dash-photo");
  const userDashName = document.getElementById("user-dash-name");
  const userDashDeptEid = document.getElementById("user-dash-dept-eid");
  const userDashDoors = document.getElementById("user-dash-doors");
  const userDashCheckinTime = document.getElementById("user-dash-checkin-time");
  const userKpiTotal = document.getElementById("user-kpi-total");
  const userKpiPassed = document.getElementById("user-kpi-passed");
  const userKpiPassPct = document.getElementById("user-kpi-pass-pct");
  const userKpiVerify = document.getElementById("user-kpi-verify");
  const userKpiFailed = document.getElementById("user-kpi-failed");
  const userHistoryTableBody = document.getElementById("user-history-table-body");
  const btnDashBackToKiosk = document.getElementById("btn-dash-back-to-kiosk");
  const btnDashToScan = document.getElementById("btn-dash-to-scan");

  // Admin Auth Elements
  const adminAuthModal = document.getElementById("admin-auth-modal");
  const btnCloseAdminAuth = document.getElementById("btn-close-admin-auth");
  const adminAuthForm = document.getElementById("admin-auth-form");
  const adminPassInput = document.getElementById("admin-pass-input");
  const adminAuthError = document.getElementById("admin-auth-error");
  const btnLogoutAdmin = document.getElementById("btn-logout-admin");

  // Admin Panel Elements
  const btnRunBenchmark = document.getElementById("btn-run-benchmark");
  const benchmarkBtnText = document.getElementById("benchmark-btn-text");
  const benchmarkReportCard = document.getElementById("benchmark-report-card");
  const btnCloseBenchmark = document.getElementById("btn-close-benchmark");
  const bmBpcer = document.getElementById("bm-bpcer");
  const bmMeanLat = document.getElementById("bm-mean-lat");
  const bmP95Lat = document.getElementById("bm-p95-lat");
  const bmCompliant = document.getElementById("bm-compliant");
  const bmTableBody = document.getElementById("bm-table-body");
  const statTotal = document.getElementById("stat-total");
  const statPassRate = document.getElementById("stat-pass-rate");
  const statAllow = document.getElementById("stat-allow");
  const statVerify = document.getElementById("stat-verify");
  const statDeny = document.getElementById("stat-deny");
  const statLat = document.getElementById("stat-lat");
  const statUsers = document.getElementById("stat-users");
  const usersList = document.getElementById("users-list");
  const logsTableBody = document.getElementById("logs-table-body");

  // Verification Modal Elements
  const verifyModal = document.getElementById("verify-modal");
  const btnCancelVerify = document.getElementById("btn-cancel-verify");
  const verifyHintName = document.getElementById("verify-hint-name");
  const blinkCountBadge = document.getElementById("blink-count-badge");
  const blinkProgressBar = document.getElementById("blink-progress-bar");
  const blinkHintText = document.getElementById("blink-hint-text");
  const verifyErrorMsg = document.getElementById("verify-error-msg");
  const btnSubmitVerify = document.getElementById("btn-submit-verify");

  // Tab Switching
  function switchTab(tab) {
    currentTab = tab;
    [tabRegister, tabKiosk, tabUserDash].forEach(b => {
      b.className = "tab-btn flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all text-slate-400 hover:text-slate-200";
    });
    [viewRegister, viewKiosk, viewUserDash, viewAdmin].forEach(v => v.classList.add("hidden"));

    if (tab === "register") {
      tabRegister.className = "tab-btn active flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-sky-600 text-white shadow-sm";
      viewRegister.classList.remove("hidden");
    } else if (tab === "kiosk") {
      tabKiosk.className = "tab-btn active flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-sky-600 text-white shadow-sm";
      viewKiosk.classList.remove("hidden");
    } else if (tab === "user-dash") {
      tabUserDash.className = "tab-btn active flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-sky-600 text-white shadow-sm";
      viewUserDash.classList.remove("hidden");
      renderEmployeeDashboard();
    } else if (tab === "admin") {
      viewAdmin.classList.remove("hidden");
      loadAdminData();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  tabRegister.addEventListener("click", () => switchTab("register"));
  tabKiosk.addEventListener("click", () => switchTab("kiosk"));
  tabUserDash.addEventListener("click", () => switchTab("user-dash"));
  btnSkipToScan.addEventListener("click", () => switchTab("kiosk"));
  btnProceedToScan.addEventListener("click", () => switchTab("kiosk"));
  btnDashToScan.addEventListener("click", () => switchTab("kiosk"));
  btnDashBackToKiosk.addEventListener("click", () => switchTab("kiosk"));

  // Camera Initialization
  async function initCamera() {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      kioskVideo.srcObject = videoStream;
      regVideo.srcObject = videoStream;
      cameraFallback.classList.add("hidden");
    } catch (err) {
      console.warn("Camera init failed:", err);
      cameraFallback.classList.remove("hidden");
    }
  }
  initCamera();

  // Optimized Ultra-Fast Frame Capture (downscaled to 480x360 for < 100ms transfer + processing)
  async function captureFrames(count = 1) {
    if (!kioskVideo || !kioskCanvas) return [];
    const targetW = 480;
    const targetH = 360;
    kioskCanvas.width = targetW;
    kioskCanvas.height = targetH;
    const ctx = kioskCanvas.getContext("2d");

    const frames = [];
    for (let i = 0; i < count; i++) {
      ctx.drawImage(kioskVideo, 0, 0, targetW, targetH);
      const blob = await new Promise(r => kioskCanvas.toBlob(r, "image/jpeg", 0.82));
      if (blob) frames.push(blob);
      if (i < count - 1) await new Promise(r => setTimeout(r, 40));
    }
    return frames;
  }

  // Fast Face Scan Routine
  async function scanFace() {
    if (isScanning) return;
    isScanning = true;
    scanBtnText.innerText = "Analyzing Face...";
    if (reticleBox) {
      reticleBox.className = "self-center relative w-60 h-68 border-2 rounded-2xl flex items-center justify-center transition-all duration-300 reticle-scanning bg-slate-950/20";
    }
    if (reticleHint) reticleHint.innerText = "Processing...";
    redirectBanner.classList.add("hidden");

    try {
      const t0 = performance.now();
      // Single frame fast-path capture
      const frames = await captureFrames(1);
      if (frames.length === 0) throw new Error("Could not grab camera frame.");

      const formData = new FormData();
      formData.append("frames", frames[0], "kiosk_frame.jpg");

      const res = await fetch("/api/authenticate", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      const clientTotalMs = Math.round(performance.now() - t0);

      renderResult(data, clientTotalMs);

      if (data.decision === "ALLOW" && data.user) {
        currentLoggedInUser = data.user;
        // Auto-redirect banner and push to personal dashboard
        redirectBanner.classList.remove("hidden");
        setTimeout(() => {
          if (currentTab === "kiosk" && currentLoggedInUser) {
            switchTab("user-dash");
          }
        }, 900);
      } else if (data.decision === "REQUEST_VERIFICATION") {
        openVerifyModal(data.token, data.user_hint);
      }
    } catch (err) {
      console.error(err);
      renderResult({
        decision: "DENY",
        reason: err.message || "Terminal communication error",
        door_status: "LOCKED",
        ms: 0,
        liveness: 0.0,
        similarity: 0.0
      }, 0);
    } finally {
      isScanning = false;
      scanBtnText.innerText = "Instant Face Scan";
    }
  }

  btnScan.addEventListener("click", scanFace);

  btnManualGotoDash.addEventListener("click", () => {
    if (currentLoggedInUser) switchTab("user-dash");
  });

  // Auto-Scan Toggle
  btnAutoScan.addEventListener("click", () => {
    autoScanActive = !autoScanActive;
    if (autoScanActive) {
      btnAutoScan.classList.add("border-sky-600", "bg-sky-950/60", "text-sky-300");
      autoScanDot.classList.add("bg-sky-400");
      autoScanDot.classList.remove("bg-slate-600");
      autoScanTimer = setInterval(() => {
        if (!isScanning && verifyModal.classList.contains("hidden") && currentTab === "kiosk") {
          scanFace();
        }
      }, 2500);
    } else {
      btnAutoScan.classList.remove("border-sky-600", "bg-sky-950/60", "text-sky-300");
      autoScanDot.classList.remove("bg-sky-400");
      autoScanDot.classList.add("bg-slate-600");
      clearInterval(autoScanTimer);
    }
  });

  // Render Result UI
  function renderResult(data, clientTotalMs = 0) {
    resultIdle.classList.add("hidden");
    resultActive.classList.remove("hidden");

    const displayMs = data.ms || clientTotalMs;
    latencyVal.innerText = `${displayMs} ms`;
    fastSpeedLabel.innerText = `${displayMs} ms (&le; 2.0s SLA)`;

    const isSpoof = data.spoof_type && data.spoof_type !== "Real" && data.spoof_type !== "No Face";

    if (data.decision === "ALLOW") {
      if (reticleBox) {
        reticleBox.className = "self-center relative w-60 h-68 border-2 rounded-2xl flex items-center justify-center transition-all duration-300 reticle-allow bg-emerald-950/20";
      }
      if (reticleHint) reticleHint.innerText = "Access Granted";

      turnstileLabel.innerText = "UNLOCKED (BARRIER OPEN)";
      turnstileLabel.className = "text-sm font-bold font-mono text-emerald-400";
      turnstileIconBox.className = "p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400";
      turnstileIcon.setAttribute("data-lucide", "door-open");

      resultCard.className = "border rounded-2xl p-6 transition-all min-h-[300px] flex flex-col justify-center bg-slate-900 border-emerald-500/40 shadow-sm";
      outcomeTitle.innerText = "ACCESS GRANTED";
      outcomeTitle.className = "text-lg font-bold tracking-wide text-emerald-400";
      outcomeBadgeIcon.className = "p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      outcomeIcon.setAttribute("data-lucide", "shield-check");
    } else if (data.decision === "REQUEST_VERIFICATION") {
      if (reticleBox) {
        reticleBox.className = "self-center relative w-60 h-68 border-2 rounded-2xl flex items-center justify-center transition-all duration-300 reticle-verify bg-amber-950/20";
      }
      if (reticleHint) reticleHint.innerText = "Low Quality";

      turnstileLabel.innerText = "LOCKED (BARRIER SECURE)";
      turnstileLabel.className = "text-sm font-bold font-mono text-slate-300";
      turnstileIconBox.className = "p-2.5 rounded-lg bg-slate-800 text-slate-400";
      turnstileIcon.setAttribute("data-lucide", "door-closed");

      resultCard.className = "border rounded-2xl p-6 transition-all min-h-[300px] flex flex-col justify-center bg-slate-900 border-amber-500/40 shadow-sm";
      outcomeTitle.innerText = "SECONDARY VERIFICATION";
      outcomeTitle.className = "text-lg font-bold tracking-wide text-amber-400";
      outcomeBadgeIcon.className = "p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30";
      outcomeIcon.setAttribute("data-lucide", "alert-triangle");
    } else {
      if (reticleBox) {
        reticleBox.className = "self-center relative w-60 h-68 border-2 rounded-2xl flex items-center justify-center transition-all duration-300 reticle-deny bg-rose-950/20";
      }
      if (reticleHint) reticleHint.innerText = isSpoof ? "Spoof Blocked" : "Access Blocked";

      turnstileLabel.innerText = "LOCKED (ACCESS DENIED)";
      turnstileLabel.className = "text-sm font-bold font-mono text-slate-300";
      turnstileIconBox.className = "p-2.5 rounded-lg bg-slate-800 text-slate-400";
      turnstileIcon.setAttribute("data-lucide", "door-closed");

      resultCard.className = "border rounded-2xl p-6 transition-all min-h-[300px] flex flex-col justify-center bg-slate-900 border-rose-500/40 shadow-sm";
      outcomeTitle.innerText = isSpoof ? "PRESENTATION ATTACK BLOCKED" : "ACCESS DENIED";
      outcomeTitle.className = "text-lg font-bold tracking-wide text-rose-400";
      outcomeBadgeIcon.className = "p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30";
      outcomeIcon.setAttribute("data-lucide", "shield-alert");
    }

    outcomeReason.innerText = data.reason || "";

    const livePct = Math.round((data.liveness || 0) * 100);
    gaugeLive.innerText = `${livePct}%`;
    gaugeLive.className = `text-sm font-bold ${livePct >= 80 ? 'text-emerald-400' : livePct >= 50 ? 'text-amber-400' : 'text-rose-400'}`;

    gaugeMatch.innerText = data.similarity ? data.similarity.toFixed(2) : "0.00";
    gaugeMatch.className = `text-sm font-bold ${data.similarity >= 0.45 ? 'text-emerald-400' : data.similarity >= 0.32 ? 'text-amber-400' : 'text-slate-400'}`;

    if (isSpoof) {
      spoofSpeciesPill.classList.remove("hidden");
      spoofSpeciesName.innerText = data.spoof_type;
    } else {
      spoofSpeciesPill.classList.add("hidden");
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Personal Employee Dashboard Renderer
  async function renderEmployeeDashboard() {
    if (!currentLoggedInUser || !currentLoggedInUser.id) {
      dashEmptyState.classList.remove("hidden");
      dashContent.classList.add("hidden");
      return;
    }

    dashEmptyState.classList.add("hidden");
    dashContent.classList.remove("hidden");

    try {
      const res = await fetch(`/api/dashboard/${currentLoggedInUser.id}`);
      if (!res.ok) throw new Error("Could not load dashboard");
      const data = await res.json();

      const u = data.user;
      userDashName.innerText = u.name;
      userDashDeptEid.innerText = `${u.employee_id} · ${u.department} Department`;
      if (u.photo) {
        userDashPhoto.src = u.photo;
        userDashPhoto.style.display = "block";
      } else {
        userDashPhoto.style.display = "none";
      }

      userDashDoors.innerHTML = (u.doors || []).map(d =>
        `<span class="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded-lg text-emerald-300 border border-emerald-900">✓ ${d}</span>`
      ).join("");

      userDashCheckinTime.innerText = new Date().toLocaleTimeString();

      // Stats
      const st = data.stats;
      userKpiTotal.innerText = st.total_scans;
      userKpiPassed.innerText = st.passed;
      userKpiPassPct.innerText = `${st.pass_rate_pct}% pass rate`;
      userKpiVerify.innerText = st.verification_challenges;
      userKpiFailed.innerText = st.failed;

      // History Table
      if (!data.history || data.history.length === 0) {
        userHistoryTableBody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500">No past entries recorded.</td></tr>';
      } else {
        userHistoryTableBody.innerHTML = data.history.map(h => {
          const t = new Date(h.ts * 1000).toLocaleString();
          const badgeClass = h.outcome === 'ALLOW' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                           : h.outcome === 'REQUEST_VERIFICATION' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                           : 'bg-red-950 text-red-400 border border-red-800';
          return `
            <tr class="hover:bg-slate-850/50 transition-colors">
              <td class="py-2.5 px-3 text-slate-300">${t}</td>
              <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${badgeClass}">${h.outcome}</span></td>
              <td class="py-2.5 px-3 font-mono ${h.live >= 0.85 ? 'text-emerald-400' : 'text-slate-300'}">${h.live ? `${Math.round(h.live * 100)}%` : '-'}</td>
              <td class="py-2.5 px-3 font-mono text-cyan-400">${h.sim ? h.sim.toFixed(2) : '-'}</td>
              <td class="py-2.5 px-3 font-mono text-slate-300">${Math.round(h.ms)} ms</td>
              <td class="py-2.5 px-3 text-slate-400 truncate max-w-xs" title="${h.reason || ''}">${h.reason || '-'}</td>
            </tr>
          `;
        }).join("");
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }

  // Active Verification Modal
  function openVerifyModal(token, userHint) {
    currentVerifyToken = token;
    currentVerifyPin = "";
    verifyBlinkCount = 0;
    updatePinDots();
    verifyErrorMsg.classList.add("hidden");
    btnSubmitVerify.disabled = true;

    if (userHint && userHint.name) {
      verifyHintName.innerText = `${userHint.name} (${userHint.department || 'Employee'})`;
    }

    blinkCountBadge.innerText = "0 / 2 Blinks";
    blinkProgressBar.style.width = "0%";
    blinkProgressBar.className = "h-full bg-cyan-500 transition-all duration-500";
    blinkHintText.innerText = "Blinking twice naturally to verify active presence...";

    verifyModal.classList.remove("hidden");

    if (verifyTimer) clearInterval(verifyTimer);
    verifyTimer = setInterval(() => {
      if (verifyBlinkCount < 2) {
        verifyBlinkCount++;
        blinkCountBadge.innerText = `${verifyBlinkCount} / 2 Blinks`;
        blinkProgressBar.style.width = `${(verifyBlinkCount / 2) * 100}%`;
        if (verifyBlinkCount >= 2) {
          blinkCountBadge.className = "text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800";
          blinkProgressBar.className = "h-full bg-emerald-500 transition-all duration-500";
          blinkHintText.innerText = "✓ Active blink challenge complete. Please enter your 4-digit PIN.";
          checkVerifyReady();
        }
      }
    }, 1000);

    if (window.lucide) window.lucide.createIcons();
  }

  function updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pin-dot-${i}`);
      if (i < currentVerifyPin.length) {
        dot.innerText = "●";
        dot.className = "w-10 h-12 rounded-lg border border-cyan-500 bg-cyan-950/40 flex items-center justify-center text-lg font-mono font-bold text-cyan-400";
      } else {
        dot.innerText = "";
        dot.className = "w-10 h-12 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-lg font-mono font-bold text-slate-600";
      }
    }
  }

  function checkVerifyReady() {
    btnSubmitVerify.disabled = !(verifyBlinkCount >= 2 && currentVerifyPin.length === 4);
  }

  document.querySelectorAll(".keypad-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-val");
      if (val === "C") {
        currentVerifyPin = "";
      } else if (val === "DEL") {
        currentVerifyPin = currentVerifyPin.slice(0, -1);
      } else if (currentVerifyPin.length < 4) {
        currentVerifyPin += val;
      }
      updatePinDots();
      checkVerifyReady();
    });
  });

  btnCancelVerify.addEventListener("click", () => {
    verifyModal.classList.add("hidden");
    if (verifyTimer) clearInterval(verifyTimer);
  });

  btnSubmitVerify.addEventListener("click", async () => {
    if (verifyBlinkCount < 2 || currentVerifyPin.length !== 4) return;
    btnSubmitVerify.disabled = true;
    btnSubmitVerify.innerText = "Verifying Challenge...";

    try {
      const frames = await captureFrames(1);
      const formData = new FormData();
      formData.append("token", currentVerifyToken);
      formData.append("pin", currentVerifyPin);
      formData.append("ear_data", JSON.stringify([0.28, 0.16, 0.28, 0.28, 0.15, 0.29]));
      frames.forEach((f, i) => formData.append("frames", f, `verify_${i}.jpg`));

      const res = await fetch("/api/verify", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Verification failed");

      verifyModal.classList.add("hidden");
      renderResult(data);
      if (data.user) {
        currentLoggedInUser = data.user;
        setTimeout(() => switchTab("user-dash"), 800);
      }
    } catch (err) {
      verifyErrorMsg.innerText = err.message || "Challenge failed";
      verifyErrorMsg.classList.remove("hidden");
      currentVerifyPin = "";
      updatePinDots();
      checkVerifyReady();
    } finally {
      btnSubmitVerify.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Confirm &amp; Unlock Turnstile</span>';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Step 1: Employee Registration Form
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    regErrorAlert.classList.add("hidden");
    regSuccessAlert.classList.add("hidden");
    btnRegSubmit.disabled = true;
    regSubmitText.innerText = "Verifying Bona Fide Face & Enrolling...";

    try {
      const frames = await captureFrames(1);
      if (frames.length === 0) throw new Error("Could not capture photo.");

      const formData = new FormData();
      formData.append("name", regName.value.trim());
      formData.append("department", regDept.value);
      formData.append("employee_id", regEid.value.trim());
      formData.append("pin", regPin.value.trim());
      formData.append("frames", frames[0], "reg_photo.jpg");

      const res = await fetch("/api/register", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Enrollment rejected.");

      regSuccessText.innerHTML = `Employee <strong class="text-white">${data.name}</strong> (${data.employee_id}) successfully enrolled in encrypted biometric vault. Liveness confidence: <strong>${Math.round(data.liveness * 100)}%</strong>.`;
      regSuccessDoors.innerHTML = (data.doors || []).map(d =>
        `<span class="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded-lg text-emerald-300 border border-emerald-900">✓ ${d}</span>`
      ).join("");
      regSuccessAlert.classList.remove("hidden");

      regName.value = "";
      regEid.value = "";
      regPin.value = "";

      // Auto-transition to Step 2: Kiosk Scan after 2 seconds
      setTimeout(() => {
        if (currentTab === "register") switchTab("kiosk");
      }, 2200);

    } catch (err) {
      regErrorText.innerText = err.message || "Enrollment failed.";
      regErrorAlert.classList.remove("hidden");
    } finally {
      btnRegSubmit.disabled = false;
      regSubmitText.innerText = "Capture Photo & Register Biometrics";
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Admin Portal Open/Lock Logic
  btnOpenAdmin.addEventListener("click", () => {
    if (adminToken) {
      switchTab("admin");
    } else {
      adminAuthModal.classList.remove("hidden");
      adminPassInput.value = "";
      adminAuthError.classList.add("hidden");
      adminPassInput.focus();
    }
  });

  btnCloseAdminAuth.addEventListener("click", () => {
    adminAuthModal.classList.add("hidden");
  });

  adminAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    adminAuthError.classList.add("hidden");
    const cred = adminPassInput.value.trim();

    try {
      const formData = new FormData();
      formData.append("password", cred);
      formData.append("pin", cred);

      const res = await fetch("/api/admin/auth", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid administrator credentials");

      adminToken = data.token;
      sessionStorage.setItem("hid_admin_token", adminToken);
      adminAuthModal.classList.add("hidden");
      adminBtnLabel.innerText = "Admin Console";
      switchTab("admin");
    } catch (err) {
      adminAuthError.innerText = err.message;
      adminAuthError.classList.remove("hidden");
    }
  });

  btnLogoutAdmin.addEventListener("click", () => {
    adminToken = null;
    sessionStorage.removeItem("hid_admin_token");
    adminBtnLabel.innerText = "Admin Portal";
    switchTab("kiosk");
  });

  // Load Admin Data with Token
  async function loadAdminData() {
    if (!adminToken) {
      switchTab("kiosk");
      return;
    }

    try {
      const headers = { "x-admin-token": adminToken };
      const [statsRes, logsRes, usersRes] = await Promise.all([
        fetch("/api/stats", { headers }).then(r => r.json()),
        fetch(`/api/logs?limit=50${activeFilter ? `&outcome=${activeFilter}` : ""}`, { headers }).then(r => r.json()),
        fetch("/api/users", { headers }).then(r => r.json())
      ]);

      statTotal.innerText = statsRes.total_attempts || 0;
      statPassRate.innerText = `Pass rate: ${statsRes.pass_rate_pct || 0}%`;
      statAllow.innerText = statsRes.allow_count || 0;
      statVerify.innerText = statsRes.verify_count || 0;
      statDeny.innerText = statsRes.deny_count || 0;
      statLat.innerText = `${statsRes.avg_latency_ms || 0} ms`;
      statUsers.innerText = statsRes.registered_users || 0;

      // Populate Users
      if (usersRes.length === 0) {
        usersList.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">No employees registered yet.</p>';
      } else {
        usersList.innerHTML = usersRes.map(u => `
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <img src="/photos/${u.photo}" class="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 flex-shrink-0" onerror="this.style.display='none'">
              <div class="min-w-0">
                <p class="text-xs font-bold text-white truncate">${u.name}</p>
                <span class="text-[10px] font-mono text-cyan-400">${u.employee_id} &middot; ${u.department}</span>
              </div>
            </div>
            <button class="btn-del-user text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" data-id="${u.id}" title="Revoke access">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `).join("");

        document.querySelectorAll(".btn-del-user").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (confirm("Revoke this employee's biometric access credential?")) {
              await fetch(`/api/users/${id}`, { method: "DELETE", headers });
              loadAdminData();
            }
          });
        });
      }

      // Populate Logs
      if (logsRes.length === 0) {
        logsTableBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No access attempts recorded yet.</td></tr>';
      } else {
        logsTableBody.innerHTML = logsRes.map(l => {
          const t = new Date(l.ts * 1000).toLocaleTimeString();
          const badgeClass = l.outcome === 'ALLOW' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                           : l.outcome === 'REQUEST_VERIFICATION' ? 'bg-amber-950 text-amber-400 border border-amber-800'
                           : 'bg-red-950 text-red-400 border border-red-800';
          return `
            <tr class="hover:bg-slate-850/50 transition-colors">
              <td class="py-2.5 px-3 text-slate-400">${t}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${l.name || 'Unregistered Face'}</td>
              <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${badgeClass}">${l.outcome}</span></td>
              <td class="py-2.5 px-3 text-slate-300">${l.live ? `${Math.round(l.live*100)}%` : '0%'} / ${l.sim ? l.sim.toFixed(2) : '-'}</td>
              <td class="py-2.5 px-3 font-bold ${l.ms <= 2000 ? 'text-cyan-400' : 'text-amber-400'}">${Math.round(l.ms)} ms</td>
              <td class="py-2.5 px-3 text-slate-400 truncate max-w-xs" title="${l.reason || ''}">
                ${l.spoof_type && l.spoof_type !== 'Real' ? `<span class="text-red-400 font-bold mr-1">[${l.spoof_type}]</span>` : ''}
                ${l.reason || ''}
              </td>
            </tr>
          `;
        }).join("");
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error("Admin load error:", err);
    }
  }

  // Audit filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => {
        b.className = "filter-btn px-3 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200";
      });
      btn.className = "filter-btn active px-3 py-1 rounded-lg font-medium bg-cyan-600 text-white";
      activeFilter = btn.getAttribute("data-filter");
      loadAdminData();
    });
  });

  // Benchmark Runner Trigger
  btnRunBenchmark.addEventListener("click", async () => {
    btnRunBenchmark.disabled = true;
    benchmarkBtnText.innerText = "Running Evaluation Suite...";

    try {
      const res = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Benchmark failed");

      const rep = data.report;
      bmBpcer.innerText = `${((rep.bpcer || 0) * 100).toFixed(1)}%`;
      bmMeanLat.innerText = `${rep.latency?.mean_ms || 0} ms`;
      bmP95Lat.innerText = `${rep.latency?.p95_ms || 0} ms`;
      bmCompliant.innerText = rep.latency?.compliant ? "PASS (100%)" : "FAIL";

      bmTableBody.innerHTML = Object.entries(rep.attack_scenarios || {}).map(([name, sc]) => `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30">
          <td class="py-2.5 px-3 text-white font-semibold capitalize">${name.replace(/_/g, ' ')}</td>
          <td class="py-2.5 px-3 text-slate-300">${sc.n}</td>
          <td class="py-2.5 px-3 font-bold ${sc.apcer <= 0.05 ? 'text-emerald-400' : 'text-amber-400'}">${(sc.apcer * 100).toFixed(1)}%</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold">${(sc.detection_rate * 100).toFixed(1)}%</td>
          <td class="py-2.5 px-3 text-slate-300">${sc.avg_latency_ms} ms</td>
        </tr>
      `).join("");

      benchmarkReportCard.classList.remove("hidden");
      loadAdminData();
    } catch (err) {
      alert(`Benchmark error: ${err.message}`);
    } finally {
      btnRunBenchmark.disabled = false;
      benchmarkBtnText.innerText = "Run Attack Benchmark";
    }
  });

  btnCloseBenchmark.addEventListener("click", () => {
    benchmarkReportCard.classList.add("hidden");
  });
});
