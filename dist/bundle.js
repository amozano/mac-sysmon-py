var T=class{ws=null;metricsListeners=new Set;stateListeners=new Set;state="disconnected";reconnectAttempts=0;reconnectTimer=null;isExplicitlyClosed=!1;constructor(){this.fetchInitialSnapshot(),this.connect()}async fetchInitialSnapshot(){try{let e=await this.getSystemMetrics();this.notifyMetrics(e)}catch(e){console.warn("Initial REST snapshot fetch skipped or failed:",e)}}connect(){if(this.ws&&(this.ws.readyState===WebSocket.OPEN||this.ws.readyState===WebSocket.CONNECTING))return;this.isExplicitlyClosed=!1,this.setState("connecting");let t=`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/ws`;try{this.ws=new WebSocket(t),this.ws.onopen=()=>{this.reconnectAttempts=0,this.setState("connected")},this.ws.onmessage=a=>{let s;try{s=JSON.parse(a.data)}catch(r){console.error("Failed to parse WebSocket JSON payload:",r);return}try{this.notifyMetrics(s)}catch(r){console.error("Error in notifyMetrics handler:",r)}},this.ws.onerror=a=>{console.warn("WebSocket encountered error:",a),this.setState("error")},this.ws.onclose=()=>{this.setState("disconnected"),this.scheduleReconnect()}}catch(a){console.error("Failed to initialize WebSocket:",a),this.setState("error"),this.scheduleReconnect()}}scheduleReconnect(){if(this.isExplicitlyClosed||this.reconnectTimer!==null)return;this.reconnectAttempts++;let e=Math.min(1e3*Math.pow(1.5,this.reconnectAttempts),1e4);this.reconnectTimer=window.setTimeout(()=>{this.reconnectTimer=null,this.connect()},e)}close(){this.isExplicitlyClosed=!0,this.reconnectTimer!==null&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null),this.ws&&(this.ws.close(),this.ws=null),this.setState("disconnected")}setState(e){if(this.state!==e){this.state=e;for(let t of this.stateListeners)t(e)}}onMetrics(e){return this.metricsListeners.add(e),()=>this.metricsListeners.delete(e)}onStateChange(e){return this.stateListeners.add(e),e(this.state),()=>this.stateListeners.delete(e)}notifyMetrics(e){for(let t of this.metricsListeners)try{t(e)}catch(a){console.error("Error executing metrics listener:",a)}}async getSystemMetrics(){let e=await fetch("/api/system");if(!e.ok)throw new Error(`HTTP ${e.status}: ${e.statusText}`);let t=await e.json();if(!t.data)throw new Error(t.message||"No data received");return t.data}async getProcessDetail(e){let t=await fetch(`/api/processes/${e}`);if(!t.ok)throw new Error(`HTTP ${t.status}: ${t.statusText}`);let a=await t.json();if(!a.data)throw new Error(a.message||"Process detail not found");return a.data}async killProcess(e,t="SIGTERM"){return await(await fetch(`/api/processes/${e}/kill`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({signal:t})})).json()}};var b=class{canvas;ctx;data=[];options;resizeObserver;constructor(e,t={}){this.canvas=e;let a=e.getContext("2d");if(!a)throw new Error("Canvas 2D context not supported");this.ctx=a,this.options={strokeColor:t.strokeColor||"#0A84FF",fillColorStart:t.fillColorStart||"rgba(10, 132, 255, 0.35)",fillColorEnd:t.fillColorEnd||"rgba(10, 132, 255, 0.02)",maxPoints:t.maxPoints||60,minVal:t.minVal??0,maxVal:t.maxVal??100,lineWidth:t.lineWidth||2,showPoints:t.showPoints??!1},this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(this.canvas),this.resize()}push(e){this.data.push(e),this.data.length>this.options.maxPoints&&this.data.shift(),this.render()}setData(e){this.data=e.slice(-this.options.maxPoints),this.render()}resize(){let e=window.devicePixelRatio||1,t=this.canvas.getBoundingClientRect();t.width===0||t.height===0||(this.canvas.width=Math.floor(t.width*e),this.canvas.height=Math.floor(t.height*e),this.ctx.setTransform(1,0,0,1,0,0),this.ctx.scale(e,e),this.render())}render(){let e=this.canvas.getBoundingClientRect(),t=e.width,a=e.height;if(t<=0||a<=0||(this.ctx.clearRect(0,0,t,a),this.data.length<2))return;let s=this.options.minVal,r=this.options.maxVal;(this.options.maxVal===0||Math.max(...this.data)>r)&&(r=Math.max(...this.data,1));let i=r-s||1,n=t/(this.options.maxPoints-1),o=t-(this.data.length-1)*n,l=this.data.map((h,g)=>{let C=o+g*n,S=Math.max(0,Math.min(1,(h-s)/i)),w=a-S*(a-6)-3;return[C,w]});this.ctx.beginPath(),this.ctx.moveTo(l[0][0],a);for(let[h,g]of l)this.ctx.lineTo(h,g);this.ctx.lineTo(l[l.length-1][0],a),this.ctx.closePath();let c=this.ctx.createLinearGradient(0,0,0,a);c.addColorStop(0,this.options.fillColorStart),c.addColorStop(1,this.options.fillColorEnd),this.ctx.fillStyle=c,this.ctx.fill(),this.ctx.beginPath(),this.ctx.moveTo(l[0][0],l[0][1]);for(let h=1;h<l.length;h++)this.ctx.lineTo(l[h][0],l[h][1]);this.ctx.strokeStyle=this.options.strokeColor,this.ctx.lineWidth=this.options.lineWidth,this.ctx.lineCap="round",this.ctx.lineJoin="round",this.ctx.stroke();let v=l[l.length-1];this.ctx.beginPath(),this.ctx.arc(v[0],v[1],3.5,0,Math.PI*2),this.ctx.fillStyle=this.options.strokeColor,this.ctx.fill(),this.ctx.strokeStyle="#FFFFFF",this.ctx.lineWidth=1.5,this.ctx.stroke()}destroy(){this.resizeObserver.disconnect()}},M=class{canvas;ctx;percentage=0;color;label;constructor(e,t="",a="#0A84FF"){this.canvas=e;let s=e.getContext("2d");if(!s)throw new Error("2D context not available");this.ctx=s,this.label=t,this.color=a,this.resize()}setPercentage(e){this.percentage=Math.max(0,Math.min(100,e)),this.render()}resize(){let e=window.devicePixelRatio||1,t=this.canvas.getBoundingClientRect();t.width===0||t.height===0||(this.canvas.width=Math.floor(t.width*e),this.canvas.height=Math.floor(t.height*e),this.ctx.setTransform(1,0,0,1,0,0),this.ctx.scale(e,e),this.render())}render(){let e=this.canvas.getBoundingClientRect(),t=e.width,a=e.height;if(t<=0||a<=0)return;let s=t/2,r=a/2,i=Math.min(t,a)/2-10;if(i<=0)return;let n=this.ctx;n.clearRect(0,0,t,a);let o=.75*Math.PI,l=2.25*Math.PI,c=l-o;n.beginPath(),n.arc(s,r,i,o,l),n.strokeStyle="rgba(255, 255, 255, 0.1)",n.lineWidth=10,n.lineCap="round",n.stroke();let v=o+this.percentage/100*c;n.beginPath(),n.arc(s,r,i,o,v),n.strokeStyle=this.color,n.lineWidth=10,n.lineCap="round",n.stroke(),n.textAlign="center",n.textBaseline="middle",n.fillStyle="#FFFFFF",n.font=`600 ${Math.floor(i*.48)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`,n.fillText(`${this.percentage.toFixed(1)}%`,s,r-4),this.label&&(n.font=`500 ${Math.floor(i*.22)}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`,n.fillStyle="rgba(255, 255, 255, 0.6)",n.fillText(this.label,s,r+i*.35))}};var L=class{container;coreSparklines=new Map;overallSparkline=null;renderedCoresCount=0;constructor(e){this.container=e,this.renderSkeleton()}renderSkeleton(){this.container.innerHTML=`
      <div class="view-header">
        <div>
          <h2>CPU Core Inspector</h2>
          <p class="view-subtitle" id="cpu-arch-brand">Apple Silicon Architecture</p>
        </div>
        <div class="load-badge-group">
          <div class="load-pill">
            <span class="load-label">1m</span>
            <strong id="cpu-view-load1">0.00</strong>
          </div>
          <div class="load-pill">
            <span class="load-label">5m</span>
            <strong id="cpu-view-load5">0.00</strong>
          </div>
          <div class="load-pill">
            <span class="load-label">15m</span>
            <strong id="cpu-view-load15">0.00</strong>
          </div>
        </div>
      </div>

      <!-- CPU Overall Banner -->
      <div class="card overall-cpu-banner mb-4">
        <div class="banner-stat">
          <span class="banner-label">Overall CPU Utilization</span>
          <div class="banner-val-row">
            <span class="banner-number" id="cpu-overall-number">0.0%</span>
            <div class="progress-track-banner">
              <div class="progress-fill banner-fill" id="cpu-overall-bar" style="width: 0%;"></div>
            </div>
          </div>
        </div>
        <div class="banner-chart-box">
          <canvas id="cpu-overall-sparkline" height="56"></canvas>
        </div>
      </div>

      <!-- Core Grid -->
      <div class="cores-section-title">
        <h3>Individual Core Utilization</h3>
        <span class="subtext" id="cores-count-label">-- Cores Active</span>
      </div>

      <div class="core-grid" id="core-grid-container">
        <div class="loading-state">Initializing CPU core sensors...</div>
      </div>
    `;let e=this.container.querySelector("#cpu-overall-sparkline");e&&(this.overallSparkline=new b(e,{strokeColor:"#0A84FF",fillColorStart:"rgba(10, 132, 255, 0.4)",fillColorEnd:"rgba(10, 132, 255, 0.02)",maxVal:100}))}update(e){let t=this.container.querySelector("#cpu-arch-brand");t&&(t.textContent=`${e.system_info.cpu_brand} (${e.system_info.cpu_arch}) \u2022 ${e.system_info.physical_core_count} Physical / ${e.system_info.total_core_count} Logical Cores`);let a=this.container.querySelector("#cpu-view-load1"),s=this.container.querySelector("#cpu-view-load5"),r=this.container.querySelector("#cpu-view-load15");a&&(a.textContent=e.cpu.load_average[0].toFixed(2)),s&&(s.textContent=e.cpu.load_average[1].toFixed(2)),r&&(r.textContent=e.cpu.load_average[2].toFixed(2));let i=this.container.querySelector("#cpu-overall-number"),n=this.container.querySelector("#cpu-overall-bar");i&&(i.textContent=`${e.cpu.global_usage.toFixed(1)}%`),n&&(n.style.width=`${Math.min(100,e.cpu.global_usage)}%`),this.overallSparkline&&this.overallSparkline.push(e.cpu.global_usage);let o=this.container.querySelector("#cores-count-label");o&&(o.textContent=`${e.cpu.cores.length} Cores Live`);let l=this.container.querySelector("#core-grid-container");l&&(this.renderedCoresCount!==e.cpu.cores.length&&(this.renderedCoresCount=e.cpu.cores.length,this.coreSparklines.forEach(c=>c.destroy()),this.coreSparklines.clear(),l.innerHTML=e.cpu.cores.map(c=>`
            <div class="card core-card" id="core-card-${c.id}">
              <div class="core-card-header">
                <div class="core-id-box">
                  <span class="core-name">${c.name}</span>
                  <span class="core-freq" id="core-freq-${c.id}">${c.frequency_mhz>0?`${c.frequency_mhz} MHz`:"Dynamic"}</span>
                </div>
                <strong class="core-usage-val" id="core-val-${c.id}">${c.usage.toFixed(1)}%</strong>
              </div>
              <div class="progress-track core-track">
                <div class="progress-fill core-fill" id="core-fill-${c.id}" style="width: ${c.usage}%;"></div>
              </div>
              <div class="core-chart-wrap">
                <canvas id="core-spark-${c.id}" class="core-spark-canvas" height="34"></canvas>
              </div>
            </div>
          `).join(""),e.cpu.cores.forEach(c=>{let v=this.container.querySelector(`#core-spark-${c.id}`);if(v){let h=new b(v,{strokeColor:"#30D158",fillColorStart:"rgba(48, 209, 88, 0.35)",fillColorEnd:"rgba(48, 209, 88, 0.02)",maxVal:100,lineWidth:1.5});this.coreSparklines.set(c.id,h)}})),e.cpu.cores.forEach(c=>{let v=this.container.querySelector(`#core-val-${c.id}`),h=this.container.querySelector(`#core-fill-${c.id}`),g=this.container.querySelector(`#core-freq-${c.id}`);v&&(v.textContent=`${c.usage.toFixed(1)}%`),h&&(h.style.width=`${Math.min(100,c.usage)}%`,c.usage>85?h.style.backgroundColor="var(--color-red)":c.usage>65?h.style.backgroundColor="var(--color-orange)":h.style.backgroundColor="var(--color-green)"),g&&c.frequency_mhz>0&&(g.textContent=`${c.frequency_mhz} MHz`);let C=this.coreSparklines.get(c.id);C&&C.push(c.usage)}))}resize(){this.overallSparkline&&this.overallSparkline.resize(),this.coreSparklines.forEach(e=>e.resize())}};function d(m,e=1){if(m===0)return"0 B";let t=1024,a=e<0?0:e,s=["B","KB","MB","GB","TB","PB"],r=Math.floor(Math.log(m)/Math.log(t)),i=Math.min(r,s.length-1);return`${parseFloat((m/Math.pow(t,i)).toFixed(a))} ${s[i]}`}function y(m){return`${d(m,1)}/s`}function V(m){let e=Math.floor(m/86400),t=Math.floor(m%86400/3600),a=Math.floor(m%3600/60);return e>0?`${e}d ${t}h ${a}m`:t>0?`${t}h ${a}m`:`${a}m`}function u(m){return m.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}var $=class{container;cpuGauge=null;memGauge=null;cpuSparkline=null;memSparkline=null;netSparkline=null;diskSparkline=null;onSelectProcess;constructor(e,t){this.container=e,this.onSelectProcess=t,this.renderSkeleton()}renderSkeleton(){this.container.innerHTML=`
      <div class="dashboard-grid">
        <!-- CPU Card -->
        <div class="card metric-card cpu-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon cpu-icon">\u26A1</span>
              <h3>CPU Utilization</h3>
            </div>
            <div class="card-badge" id="cpu-core-count">-- Cores</div>
          </div>
          <div class="metric-body">
            <div class="gauge-container">
              <canvas id="cpu-gauge-canvas" width="130" height="130"></canvas>
            </div>
            <div class="metric-details">
              <div class="load-avg-row">
                <div class="load-stat">
                  <span class="stat-label">1m Load</span>
                  <span class="stat-value" id="cpu-load-1">--</span>
                </div>
                <div class="load-stat">
                  <span class="stat-label">5m Load</span>
                  <span class="stat-value" id="cpu-load-5">--</span>
                </div>
                <div class="load-stat">
                  <span class="stat-label">15m Load</span>
                  <span class="stat-value" id="cpu-load-15">--</span>
                </div>
              </div>
              <div class="chart-box">
                <div class="chart-header-mini">History (60s)</div>
                <canvas id="cpu-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Memory Card -->
        <div class="card metric-card memory-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon mem-icon">\u{1F9E0}</span>
              <h3>Memory (Unified RAM)</h3>
            </div>
            <div class="card-badge" id="mem-total-badge">-- GB Total</div>
          </div>
          <div class="metric-body">
            <div class="gauge-container">
              <canvas id="mem-gauge-canvas" width="130" height="130"></canvas>
            </div>
            <div class="metric-details">
              <div class="stats-grid-2x2">
                <div class="stat-item">
                  <span class="stat-label">Used</span>
                  <span class="stat-value" id="mem-used-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Available</span>
                  <span class="stat-value" id="mem-avail-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Swap / Compressed</span>
                  <span class="stat-value" id="mem-swap-val">--</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Free</span>
                  <span class="stat-value" id="mem-free-val">--</span>
                </div>
              </div>
              <div class="chart-box">
                <div class="chart-header-mini">Memory Pressure History</div>
                <canvas id="mem-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Storage Card -->
        <div class="card metric-card storage-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon disk-icon">\u{1F4BE}</span>
              <h3>Storage & Disks</h3>
            </div>
            <div class="io-rates" id="disk-io-rate">
              <span>\u2193 <strong id="disk-read-rate">0 B/s</strong></span>
              <span>\u2191 <strong id="disk-write-rate">0 B/s</strong></span>
            </div>
          </div>
          <div class="storage-summary-body" id="storage-summary-list">
            <div class="loading-state">Scanning storage volumes...</div>
          </div>
          <div class="chart-box mt-2">
            <div class="chart-header-mini">Disk I/O Activity</div>
            <canvas id="disk-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
          </div>
        </div>

        <!-- Network Card -->
        <div class="card metric-card network-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon net-icon">\u{1F310}</span>
              <h3>Network Throughput</h3>
            </div>
            <div class="io-rates">
              <span>\u2193 <strong id="net-rx-rate">0 B/s</strong></span>
              <span>\u2191 <strong id="net-tx-rate">0 B/s</strong></span>
            </div>
          </div>
          <div class="net-summary-body">
            <div class="net-stat-row">
              <div class="net-stat-col">
                <span class="net-sublabel">Total Downloaded</span>
                <span class="net-big-val" id="net-total-rx">--</span>
              </div>
              <div class="net-stat-col">
                <span class="net-sublabel">Total Uploaded</span>
                <span class="net-big-val" id="net-total-tx">--</span>
              </div>
            </div>
            <div class="chart-box mt-3">
              <div class="chart-header-mini">Throughput History (60s)</div>
              <canvas id="net-sparkline-canvas" class="sparkline-canvas" height="48"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Consumers Row -->
      <div class="top-consumers-row mt-4">
        <!-- Top CPU Consumers -->
        <div class="card consumer-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon">\u{1F525}</span>
              <h3>Top Applications by CPU</h3>
            </div>
            <span class="subtext">Click app to inspect</span>
          </div>
          <div class="consumer-list" id="top-cpu-list">
            <div class="loading-state">Analyzing active threads...</div>
          </div>
        </div>

        <!-- Top Memory Consumers -->
        <div class="card consumer-card">
          <div class="card-header">
            <div class="card-title">
              <span class="card-icon">\u{1F4C8}</span>
              <h3>Top Applications by Memory</h3>
            </div>
            <span class="subtext">Click app to inspect</span>
          </div>
          <div class="consumer-list" id="top-mem-list">
            <div class="loading-state">Analyzing resident memory...</div>
          </div>
        </div>
      </div>
    `;let e=this.container.querySelector("#cpu-gauge-canvas");e&&(this.cpuGauge=new M(e,"CPU Load","#0A84FF"));let t=this.container.querySelector("#mem-gauge-canvas");t&&(this.memGauge=new M(t,"Memory","#30D158"));let a=this.container.querySelector("#cpu-sparkline-canvas");a&&(this.cpuSparkline=new b(a,{strokeColor:"#0A84FF",fillColorStart:"rgba(10, 132, 255, 0.4)",fillColorEnd:"rgba(10, 132, 255, 0.02)",maxVal:100}));let s=this.container.querySelector("#mem-sparkline-canvas");s&&(this.memSparkline=new b(s,{strokeColor:"#30D158",fillColorStart:"rgba(48, 209, 88, 0.4)",fillColorEnd:"rgba(48, 209, 88, 0.02)",maxVal:100}));let r=this.container.querySelector("#net-sparkline-canvas");r&&(this.netSparkline=new b(r,{strokeColor:"#64D2FF",fillColorStart:"rgba(100, 210, 255, 0.4)",fillColorEnd:"rgba(100, 210, 255, 0.02)",maxVal:0}));let i=this.container.querySelector("#disk-sparkline-canvas");i&&(this.diskSparkline=new b(i,{strokeColor:"#FF9F0A",fillColorStart:"rgba(255, 159, 10, 0.4)",fillColorEnd:"rgba(255, 159, 10, 0.02)",maxVal:0}))}update(e){this.cpuGauge&&this.cpuGauge.setPercentage(e.cpu.global_usage),this.cpuSparkline&&this.cpuSparkline.push(e.cpu.global_usage);let t=this.container.querySelector("#cpu-core-count");t&&(t.textContent=`${e.system_info.total_core_count} Cores (${e.system_info.cpu_arch})`);let a=this.container.querySelector("#cpu-load-1"),s=this.container.querySelector("#cpu-load-5"),r=this.container.querySelector("#cpu-load-15");a&&(a.textContent=e.cpu.load_average[0].toFixed(2)),s&&(s.textContent=e.cpu.load_average[1].toFixed(2)),r&&(r.textContent=e.cpu.load_average[2].toFixed(2)),this.memGauge&&this.memGauge.setPercentage(e.memory.usage_percent),this.memSparkline&&this.memSparkline.push(e.memory.usage_percent);let i=this.container.querySelector("#mem-total-badge");i&&(i.textContent=`${d(e.memory.total_bytes,0)} Total`);let n=this.container.querySelector("#mem-used-val"),o=this.container.querySelector("#mem-avail-val"),l=this.container.querySelector("#mem-swap-val"),c=this.container.querySelector("#mem-free-val");n&&(n.textContent=d(e.memory.used_bytes)),o&&(o.textContent=d(e.memory.available_bytes)),l&&(l.textContent=`${d(e.memory.swap_used_bytes)} / ${d(e.memory.swap_total_bytes)}`),c&&(c.textContent=d(e.memory.free_bytes));let v=this.container.querySelector("#disk-read-rate"),h=this.container.querySelector("#disk-write-rate");v&&(v.textContent=y(e.disk_io.read_bytes_per_sec)),h&&(h.textContent=y(e.disk_io.written_bytes_per_sec)),this.diskSparkline&&this.diskSparkline.push(e.disk_io.read_bytes_per_sec+e.disk_io.written_bytes_per_sec);let g=this.container.querySelector("#storage-summary-list");g&&e.disks.length>0&&(g.innerHTML=e.disks.slice(0,3).map(k=>{let p=k.usage_percent,f=p>90?"var(--color-red)":p>80?"var(--color-orange)":"var(--color-blue)";return`
            <div class="disk-row-item">
              <div class="disk-meta-row">
                <div class="disk-name-box">
                  <span class="disk-name-label">${k.name}</span>
                  <span class="disk-mount-label">${k.mount_point} (${k.file_system.toUpperCase()})</span>
                </div>
                <div class="disk-space-box">
                  <span>${d(k.used_bytes)} / ${d(k.total_bytes)}</span>
                  <strong class="disk-pct">${p.toFixed(1)}%</strong>
                </div>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${p}%; background-color: ${f};"></div>
              </div>
            </div>
          `}).join(""));let C=this.container.querySelector("#net-rx-rate"),S=this.container.querySelector("#net-tx-rate"),w=this.container.querySelector("#net-total-rx"),x=this.container.querySelector("#net-total-tx");C&&(C.textContent=y(e.network.received_bytes_per_sec)),S&&(S.textContent=y(e.network.transmitted_bytes_per_sec)),w&&(w.textContent=d(e.network.total_received_bytes)),x&&(x.textContent=d(e.network.total_transmitted_bytes)),this.netSparkline&&this.netSparkline.push(e.network.received_bytes_per_sec+e.network.transmitted_bytes_per_sec),this.updateTopConsumers(e)}updateTopConsumers(e){let t=[...e.processes].filter(i=>i.cpu_usage>.1).sort((i,n)=>n.cpu_usage-i.cpu_usage).slice(0,5),a=this.container.querySelector("#top-cpu-list");a&&(t.length===0?a.innerHTML='<div class="empty-state">System idle (no high CPU processes)</div>':(a.innerHTML=t.map(i=>{let n=i.app_name||i.name,o=t[0].cpu_usage||100,l=Math.min(100,Math.max(5,i.cpu_usage/o*100));return`
              <div class="consumer-row" data-pid="${i.pid}">
                <div class="consumer-info">
                  <div class="consumer-title-box">
                    <span class="consumer-name">${n}</span>
                    <span class="consumer-pid">PID ${i.pid}</span>
                  </div>
                  <div class="consumer-stat">
                    <strong>${i.cpu_usage.toFixed(1)}%</strong>
                  </div>
                </div>
                <div class="progress-track-mini">
                  <div class="progress-fill cpu-fill" style="width: ${l}%;"></div>
                </div>
              </div>
            `}).join(""),a.querySelectorAll(".consumer-row").forEach(i=>{i.addEventListener("click",()=>{let n=parseInt(i.getAttribute("data-pid")||"0",10);n>0&&this.onSelectProcess(n)})})));let s=[...e.processes].filter(i=>i.memory_bytes>10*1024*1024).sort((i,n)=>n.memory_bytes-i.memory_bytes).slice(0,5),r=this.container.querySelector("#top-mem-list");r&&(s.length===0?r.innerHTML='<div class="empty-state">No significant memory consumers</div>':(r.innerHTML=s.map(i=>{let n=i.app_name||i.name,o=s[0].memory_bytes||1,l=Math.min(100,Math.max(5,i.memory_bytes/o*100));return`
              <div class="consumer-row" data-pid="${i.pid}">
                <div class="consumer-info">
                  <div class="consumer-title-box">
                    <span class="consumer-name">${n}</span>
                    <span class="consumer-pid">PID ${i.pid}</span>
                  </div>
                  <div class="consumer-stat">
                    <span>${d(i.memory_bytes)}</span>
                    <strong class="text-sub">(${i.memory_percent.toFixed(1)}%)</strong>
                  </div>
                </div>
                <div class="progress-track-mini">
                  <div class="progress-fill mem-fill" style="width: ${l}%;"></div>
                </div>
              </div>
            `}).join(""),r.querySelectorAll(".consumer-row").forEach(i=>{i.addEventListener("click",()=>{let n=parseInt(i.getAttribute("data-pid")||"0",10);n>0&&this.onSelectProcess(n)})})))}resize(){this.cpuGauge&&this.cpuGauge.resize(),this.memGauge&&this.memGauge.resize(),this.cpuSparkline&&this.cpuSparkline.resize(),this.memSparkline&&this.memSparkline.resize(),this.netSparkline&&this.netSparkline.resize(),this.diskSparkline&&this.diskSparkline.resize()}};var E=class{container;diskIoSparkline=null;onSelectProcess;constructor(e,t){this.container=e,this.onSelectProcess=t,this.renderSkeleton()}renderSkeleton(){this.container.innerHTML=`
      <div class="view-header">
        <div>
          <h2>Storage & Disks Inspector</h2>
          <p class="view-subtitle">APFS Containers, Physical Volumes & Real-Time Disk Throughput</p>
        </div>
        <div class="disk-rates-banner">
          <div class="io-pill">
            <span class="io-arrow text-blue">\u2193</span>
            <span class="io-text">Read: <strong id="dv-read-rate">0 B/s</strong></span>
          </div>
          <div class="io-pill">
            <span class="io-arrow text-orange">\u2191</span>
            <span class="io-text">Write: <strong id="dv-write-rate">0 B/s</strong></span>
          </div>
        </div>
      </div>

      <!-- Live Disk I/O Graph -->
      <div class="card mb-4">
        <div class="card-header">
          <div class="card-title">
            <span class="card-icon">\u26A1</span>
            <h3>Total Disk I/O Activity (Read + Write Throughput)</h3>
          </div>
        </div>
        <div class="chart-box">
          <canvas id="disk-io-sparkline" height="70"></canvas>
        </div>
      </div>

      <!-- Mounted Disks Section -->
      <div class="section-title-group mb-2">
        <h3>Mounted Volumes & APFS Partitions</h3>
        <span class="subtext" id="disks-count-sub">-- Volumes Detected</span>
      </div>

      <div class="disks-cards-grid mb-4" id="disks-cards-container">
        <div class="loading-state">Inspecting disk partitions...</div>
      </div>

      <!-- Top Disk Consumers Table -->
      <div class="card table-card">
        <div class="card-header">
          <h3>Active Process Disk I/O Consumers</h3>
          <span class="subtext">Processes actively generating read/write throughput</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Application / Process</th>
                <th>Read Rate</th>
                <th>Write Rate</th>
                <th>Lifetime Read</th>
                <th>Lifetime Written</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="disk-proc-tbody">
              <tr><td colspan="7" class="loading-state">Measuring process I/O rates...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;let e=this.container.querySelector("#disk-io-sparkline");e&&(this.diskIoSparkline=new b(e,{strokeColor:"#FF9F0A",fillColorStart:"rgba(255, 159, 10, 0.4)",fillColorEnd:"rgba(255, 159, 10, 0.02)",maxVal:0}))}update(e){let t=this.container.querySelector("#dv-read-rate"),a=this.container.querySelector("#dv-write-rate");t&&(t.textContent=y(e.disk_io.read_bytes_per_sec)),a&&(a.textContent=y(e.disk_io.written_bytes_per_sec)),this.diskIoSparkline&&this.diskIoSparkline.push(e.disk_io.read_bytes_per_sec+e.disk_io.written_bytes_per_sec);let s=this.container.querySelector("#disks-count-sub");s&&(s.textContent=`${e.disks.length} Volumes Mounted`);let r=this.container.querySelector("#disks-cards-container");r&&e.disks.length>0&&(r.innerHTML=e.disks.map(o=>{let l=o.usage_percent,c=l>90?"var(--color-red)":l>80?"var(--color-orange)":"var(--color-blue)",v=o.is_removable?'<span class="badge-removable">Removable</span>':"";return`
            <div class="card disk-detail-card">
              <div class="disk-card-header">
                <div class="disk-title-box">
                  <span class="disk-icon-big">\u{1F4BE}</span>
                  <div>
                    <h4 class="disk-h4">${o.name}</h4>
                    <span class="disk-path">${o.mount_point}</span>
                  </div>
                </div>
                ${v}
              </div>

              <div class="disk-stats-row mt-3">
                <div class="disk-stat-col">
                  <span class="d-label">Used Space</span>
                  <span class="d-val font-mono">${d(o.used_bytes)}</span>
                </div>
                <div class="disk-stat-col">
                  <span class="d-label">Available Free</span>
                  <span class="d-val font-mono text-green">${d(o.available_bytes)}</span>
                </div>
                <div class="disk-stat-col">
                  <span class="d-label">Total Capacity</span>
                  <span class="d-val font-mono">${d(o.total_bytes)}</span>
                </div>
              </div>

              <div class="progress-track mt-3">
                <div class="progress-fill" style="width: ${l}%; background-color: ${c};"></div>
              </div>
              <div class="disk-pct-label mt-1">
                <span>${l.toFixed(1)}% full</span>
                <span class="text-muted">FS: ${o.file_system.toUpperCase()} \u2022 ${o.kind}</span>
              </div>
            </div>
          `}).join(""));let i=[...e.processes].filter(o=>o.disk_read_bytes_per_sec>0||o.disk_written_bytes_per_sec>0||o.total_read_bytes>10*1024*1024).sort((o,l)=>l.disk_read_bytes_per_sec+l.disk_written_bytes_per_sec-(o.disk_read_bytes_per_sec+o.disk_written_bytes_per_sec)||l.total_written_bytes-o.total_written_bytes).slice(0,10),n=this.container.querySelector("#disk-proc-tbody");n&&(i.length===0?n.innerHTML='<tr><td colspan="7" class="empty-state">No significant disk I/O activity detected</td></tr>':(n.innerHTML=i.map(o=>{let l=o.app_name||o.name,c=o.is_app?'<span class="badge-app">APP</span>':"";return`
              <tr class="proc-table-row" data-pid="${o.pid}">
                <td class="font-mono text-muted">${o.pid}</td>
                <td>
                  <div class="proc-name-cell">
                    <span class="proc-name-title">${l}</span>
                    ${c}
                  </div>
                </td>
                <td class="font-mono text-blue font-bold">${y(o.disk_read_bytes_per_sec)}</td>
                <td class="font-mono text-orange font-bold">${y(o.disk_written_bytes_per_sec)}</td>
                <td class="font-mono text-muted">${d(o.total_read_bytes)}</td>
                <td class="font-mono text-muted">${d(o.total_written_bytes)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm inspect-btn" data-pid="${o.pid}">Inspect</button>
                </td>
              </tr>
            `}).join(""),n.querySelectorAll(".inspect-btn").forEach(o=>{o.addEventListener("click",l=>{l.stopPropagation();let c=parseInt(o.getAttribute("data-pid")||"0",10);c>0&&this.onSelectProcess(c)})}),n.querySelectorAll(".proc-table-row").forEach(o=>{o.addEventListener("click",()=>{let l=parseInt(o.getAttribute("data-pid")||"0",10);l>0&&this.onSelectProcess(l)})})))}resize(){this.diskIoSparkline&&this.diskIoSparkline.resize()}};var P=class{container;memorySparkline=null;swapSparkline=null;onSelectProcess;constructor(e,t){this.container=e,this.onSelectProcess=t,this.renderSkeleton()}renderSkeleton(){this.container.innerHTML=`
      <div class="view-header">
        <div>
          <h2>Memory Inspector</h2>
          <p class="view-subtitle">Unified Memory Architecture & Swap Management</p>
        </div>
        <div class="mem-pressure-badge" id="mem-pressure-pill">
          <span class="pressure-dot normal"></span>
          <span id="mem-pressure-label">Pressure: Normal</span>
        </div>
      </div>

      <!-- Memory Overview Cards -->
      <div class="mem-stat-cards-grid mb-4">
        <div class="card mem-subcard">
          <span class="subcard-label">Total Unified RAM</span>
          <span class="subcard-val" id="mem-v-total">--</span>
          <span class="subcard-hint">Hardware Pool</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Active / Used RAM</span>
          <span class="subcard-val text-blue" id="mem-v-used">--</span>
          <span class="subcard-hint" id="mem-v-used-pct">--% utilized</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Available / Cache</span>
          <span class="subcard-val text-green" id="mem-v-avail">--</span>
          <span class="subcard-hint">Immediately allocatable</span>
        </div>
        <div class="card mem-subcard">
          <span class="subcard-label">Swap / Compressed</span>
          <span class="subcard-val text-purple" id="mem-v-swap">--</span>
          <span class="subcard-hint" id="mem-v-swap-pct">SSD Paged</span>
        </div>
      </div>

      <!-- Segmented Memory Distribution Bar -->
      <div class="card mem-distribution-card mb-4">
        <div class="card-header">
          <h3>Unified Memory Allocation</h3>
          <span class="subtext" id="mem-dist-sub">Real-time allocation</span>
        </div>
        <div class="stacked-bar-container">
          <div class="stacked-bar-fill bar-used" id="bar-mem-used" style="width: 50%;"></div>
          <div class="stacked-bar-fill bar-avail" id="bar-mem-avail" style="width: 30%;"></div>
          <div class="stacked-bar-fill bar-free" id="bar-mem-free" style="width: 20%;"></div>
        </div>
        <div class="stacked-bar-legend">
          <div class="legend-item"><span class="legend-box bar-used"></span> Used Memory (<span id="leg-used-bytes">--</span>)</div>
          <div class="legend-item"><span class="legend-box bar-avail"></span> Available Cache (<span id="leg-avail-bytes">--</span>)</div>
          <div class="legend-item"><span class="legend-box bar-free"></span> Free (<span id="leg-free-bytes">--</span>)</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="dashboard-grid mb-4">
        <div class="card chart-card">
          <div class="card-header">
            <h3>Physical RAM History (60s)</h3>
          </div>
          <div class="chart-box">
            <canvas id="mem-history-chart" height="70"></canvas>
          </div>
        </div>
        <div class="card chart-card">
          <div class="card-header">
            <h3>Swap Memory History</h3>
          </div>
          <div class="chart-box">
            <canvas id="swap-history-chart" height="70"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Memory Applications Table -->
      <div class="card table-card">
        <div class="card-header">
          <h3>Top Memory Consumer Processes</h3>
          <span class="subtext">Ranked by Resident Set Size (RSS)</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Process / Application</th>
                <th>Resident (RAM)</th>
                <th>Share %</th>
                <th>Virtual Mem</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="mem-proc-tbody">
              <tr><td colspan="7" class="loading-state">Loading process memory rankings...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;let e=this.container.querySelector("#mem-history-chart");e&&(this.memorySparkline=new b(e,{strokeColor:"#30D158",fillColorStart:"rgba(48, 209, 88, 0.4)",fillColorEnd:"rgba(48, 209, 88, 0.02)",maxVal:100}));let t=this.container.querySelector("#swap-history-chart");t&&(this.swapSparkline=new b(t,{strokeColor:"#BF5AF2",fillColorStart:"rgba(191, 90, 242, 0.4)",fillColorEnd:"rgba(191, 90, 242, 0.02)",maxVal:0}))}update(e){let t=e.memory.total_bytes,a=e.memory.used_bytes,s=e.memory.available_bytes,r=e.memory.free_bytes,i=e.memory.swap_used_bytes,n=e.memory.swap_total_bytes,o=this.container.querySelector("#mem-v-total"),l=this.container.querySelector("#mem-v-used"),c=this.container.querySelector("#mem-v-used-pct"),v=this.container.querySelector("#mem-v-avail"),h=this.container.querySelector("#mem-v-swap"),g=this.container.querySelector("#mem-v-swap-pct");if(o&&(o.textContent=d(t)),l&&(l.textContent=d(a)),c&&(c.textContent=`${e.memory.usage_percent.toFixed(1)}% utilized`),v&&(v.textContent=d(s)),h&&(h.textContent=`${d(i)} / ${d(n)}`),g){let p=n>0?i/n*100:0;g.textContent=`${p.toFixed(1)}% swap utilized`}let C=this.container.querySelector("#mem-pressure-pill"),S=this.container.querySelector(".pressure-dot"),w=this.container.querySelector("#mem-pressure-label");if(S&&w&&(e.memory.usage_percent>90?(S.className="pressure-dot critical",w.textContent="Pressure: Critical (>90%)"):e.memory.usage_percent>75?(S.className="pressure-dot warning",w.textContent="Pressure: Warning (>75%)"):(S.className="pressure-dot normal",w.textContent="Pressure: Normal")),t>0){let p=a/t*100,f=Math.min(100-p,s/t*100),_=Math.max(0,100-p-f),F=this.container.querySelector("#bar-mem-used"),H=this.container.querySelector("#bar-mem-avail"),R=this.container.querySelector("#bar-mem-free");F&&(F.style.width=`${p}%`),H&&(H.style.width=`${f}%`),R&&(R.style.width=`${_}%`);let B=this.container.querySelector("#leg-used-bytes"),D=this.container.querySelector("#leg-avail-bytes"),z=this.container.querySelector("#leg-free-bytes");B&&(B.textContent=d(a)),D&&(D.textContent=d(s)),z&&(z.textContent=d(r))}this.memorySparkline&&this.memorySparkline.push(e.memory.usage_percent),this.swapSparkline&&this.swapSparkline.push(i);let x=[...e.processes].filter(p=>p.memory_bytes>5*1024*1024).sort((p,f)=>f.memory_bytes-p.memory_bytes).slice(0,12),k=this.container.querySelector("#mem-proc-tbody");k&&(x.length===0?k.innerHTML='<tr><td colspan="7" class="empty-state">No significant memory consumers found</td></tr>':(k.innerHTML=x.map(p=>{let f=p.app_name||p.name,_=p.is_app?'<span class="badge-app">APP</span>':"";return`
              <tr class="proc-table-row" data-pid="${p.pid}">
                <td class="font-mono text-muted">${p.pid}</td>
                <td>
                  <div class="proc-name-cell">
                    <span class="proc-name-title">${f}</span>
                    ${_}
                  </div>
                </td>
                <td class="font-mono font-bold">${d(p.memory_bytes)}</td>
                <td class="font-mono">
                  <div class="share-cell">
                    <span>${p.memory_percent.toFixed(1)}%</span>
                    <div class="mini-bar-track">
                      <div class="mini-bar-fill mem-fill" style="width: ${Math.min(100,p.memory_percent*4)}%;"></div>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-muted">${d(p.virtual_memory_bytes)}</td>
                <td><span class="status-tag status-${p.status.toLowerCase()}">${p.status}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm inspect-btn" data-pid="${p.pid}">Inspect</button>
                </td>
              </tr>
            `}).join(""),k.querySelectorAll(".inspect-btn").forEach(p=>{p.addEventListener("click",f=>{f.stopPropagation();let _=parseInt(p.getAttribute("data-pid")||"0",10);_>0&&this.onSelectProcess(_)})}),k.querySelectorAll(".proc-table-row").forEach(p=>{p.addEventListener("click",()=>{let f=parseInt(p.getAttribute("data-pid")||"0",10);f>0&&this.onSelectProcess(f)})})))}resize(){this.memorySparkline&&this.memorySparkline.resize(),this.swapSparkline&&this.swapSparkline.resize()}};var I=class{container;onTabSelect;currentTab="overview";constructor(e,t){this.container=e,this.onTabSelect=t,this.render()}render(){this.container.innerHTML=`
      <header class="app-header">
        <div class="header-left">
          <div class="window-controls">
            <span class="control-dot close"></span>
            <span class="control-dot minimize"></span>
            <span class="control-dot zoom"></span>
          </div>
          <div class="app-branding">
            <div class="app-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div class="app-title-group">
              <span class="app-name">mac-sysmon</span>
              <span class="app-version">v0.1.0</span>
            </div>
          </div>
          <div class="sys-badge-group" id="sys-info-pills">
            <span class="sys-pill" id="pill-host">Host: --</span>
            <span class="sys-pill" id="pill-os">macOS --</span>
            <span class="sys-pill" id="pill-uptime">Uptime: --</span>
          </div>
        </div>

        <nav class="header-center">
          <div class="segmented-control">
            <button class="segment-btn active" data-tab="overview">
              <span class="icon">\u{1F4CA}</span>
              <span>Overview</span>
              <span class="kbd-hint">\u23181</span>
            </button>
            <button class="segment-btn" data-tab="cpu">
              <span class="icon">\u26A1</span>
              <span>CPU Cores</span>
              <span class="kbd-hint">\u23182</span>
            </button>
            <button class="segment-btn" data-tab="memory">
              <span class="icon">\u{1F9E0}</span>
              <span>Memory</span>
              <span class="kbd-hint">\u23183</span>
            </button>
            <button class="segment-btn" data-tab="disks">
              <span class="icon">\u{1F4BE}</span>
              <span>Storage</span>
              <span class="kbd-hint">\u23184</span>
            </button>
            <button class="segment-btn" data-tab="processes">
              <span class="icon">\u2699\uFE0F</span>
              <span>Processes</span>
              <span class="kbd-hint">\u23185</span>
            </button>
          </div>
        </nav>

        <div class="header-right">
          <div class="connection-status-badge" id="conn-badge">
            <span class="status-indicator-dot connecting"></span>
            <span class="status-label" id="conn-label">Connecting</span>
          </div>
        </div>
      </header>
    `,this.container.querySelectorAll(".segment-btn").forEach(t=>{t.addEventListener("click",()=>{let a=t.getAttribute("data-tab");a&&this.setTab(a)})})}setTab(e){if(this.currentTab===e)return;this.currentTab=e,this.container.querySelectorAll(".segment-btn").forEach(a=>{a.getAttribute("data-tab")===e?a.classList.add("active"):a.classList.remove("active")}),this.onTabSelect(e)}updateSystemInfo(e){let t=this.container.querySelector("#pill-host"),a=this.container.querySelector("#pill-os"),s=this.container.querySelector("#pill-uptime");t&&(t.textContent=e.hostname),a&&(a.textContent=`${e.os_name} ${e.os_version}`),s&&(s.textContent=`Up: ${V(e.uptime_secs)}`)}updateConnectionState(e){let t=this.container.querySelector("#conn-badge"),a=this.container.querySelector(".status-indicator-dot"),s=this.container.querySelector("#conn-label");if(!(!t||!a||!s))switch(a.className=`status-indicator-dot ${e}`,e){case"connected":s.textContent="LIVE (1Hz)";break;case"connecting":s.textContent="Connecting...";break;case"disconnected":s.textContent="Disconnected";break;case"error":s.textContent="Error";break}}};var q=class{container;client;processes=[];searchQuery="";filterAppsOnly=!1;sortField="cpu_usage";sortOrder="desc";selectedPid=null;modalContainer=null;constructor(e,t){this.container=e,this.client=t,this.renderSkeleton()}renderSkeleton(){this.container.innerHTML=`
      <div class="view-header">
        <div>
          <h2>Process & Application Manager</h2>
          <p class="view-subtitle" id="proc-summary-subtitle">Live Process Monitor</p>
        </div>
        <div class="proc-actions-bar">
          <div class="search-box-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              id="proc-search-input"
              class="search-input"
              placeholder="Filter processes by name or PID... (\u2318F)"
              autocomplete="off"
              spellcheck="false"
            />
            <button id="clear-search-btn" class="clear-search-btn" style="display: none;">\u2715</button>
          </div>

          <div class="filter-toggle-group">
            <label class="toggle-pill">
              <input type="checkbox" id="toggle-apps-only" />
              <span>Apps Only</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Process Table Card -->
      <div class="card table-card mt-3">
        <div class="table-responsive">
          <table class="data-table proc-table" id="process-table">
            <thead>
              <tr>
                <th data-sort="pid" class="sortable">PID <span class="sort-indicator"></span></th>
                <th data-sort="name" class="sortable">Application / Process Name <span class="sort-indicator"></span></th>
                <th data-sort="cpu_usage" class="sortable active desc">CPU % <span class="sort-indicator">\u25BC</span></th>
                <th data-sort="memory_bytes" class="sortable">RAM (RSS) <span class="sort-indicator"></span></th>
                <th>RAM Share</th>
                <th data-sort="disk_read" class="sortable">Disk Read <span class="sort-indicator"></span></th>
                <th data-sort="disk_write" class="sortable">Disk Write <span class="sort-indicator"></span></th>
                <th data-sort="user" class="sortable">User <span class="sort-indicator"></span></th>
                <th data-sort="status" class="sortable">Status <span class="sort-indicator"></span></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="proc-table-tbody">
              <tr><td colspan="10" class="loading-state">Populating process table...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span id="proc-count-display">Showing 0 processes</span>
          <span class="subtext">Click any header to sort \u2022 Click row to inspect</span>
        </div>
      </div>

      <!-- Modal Container -->
      <div id="proc-modal-host"></div>
    `;let e=this.container.querySelector("#proc-search-input"),t=this.container.querySelector("#clear-search-btn");e&&e.addEventListener("input",r=>{this.searchQuery=r.target.value.trim().toLowerCase(),t&&(t.style.display=this.searchQuery?"block":"none"),this.renderTableBody()}),t&&e&&t.addEventListener("click",()=>{e.value="",this.searchQuery="",t.style.display="none",e.focus(),this.renderTableBody()});let a=this.container.querySelector("#toggle-apps-only");a&&a.addEventListener("change",()=>{this.filterAppsOnly=a.checked,this.renderTableBody()});let s=this.container.querySelectorAll("th.sortable");s.forEach(r=>{r.addEventListener("click",()=>{let i=r.getAttribute("data-sort");if(!i)return;this.sortField===i?this.sortOrder=this.sortOrder==="asc"?"desc":"asc":(this.sortField=i,this.sortOrder=i==="name"||i==="user"||i==="pid"?"asc":"desc"),s.forEach(o=>{o.classList.remove("active","asc","desc");let l=o.querySelector(".sort-indicator");l&&(l.textContent="")}),r.classList.add("active",this.sortOrder);let n=r.querySelector(".sort-indicator");n&&(n.textContent=this.sortOrder==="asc"?"\u25B2":"\u25BC"),this.renderTableBody()})}),this.modalContainer=this.container.querySelector("#proc-modal-host")}updateProcesses(e){this.processes=e,this.renderTableBody();let t=this.container.querySelector("#proc-summary-subtitle");if(t){let a=e.filter(s=>s.is_app).length;t.textContent=`${e.length} Total Processes \u2022 ${a} User Applications Active`}}focusSearch(){let e=this.container.querySelector("#proc-search-input");e&&(e.focus(),e.select())}selectAndInspect(e){this.selectedPid=e,this.openInspectModal(e)}renderTableBody(){let e=this.container.querySelector("#proc-table-tbody");if(!e)return;let t=this.processes;if(this.filterAppsOnly&&(t=t.filter(s=>s.is_app)),this.searchQuery){let s=this.searchQuery;t=t.filter(r=>r.pid.toString().includes(s)||r.name.toLowerCase().includes(s)||r.app_name&&r.app_name.toLowerCase().includes(s)||r.user_name&&r.user_name.toLowerCase().includes(s)||r.exe_path&&r.exe_path.toLowerCase().includes(s))}t.sort((s,r)=>{let i,n;switch(this.sortField){case"pid":i=s.pid,n=r.pid;break;case"name":i=(s.app_name||s.name).toLowerCase(),n=(r.app_name||r.name).toLowerCase();break;case"cpu_usage":i=s.cpu_usage,n=r.cpu_usage;break;case"memory_bytes":i=s.memory_bytes,n=r.memory_bytes;break;case"disk_read":i=s.disk_read_bytes_per_sec,n=r.disk_read_bytes_per_sec;break;case"disk_write":i=s.disk_written_bytes_per_sec,n=r.disk_written_bytes_per_sec;break;case"user":i=(s.user_name||"").toLowerCase(),n=(r.user_name||"").toLowerCase();break;case"status":i=s.status.toLowerCase(),n=r.status.toLowerCase();break;default:i=s.cpu_usage,n=r.cpu_usage}return i<n?this.sortOrder==="asc"?-1:1:i>n?this.sortOrder==="asc"?1:-1:0});let a=this.container.querySelector("#proc-count-display");if(a&&(a.textContent=`Showing ${t.length} of ${this.processes.length} processes`),t.length===0){e.innerHTML=`
        <tr>
          <td colspan="10" class="empty-state">
            No processes match "${u(this.searchQuery)}"
          </td>
        </tr>
      `;return}e.innerHTML=t.map(s=>{let r=s.app_name||s.name,i=s.is_app,n=i?'<span class="badge-app">APP</span>':"",o=s.cpu_usage>50?"text-red font-bold":s.cpu_usage>15?"text-orange font-bold":"";return`
          <tr class="proc-table-row ${this.selectedPid===s.pid?"selected":""}" data-pid="${s.pid}">
            <td class="font-mono text-muted">${s.pid}</td>
            <td>
              <div class="proc-name-cell">
                <span class="proc-icon">${i?"\u{1F4E6}":"\u2699\uFE0F"}</span>
                <span class="proc-name-title" title="${u(s.exe_path||s.name)}">${u(r)}</span>
                ${n}
              </div>
            </td>
            <td class="font-mono ${o}">${s.cpu_usage.toFixed(1)}%</td>
            <td class="font-mono font-bold">${d(s.memory_bytes)}</td>
            <td class="font-mono">
              <div class="share-cell">
                <span>${s.memory_percent.toFixed(1)}%</span>
                <div class="mini-bar-track">
                  <div class="mini-bar-fill mem-fill" style="width: ${Math.min(100,s.memory_percent*4)}%;"></div>
                </div>
              </div>
            </td>
            <td class="font-mono text-blue">${s.disk_read_bytes_per_sec>0?y(s.disk_read_bytes_per_sec):"-"}</td>
            <td class="font-mono text-orange">${s.disk_written_bytes_per_sec>0?y(s.disk_written_bytes_per_sec):"-"}</td>
            <td class="text-sub font-mono">${u(s.user_name||s.user_id||"system")}</td>
            <td><span class="status-tag status-${s.status.toLowerCase()}">${s.status}</span></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary btn-xs inspect-action-btn" data-pid="${s.pid}" title="Inspect process details">
                  Inspect
                </button>
                <button class="btn btn-danger btn-xs kill-action-btn" data-pid="${s.pid}" data-name="${u(r)}" title="Terminate process">
                  End
                </button>
              </div>
            </td>
          </tr>
        `}).join(""),e.querySelectorAll(".inspect-action-btn").forEach(s=>{s.addEventListener("click",r=>{r.stopPropagation();let i=parseInt(s.getAttribute("data-pid")||"0",10);i>0&&this.openInspectModal(i)})}),e.querySelectorAll(".kill-action-btn").forEach(s=>{s.addEventListener("click",r=>{r.stopPropagation();let i=parseInt(s.getAttribute("data-pid")||"0",10),n=s.getAttribute("data-name")||`PID ${i}`;i>0&&this.promptKillConfirmation(i,n)})}),e.querySelectorAll(".proc-table-row").forEach(s=>{s.addEventListener("click",()=>{let r=parseInt(s.getAttribute("data-pid")||"0",10);r>0&&this.openInspectModal(r)})})}async openInspectModal(e){if(this.modalContainer){this.modalContainer.innerHTML=`
      <div class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Inspect Process (PID ${e})</h3>
            <button class="modal-close-btn" id="modal-close-x">\u2715</button>
          </div>
          <div class="modal-body" id="modal-content-body">
            <div class="loading-state">Retrieving kernel process inspection data...</div>
          </div>
        </div>
      </div>
    `,this.bindModalClose();try{let t=await this.client.getProcessDetail(e),a=this.modalContainer.querySelector("#modal-content-body");if(!a)return;let s=t.process,r=s.cmd&&s.cmd.length>0?s.cmd.join(" "):s.exe_path||s.name;a.innerHTML=`
        <div class="modal-inspect-grid">
          <div class="inspect-field">
            <span class="field-label">Process Name</span>
            <span class="field-val"><strong>${u(s.app_name||s.name)}</strong></span>
          </div>
          <div class="inspect-field">
            <span class="field-label">PID / Parent PID</span>
            <span class="field-val font-mono">PID: ${s.pid} \u2022 PPID: ${t.parent_pid??"None (root/daemon)"}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">User / UID</span>
            <span class="field-val font-mono">${u(s.user_name||"unknown")} (${s.user_id||"0"})</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Status</span>
            <span class="field-val"><span class="status-tag status-${s.status.toLowerCase()}">${s.status}</span></span>
          </div>
          <div class="inspect-field">
            <span class="field-label">CPU Usage</span>
            <span class="field-val font-mono">${s.cpu_usage.toFixed(1)}%</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Memory (RSS / Virt)</span>
            <span class="field-val font-mono">${d(s.memory_bytes)} (${s.memory_percent.toFixed(1)}%) \u2022 Virt: ${d(s.virtual_memory_bytes)}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Disk I/O</span>
            <span class="field-val font-mono">Read: ${y(s.disk_read_bytes_per_sec)} \u2022 Write: ${y(s.disk_written_bytes_per_sec)}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Executable Path</span>
            <span class="field-val font-mono text-break">${u(s.exe_path||"Unknown")}</span>
          </div>
          <div class="inspect-field">
            <span class="field-label">Current Working Directory</span>
            <span class="field-val font-mono text-break">${u(t.cwd||"N/A")}</span>
          </div>
          <div class="inspect-field full-width">
            <span class="field-label">Full Command Line</span>
            <pre class="code-box">${u(r)}</pre>
          </div>
        </div>

        <div class="modal-footer mt-4">
          <div class="kill-btn-group">
            <button class="btn btn-secondary btn-sm" id="btn-term-sig">Send SIGTERM (Graceful End)</button>
            <button class="btn btn-danger btn-sm" id="btn-kill-sig">Send SIGKILL (Force Quit)</button>
          </div>
          <button class="btn btn-primary btn-sm" id="modal-done-btn">Done</button>
        </div>
      `;let i=a.querySelector("#btn-term-sig"),n=a.querySelector("#btn-kill-sig"),o=a.querySelector("#modal-done-btn");i&&i.addEventListener("click",()=>this.sendSignal(e,"SIGTERM")),n&&n.addEventListener("click",()=>this.sendSignal(e,"SIGKILL")),o&&o.addEventListener("click",()=>this.closeModal())}catch(t){let a=this.modalContainer.querySelector("#modal-content-body");if(a){a.innerHTML=`
          <div class="error-banner">
            <p>Failed to retrieve process details: ${u(t.message||String(t))}</p>
            <p class="subtext">The process may have already exited.</p>
          </div>
          <div class="modal-footer mt-4">
            <button class="btn btn-secondary btn-sm" id="modal-done-btn">Close</button>
          </div>
        `;let s=a.querySelector("#modal-done-btn");s&&s.addEventListener("click",()=>this.closeModal())}}}}promptKillConfirmation(e,t){if(!this.modalContainer)return;this.modalContainer.innerHTML=`
      <div class="modal-backdrop">
        <div class="modal-card modal-confirm">
          <div class="modal-header">
            <h3>Terminate Process?</h3>
            <button class="modal-close-btn" id="modal-close-x">\u2715</button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to terminate <strong>${u(t)}</strong> (PID <code>${e}</code>)?</p>
            <p class="text-sub mt-2">Choose termination signal level:</p>
            <div class="signal-options mt-3">
              <label class="radio-pill">
                <input type="radio" name="kill_sig" value="SIGTERM" checked />
                <span>SIGTERM (15) - Clean Graceful Shutdown</span>
              </label>
              <label class="radio-pill">
                <input type="radio" name="kill_sig" value="SIGKILL" />
                <span>SIGKILL (9) - Immediate Force Termination</span>
              </label>
            </div>
            <div id="kill-feedback-banner" class="mt-3"></div>
          </div>
          <div class="modal-footer mt-4">
            <button class="btn btn-secondary btn-sm" id="modal-cancel-btn">Cancel</button>
            <button class="btn btn-danger btn-sm" id="modal-confirm-kill-btn">Terminate Process</button>
          </div>
        </div>
      </div>
    `,this.bindModalClose();let a=this.modalContainer.querySelector("#modal-cancel-btn");a&&a.addEventListener("click",()=>this.closeModal());let s=this.modalContainer.querySelector("#modal-confirm-kill-btn");s&&s.addEventListener("click",async()=>{let i=this.modalContainer?.querySelector('input[name="kill_sig"]:checked')?.value||"SIGTERM";await this.sendSignal(e,i)})}async sendSignal(e,t){let a=this.modalContainer?.querySelector("#kill-feedback-banner");try{let s=await this.client.killProcess(e,t);s.success?(a&&(a.innerHTML=`<div class="success-banner">\u2713 ${u(s.message)}</div>`),setTimeout(()=>this.closeModal(),1200)):a&&(a.innerHTML=`<div class="error-banner">\u2717 ${u(s.message)}</div>`)}catch(s){a&&(a.innerHTML=`<div class="error-banner">\u2717 Failed to send signal: ${u(s.message)}</div>`)}}bindModalClose(){let e=this.modalContainer?.querySelector("#modal-close-x");e&&e.addEventListener("click",()=>this.closeModal());let t=this.modalContainer?.querySelector(".modal-backdrop");t&&t.addEventListener("click",a=>{a.target===t&&this.closeModal()})}closeModal(){this.modalContainer&&(this.modalContainer.innerHTML="")}};var A=class{client;navbar;dashboard;cpuView;memoryView;disksView;processManager;currentTab="overview";latestMetrics=null;constructor(){this.client=new T;let e=document.getElementById("navbar-container"),t=document.getElementById("tab-overview"),a=document.getElementById("tab-cpu"),s=document.getElementById("tab-memory"),r=document.getElementById("tab-disks"),i=document.getElementById("tab-processes"),n=o=>{this.switchTab("processes"),this.processManager.selectAndInspect(o)};this.navbar=new I(e,o=>this.switchTab(o)),this.dashboard=new $(t,n),this.cpuView=new L(a),this.memoryView=new P(s,n),this.disksView=new E(r,n),this.processManager=new q(i,this.client),this.setupEvents(),this.setupKeybindings()}setupEvents(){this.client.onStateChange(e=>{this.navbar.updateConnectionState(e)}),this.client.onMetrics(e=>{this.latestMetrics=e;try{this.navbar.updateSystemInfo(e.system_info)}catch(t){console.error("Failed to update navbar:",t)}try{this.dashboard.update(e)}catch(t){console.error("Failed to update dashboard:",t)}try{this.processManager.updateProcesses(e.processes)}catch(t){console.error("Failed to update process manager:",t)}try{this.cpuView.update(e)}catch(t){console.error("Failed to update CPU view:",t)}try{this.memoryView.update(e)}catch(t){console.error("Failed to update memory view:",t)}try{this.disksView.update(e)}catch(t){console.error("Failed to update disks view:",t)}}),window.addEventListener("resize",()=>{this.dashboard.resize(),this.cpuView.resize(),this.memoryView.resize(),this.disksView.resize()})}setupKeybindings(){window.addEventListener("keydown",e=>{if(e.metaKey||e.ctrlKey)switch(e.key){case"1":e.preventDefault(),this.switchTab("overview");break;case"2":e.preventDefault(),this.switchTab("cpu");break;case"3":e.preventDefault(),this.switchTab("memory");break;case"4":e.preventDefault(),this.switchTab("disks");break;case"5":e.preventDefault(),this.switchTab("processes");break;case"f":e.preventDefault(),this.switchTab("processes"),this.processManager.focusSearch();break}})}switchTab(e){if(this.currentTab=e,this.navbar.setTab(e),["overview","cpu","memory","disks","processes"].forEach(a=>{let s=document.getElementById(`tab-${a}`);s&&(s.style.display=a===e?"block":"none")}),this.latestMetrics)try{e==="overview"?this.dashboard.update(this.latestMetrics):e==="cpu"?this.cpuView.update(this.latestMetrics):e==="memory"?this.memoryView.update(this.latestMetrics):e==="disks"?this.disksView.update(this.latestMetrics):e==="processes"&&this.processManager.updateProcesses(this.latestMetrics.processes)}catch(a){console.error(`Failed to refresh tab ${e} on switch:`,a)}setTimeout(()=>{try{e==="overview"?this.dashboard.resize():e==="cpu"?this.cpuView.resize():e==="memory"?this.memoryView.resize():e==="disks"&&this.disksView.resize()}catch(a){console.error(`Failed to resize tab ${e}:`,a)}},40)}};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{new A}):new A;
//# sourceMappingURL=bundle.js.map
