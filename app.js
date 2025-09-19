const $ = q => document.querySelector;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ----------- 符号缓存 ----------- */
const dbName = 'cute_sym';
let db;
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onerror = () => reject();
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('sym'))
        e.target.result.createObjectStore('sym');
    };
  });
}
async function getSym(w) {
  return new Promise(res => {
    const tx = db.transaction('sym', 'readonly');
    const req = tx.objectStore('sym').get(w);
    req.onsuccess = () => res(req.result);
  });
}
async function setSym(w, sym) {
  const tx = db.transaction('sym', 'readwrite');
  tx.objectStore('sym').put(sym, w);
}

/* ----------- 三引擎 ----------- */
const engines = {
  async gemini(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyD4ZSGN7qIT3oea1pKjV4pYFpJqO8p5ZIQ`;
    const body = {contents: [{parts: [{text: `Translate into English:\n${text}`}]}]};
    try {
      const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const j = await r.json();
      return j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch { return ''; }
  },
  async bing(text) {
    try {
      const res = await fetch('https://www.bing.com/ttranslatev3?isVertical=1', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({fromLang: 'zh-Hans', text, to: 'en'})
      });
      const j = await res.json();
      return j?.[0]?.translations?.[0]?.text || '';
    } catch { return ''; }
  },
  local(text) { return text; } // 本地无模型时原文输出
};

/* ----------- 鬼畜 ----------- */
async function guichu(en) {
  if (!en) return '';                       // 保底
  const words = en.split(/\s+/);
  const out = [];
  for (const w of words) {
    const low = w.toLowerCase();
    let sym = await getSym(low);
    if (!sym) {
      // 问 Gemini 要符号
      const prompt = `You are a one-char-replacer.Reply ONLY 1 character (math/ASCII优先,emoji最后) for "${low}".No explanation.`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyD4ZSGN7qIT3oea1pKjV4pYFpJqO8p5ZIQ`;
      try {
        const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contents: [{parts: [{text: prompt}]}]})});
        const j = await r.json();
        sym = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.[0] || low[0];
      } catch {
        sym = low[0];
      }
      await setSym(low, sym);
    }
    out.push(sym);
  }
  // 打乱节奏
  return out.join('').split('').sort(() => Math.random() - 0.5).join('');
}

/* ----------- 主流程 ----------- */
async function translateParagraphs(texts, engine) {
  const n = texts.length;
  for (let i = 0; i < n; i++) {
    let en = await engines[engine](texts[i]);
    if (!en) { // 当前引擎失败→回落 bing
      en = await engines.bing(texts[i]);
    }
    const gch = await guichu(en);
    results[i] = gch;
    $('#bar').style.width = `${((i + 1) / n * 100).toFixed(0)}%`;
  }
}

let results = [];
$('#go').onclick = async () => {
  await openDB();
  const paras = $('#in').value.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return;
  results = Array(paras.length);
  $('#bar').style.width = '0%';
  await translateParagraphs(paras, $('#engine').value);
  $('#out').value = results.join('\n\n');
  $('#bar').style.width = '100%';
  await sleep(300);
  $('#bar').style.width = '0%';
};
