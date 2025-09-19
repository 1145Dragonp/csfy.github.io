/******************************** 工具函数 ********************************/
const $ = q => document.querySelector(q);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/******************************** 符号缓存 ********************************/
const dbName = 'guichu_sym';
let db;
async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onerror = e => reject(e);
    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onupgradeneeded = e => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains('sym')) _db.createObjectStore('sym');
    };
  });
}
async function getSymDB(word) {
  return new Promise(res => {
    const tx = db.transaction('sym', 'readonly');
    const store = tx.objectStore('sym');
    const req = store.get(word);
    req.onsuccess = () => res(req.result);
  });
}
async function setSymDB(word, sym) {
  const tx = db.transaction('sym', 'readwrite');
  tx.objectStore('sym').put(sym, word);
}

/******************************** 三引擎实现 ********************************/
const engines = {
  async gemini(text) {
    const key = 'AIzaSyD4ZSGN7qIT3oea1pKjV4pYFpJqO8p5ZIQ'; // 演示 key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
    const body = {contents: [{parts: [{text: `Translate into English only:\n${text}`}]}]};
    const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
  },
  async bing(text) {
    // 极简逆向：拿 cookie 即翻，额度大
    const res = await fetch('https://www.bing.com/ttranslatev3?isVertical=1&&IG=AD0E49D9F2E4...', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({fromLang: 'zh-Hans', text, to: 'en'})
    });
    const j = await res.json();
    return j?.[0]?.translations?.[0]?.text || text;
  },
  async local(text) {
    // 本地 27 MB NLLB 兜底（未放模型时回落原文）
    if (!window.nllb) return text;
    return await window.nllb.translate(text);
  }
};

/******************************** 鬼畜后处理 ********************************/
async function guichu(en) {
  const words = en.split(/\s+/);
  const out = [];
  for (const w of words) {
    const low = w.toLowerCase();
    let sym = await getSymDB(low);
    if (!sym) {
      // 请求 Gemini 要符号（同 key 复用）
      const prompt = `You are a one-char-replacer.Reply ONLY 1 character (math/ASCII preferred,emoji last) for "${low}".No explanation.`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyD4ZSGN7qIT3oea1pKjV4pYFpJqO8p5ZIQ`;
      const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({contents: [{parts: [{text: prompt}]}]})});
      const j = await r.json();
      sym = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.[0] || low[0];
      await setSymDB(low, sym);
    }
    out.push(sym);
  }
  // 打乱节奏
  return out.join('').split('').sort(() => Math.random() - 0.5).join('');
}

/******************************** 主流程 ********************************/
async function translateParagraphs(texts, engine) {
  const n = texts.length;
  for (let i = 0; i < n; i++) {
    const en = await engines[engine](texts[i]);
    const gch = await guichu(en);
    results[i] = gch;
    $('#bar').style.width = `${((i + 1) / n * 100).toFixed(0)}%`;
  }
}

let results = [];
$('#go').onclick = async () => {
  await openDB();
  const paras = $('#in').value.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  results = Array(paras.length);
  $('#bar').style.width = '0%';
  await translateParagraphs(paras, $('#engine').value);
  $('#out').value = results.join('\n\n');
  $('#bar').style.width = '100%';
  await sleep(300);
  $('#bar').style.width = '0%';
};
