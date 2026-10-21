(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "s2u-starboard-v1";
  const PROFILE_KEY = "s2u-starboard-profile-v1";
  const PROMPTS = [
    "今日、H2Hのどんなところに心をつかまれた？",
    "今、誰かにおすすめしたいH2Hの曲は？",
    "最近見返したくなったお気に入りの瞬間は？",
    "H2Hをまだ知らない人に、ひとつだけ伝えるなら？",
    "今日の気分にぴったりなH2Hの曲は？",
    "推しの好きなところを、ひとことで表すなら？",
    "H2Hに出会ってから変わったことはある？"
  ];
  const MEMBERS = ["Carmen","Jiwoo","Yuha","Stella","Juun","A-na","Ian","Ye-on"];
  const DEMO_POSTS = [
    {id:"demo-1",name:"月明かりのS2U",member:"Stella",text:"今日ふと見返した動画で、やっぱりステラの表情管理が好きだなってなった。何回見ても新しい発見があるのすごい。",createdAt:Date.now()-1000*60*18,reactions:{"✦":8,"♡":4},replies:[{name:"星を集める人",text:"わかる…見るたび好きが更新される！",createdAt:Date.now()-1000*60*8}],x:73,y:27},
    {id:"demo-2",name:"blue orbit",member:"All",text:"H2Hの曲って、帰り道に聴くといつもの景色がちょっと特別に見える気がする。今日も一日おつかれさま、自分。",createdAt:Date.now()-1000*60*52,reactions:{"✦":12,"♡":7},replies:[],x:24,y:43},
    {id:"demo-3",name:"ゆはの星",member:"Yuha",text:"好きなところをひとつに絞るの無理だったので、今日は声が好き！ということで。明日は別のところを好きって言ってそう。",createdAt:Date.now()-1000*60*60*2,reactions:{"✦":5,"♡":3},replies:[{name:"orbit_08",text:"毎日好きなところ増える現象、あるあるだね",createdAt:Date.now()-1000*60*60}],x:47,y:68},
    {id:"demo-4",name:"CLOUD NINE",member:"Carmen",text:"今日のお題に便乗。初めて見たときのわくわくを今でも覚えてる。好きなものがあるっていいな。",createdAt:Date.now()-1000*60*60*5,reactions:{"✦":9,"♡":2},replies:[],x:83,y:58},
    {id:"demo-5",name:"8つの光",member:"Other",text:"誰かの好きなところを聞くのって楽しい。自分が気づいてなかった魅力を教えてもらえるから、こういう場所が増えたらいいな。",createdAt:Date.now()-1000*60*60*8,reactions:{"✦":15,"♡":6},replies:[],x:35,y:18}
  ];
  let state = loadState();
  let activeFilter = "all";
  let visibleLimit = 5;
  let toastTimer;
  let lastBurstTarget = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.posts)) return saved;
    } catch (_) {}
    return {posts: DEMO_POSTS.map(p => ({...p, reactions:{...p.reactions}, replies:[...p.replies]})), reacted:[]};
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_) { showToast("保存できませんでした。ブラウザの保存容量を確認してください。"); }
  }
  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {name:"旅するS2U"}; }
    catch (_) { return {name:"旅するS2U"}; }
  }
  function saveProfile(name) {
    const p = {name:name.trim().slice(0,20) || "旅するS2U"};
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (_) {}
    $("#navNickname").textContent = p.name;
    $("#nicknameInput").value = p.name;
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function getPrompt() {
    const key = todayKey();
    let hash = 0; for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return PROMPTS[hash % PROMPTS.length];
  }
  function initDateAndPrompt() {
    const d = new Date();
    $("#todayDate").textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
    $("#promptText").textContent = getPrompt();
    $("#promptInsert span:nth-child(2)").textContent = `今日のお題：「${getPrompt()}」`;
    $("#liveCount").textContent = `${state.posts.length + 128} 個の光がここに`;
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function relativeTime(timestamp) {
    const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (mins < 1) return "たった今";
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}日前` : new Date(timestamp).toLocaleDateString("ja-JP");
  }
  function displayMember(member) {
    if (member === "All") return "みんなの星空";
    if (member === "Other") return "箱推し・その他";
    return member;
  }
  function initials(name) {
    const trimmed = (name || "S").trim();
    return [...trimmed][0] || "S";
  }
  function allPosts() { return [...state.posts].sort((a,b) => b.createdAt - a.createdAt); }
  function filteredPosts() {
    let posts = allPosts();
    if (activeFilter !== "all") {
      if (activeFilter === "Other") posts = posts.filter(p => ["Other","All","Juun","A-na","Ian","Ye-on"].includes(p.member));
      else posts = posts.filter(p => p.member === activeFilter || p.member === "All");
    }
    const query = $("#searchInput").value.trim().toLowerCase();
    if (query) posts = posts.filter(p => `${p.name} ${p.text} ${displayMember(p.member)}`.toLowerCase().includes(query));
    if ($("#sortSelect").value === "popular") posts.sort((a,b) => reactionCount(b)-reactionCount(a));
    return posts;
  }
  function reactionCount(post) { return Object.values(post.reactions || {}).reduce((a,b)=>a+b,0); }
  function renderCounts() {
    $("#count-all").textContent = state.posts.length;
    for (const member of ["Carmen","Jiwoo","Yuha","Stella","Other"]) {
      const n = state.posts.filter(p => member === "Other" ? ["Other","All","Juun","A-na","Ian","Ye-on"].includes(p.member) : p.member === member || p.member === "All").length;
      $(`#count-${member}`).textContent = n;
    }
    const total = state.posts.length;
    $("#starTotal").textContent = total.toLocaleString("ja-JP");
    const goal = 100;
    const pct = Math.min(100, Math.round(total / goal * 100));
    $("#progressBar").style.width = `${pct}%`;
    $("#progressPercent").textContent = `${pct}%`;
    $("#progressCaption").textContent = total === 0 ? "最初の星を灯そう" : total >= goal ? "夜空がひとつにつながった！" : `次の節目まであと ${goal-total} 個の星`;
  }
  function renderMap(posts) {
    const map = $("#starMap");
    $$(".map-star", map).forEach(el => el.remove());
    $("#mapLines").innerHTML = "";
    const points = posts.slice(0, 18).map((p, i) => ({
      post:p, x:Number.isFinite(p.x)?p.x:12+((i*37)%76), y:Number.isFinite(p.y)?p.y:13+((i*29)%72)
    }));
    const svg = $("#mapLines");
    for (let i=1; i<points.length; i++) {
      if (i % 3 !== 0) {
        const a=points[i-1], b=points[i];
        const path=document.createElementNS("http://www.w3.org/2000/svg","path");
        path.setAttribute("d",`M ${a.x*4} ${a.y*3.6} L ${b.x*4} ${b.y*3.6}`);
        svg.appendChild(path);
      }
    }
    points.forEach(({post:p,x,y},i) => {
      const btn=document.createElement("button");
      btn.className=`map-star member-${safeClass(p.member)}`;
      btn.style.left=`${x}%`; btn.style.top=`${y}%`; btn.style.setProperty("--twinkle",`${2.3+(i%5)*.45}s`);
      btn.textContent=i%4===0?"✧":"✦";
      btn.title=`${p.name}：${p.text.slice(0,40)}`;
      btn.setAttribute("aria-label",`${p.name}の投稿を開く`);
      btn.addEventListener("click",()=>openDetail(p.id));
      map.appendChild(btn);
    });
  }
  function safeClass(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g,""); }
  function renderFeed() {
    const posts = filteredPosts();
    const visible = posts.slice(0, visibleLimit);
    $("#feedTitle").textContent = activeFilter === "all" ? "みんなが灯した星" : `${displayMember(activeFilter)}の星`;
    $("#feedList").innerHTML = visible.map((p,i) => {
      const reacted = (state.reacted || []).includes(p.id);
      const replies = (p.replies || []).length;
      const heart = p.reactions?.["♡"] || 0;
      const star = p.reactions?.["✦"] || 0;
      return `<article class="post-card" style="animation-delay:${Math.min(i,5)*45}ms">
        <div class="post-head"><div class="post-avatar">${escapeHTML(initials(p.name))}</div><div class="post-author"><b>${escapeHTML(p.name)}</b><small>${escapeHTML(relativeTime(p.createdAt))} · 星を灯しました</small></div><span class="post-member">${escapeHTML(displayMember(p.member))}</span></div>
        <p class="post-content">${escapeHTML(p.text)}</p>
        <div class="post-foot"><button class="reaction-button ${reacted?"reacted":""}" data-react="${escapeHTML(p.id)}" aria-label="共感する">✦ 共感 ${star}</button><button class="reaction-button ${reacted?"reacted":""}" data-heart="${escapeHTML(p.id)}" aria-label="好き">♡ ${heart}</button><button class="reply-button" data-detail="${escapeHTML(p.id)}">↳ 返信 ${replies}</button><button class="share-button" data-share="${escapeHTML(p.id)}">↗ シェア</button><span class="post-time">${p.replies?.length ? "会話が続いています" : "ひとつの光"}</span></div>
      </article>`;
    }).join("");
    $("#emptyState").classList.toggle("hidden", posts.length > 0);
    $("#feedList").classList.toggle("hidden", posts.length === 0);
    $("#loadMoreButton").classList.toggle("hidden", posts.length <= visibleLimit);
    renderMap(posts);
    renderCounts();
  }
  function showToast(message) {
    const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove("show"),2600);
  }
  function openDialog(id) { const d=$( `#${id}` ); if (d && !d.open) d.showModal(); }
  function closeDialog(id) { const d=$( `#${id}` ); if (d?.open) d.close(); }
  function openPost(prefillPrompt=false) {
    $("#nicknameInput").value=getProfile().name;
    if (prefillPrompt) $("#postText").value=getPrompt();
    $("#charCount").textContent=`${$("#postText").value.length} / 180`;
    openDialog("postDialog");
    setTimeout(()=>$("#postText").focus(),100);
  }
  function createPost(event) {
    event.preventDefault();
    const name=$("#nicknameInput").value.trim().slice(0,20);
    const text=$("#postText").value.trim();
    const member=$("#memberSelect").value;
    if (!name || !text) { showToast("ニックネームとひとことを入力してね。"); return; }
    if (text.length > 180) { showToast("ひとことは180文字以内でお願いします。"); return; }
    saveProfile(name);
    const p={id:`p-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,member,text,createdAt:Date.now(),reactions:{"✦":0,"♡":0},replies:[],x:12+Math.random()*76,y:13+Math.random()*72};
    state.posts.unshift(p); saveState(); activeFilter="all"; visibleLimit=Math.max(visibleLimit,5);
    $$(".constellation-card").forEach(c=>c.classList.toggle("selected",c.dataset.filter==="all"));
    $("#searchInput").value=""; $("#sortSelect").value="new"; $("#postForm").reset(); $("#charCount").textContent="0 / 180";
    closeDialog("postDialog"); renderFeed(); $("#feedList").scrollIntoView({behavior:"smooth",block:"start"}); burstAt($("#starTotal")); showToast("あなたの想いが星空に灯りました ✦");
  }
  function burstAt(target) {
    if (!target) return;
    const r=target.getBoundingClientRect(), star=document.createElement("span");
    star.className="new-star-burst"; star.textContent="✦"; star.style.left=`${r.left+r.width/2}px`; star.style.top=`${r.top}px`;
    document.body.appendChild(star); setTimeout(()=>star.remove(),1000);
  }
  function openDetail(id) {
    const p=state.posts.find(x=>x.id===id); if (!p) return;
    const content=$("#detailContent");
    content.innerHTML=`<div class="detail-content-head"><span class="section-kicker">A STAR IN OUR SKY</span><h2>${escapeHTML(p.name)} <span style="font-size:11px;color:#94b5ff">✦ ${escapeHTML(displayMember(p.member))}</span></h2><small style="color:#7f92b7;font-size:9px">${escapeHTML(relativeTime(p.createdAt))}</small></div>
      <p class="detail-content-text">${escapeHTML(p.text)}</p>
      <div class="post-foot"><button class="reaction-button ${(state.reacted||[]).includes(p.id)?"reacted":""}" data-react="${escapeHTML(p.id)}">✦ 共感 ${p.reactions?.["✦"]||0}</button><button class="reaction-button" data-heart="${escapeHTML(p.id)}">♡ ${p.reactions?.["♡"]||0}</button><button class="share-button" data-share="${escapeHTML(p.id)}">↗ シェア</button></div>
      <div class="reply-list">${(p.replies||[]).length ? p.replies.map(r=>`<div class="reply-item"><b>${escapeHTML(r.name)}</b><p>${escapeHTML(r.text)}</p></div>`).join("") : `<p style="font-size:10px;color:#7f91b4">まだ返信はありません。最初の言葉を届けてみよう。</p>`}</div>
      <form class="reply-form" id="replyForm" data-reply-to="${escapeHTML(p.id)}"><label class="field-label" for="replyName">返信する</label><input class="text-field" id="replyName" maxlength="20" placeholder="ニックネーム" value="${escapeHTML(getProfile().name)}" required><textarea class="text-field text-area" id="replyText" maxlength="180" rows="2" placeholder="やさしい言葉を届けよう…" required></textarea><button class="primary-button small" type="submit">返信を灯す ↗</button></form>
      <p class="demo-warning">デモ版：返信はこのブラウザ内に保存されます。</p>`;
    openDialog("detailDialog");
  }
  function reactTo(id, type) {
    const p=state.posts.find(x=>x.id===id); if (!p) return;
    if (!p.reactions) p.reactions={"✦":0,"♡":0};
    if (!state.reacted) state.reacted=[];
    if (state.reacted.includes(id)) {
      p.reactions[type]=Math.max(0,(p.reactions[type]||0)-1);
      state.reacted=state.reacted.filter(x=>x!==id);
      showToast("リアクションを取り消しました。");
    } else {
      p.reactions[type]=(p.reactions[type]||0)+1;
      state.reacted.push(id);
      showToast("星の気持ちを届けました ✦");
    }
    saveState(); renderFeed();
    if ($("#detailDialog").open) openDetail(id);
  }
  function submitReply(event) {
    const form=event.target.closest("#replyForm"); if (!form) return;
    event.preventDefault();
    const p=state.posts.find(x=>x.id===form.dataset.replyTo); if (!p) return;
    const name=$("#replyName").value.trim().slice(0,20), text=$("#replyText").value.trim();
    if (!name || !text) return;
    saveProfile(name); p.replies=p.replies||[]; p.replies.push({name,text,createdAt:Date.now()});
    saveState(); renderFeed(); openDetail(p.id); showToast("返信を星空に届けました。");
  }
  async function sharePost(id) {
    const p=state.posts.find(x=>x.id===id); if (!p) return;
    const text=`${p.text}\n\n${displayMember(p.member)}の星より ✦\n#S2U星空掲示板 #Hearts2Hearts`;
    if (navigator.share) {
      try { await navigator.share({title:"S2U STARBOARD",text,url:location.href}); return; } catch (e) { if (e.name==="AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("シェア文をコピーしました。Xに貼り付けてね。");
    } catch (_) {
      const w=window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`,"_blank","noopener");
      if (!w) showToast("シェア文をコピーできませんでした。");
    }
  }
  function initCanvas() {
    const canvas=$("#starfield"), ctx=canvas.getContext("2d");
    let w=0,h=0,stars=[],raf=0;
    function resize() {
      const dpr=Math.min(window.devicePixelRatio||1,2);
      w=window.innerWidth; h=window.innerHeight; canvas.width=w*dpr; canvas.height=h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
      stars=Array.from({length:Math.min(150,Math.floor(w*h/8000))},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.2+.25,a:Math.random()*.55+.12,s:Math.random()*.006+.002,phase:Math.random()*Math.PI*2,drift:(Math.random()-.5)*.08}));
    }
    function draw() {
      ctx.clearRect(0,0,w,h);
      for (const s of stars) {
        s.phase+=s.s; s.y+=s.drift;
        if(s.y>h+3)s.y=-3; if(s.y< -3)s.y=h+3;
        const alpha=s.a*(.65+.35*Math.sin(s.phase));
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fillStyle=`rgba(188,211,255,${alpha})`; ctx.fill();
      }
      raf=requestAnimationFrame(draw);
    }
    resize(); draw(); window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)cancelAnimationFrame(raf);else draw();});
  }
  function initEvents() {
    ["writeButton","bottomWriteButton","emptyWriteButton"].forEach(id=>$("#"+id).addEventListener("click",()=>openPost(false)));
    $("#answerPromptButton").addEventListener("click",()=>openPost(true));
    $("#insertPromptButton").addEventListener("click",()=>{$("#postText").value=getPrompt();$("#charCount").textContent=`${$("#postText").value.length} / 180`;$("#postText").focus();});
    $("#postText").addEventListener("input",()=>$("#charCount").textContent=`${$("#postText").value.length} / 180`);
    $("#postForm").addEventListener("submit",createPost);
    $("#profileButton").addEventListener("click",()=>{$("#profileNameInput").value=getProfile().name;openDialog("profileDialog");});
    $("#profileForm").addEventListener("submit",e=>{e.preventDefault();saveProfile($("#profileNameInput").value);closeDialog("profileDialog");showToast("ニックネームを保存しました。");});
    $$("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeDialog(btn.dataset.close)));
    [$("#postDialog"),$("#detailDialog"),$("#profileDialog")].forEach(d=>d.addEventListener("click",e=>{if(e.target===d)d.close();}));
    $("#constellationGrid").addEventListener("click",e=>{
      const card=e.target.closest("[data-filter]"); if(!card)return;
      activeFilter=card.dataset.filter; visibleLimit=5;
      $$(".constellation-card").forEach(c=>c.classList.toggle("selected",c===card));
      renderFeed(); $("#feedTitle").scrollIntoView({behavior:"smooth",block:"center"});
    });
    $("#allStarsButton").addEventListener("click",()=>{$('[data-filter="all"]').click();$("#feedTitle").scrollIntoView({behavior:"smooth",block:"center"});});
    $("#searchInput").addEventListener("input",()=>{visibleLimit=5;renderFeed();});
    $("#sortSelect").addEventListener("change",renderFeed);
    $("#loadMoreButton").addEventListener("click",()=>{visibleLimit+=5;renderFeed();});
    $("#feedList").addEventListener("click",e=>{
      const react=e.target.closest("[data-react]"); if(react){reactTo(react.dataset.react,"✦");return;}
      const heart=e.target.closest("[data-heart]"); if(heart){reactTo(heart.dataset.heart,"♡");return;}
      const detail=e.target.closest("[data-detail]"); if(detail){openDetail(detail.dataset.detail);return;}
      const share=e.target.closest("[data-share]"); if(share){sharePost(share.dataset.share);return;}
    });
    $("#starMap").addEventListener("click",e=>{const star=e.target.closest("[data-post]");if(star)openDetail(star.dataset.post);});
    $("#detailContent").addEventListener("click",e=>{
      const react=e.target.closest("[data-react]");if(react){reactTo(react.dataset.react,"✦");return;}
      const heart=e.target.closest("[data-heart]");if(heart){reactTo(heart.dataset.heart,"♡");return;}
      const share=e.target.closest("[data-share]");if(share)sharePost(share.dataset.share);
    });
    $("#detailContent").addEventListener("submit",submitReply);
  }
  function init() {
    saveProfile(getProfile().name);
    initDateAndPrompt(); initCanvas(); initEvents(); renderFeed();
  }
  init();
})();