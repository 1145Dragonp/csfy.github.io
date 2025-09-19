const $ = q => document.querySelector;

// 1. 本地随机符号池（数学+ASCII+emoji 混合）
const pool = '∀∂∞∑≠≤≥±°·@#$%&*+-/\\|~<>0123456789🐶💧⚡🌪️🌀😱💥✨';

// 2. 本地引擎：分词 → 每词随机抽一个符号 → 打乱
function localSymbol(w) {
  return pool[Math.floor(Math.random() * pool.length)];
}
function guichu(text) {
  const words = text.split(/\s+/);
  const out = words.map(w => localSymbol(w));
  return out.join('').split('').sort(() => Math.random() - 0.5).join('');
}

// 3. 主流程（local 必走）
$('#go').onclick = () => {
  const paras = $('#in').value.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return;
  const results = paras.map(p => guichu(p));
  $('#out').value = results.join('\n\n');
};
