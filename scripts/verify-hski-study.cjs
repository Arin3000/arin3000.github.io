const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const asset = path.join(root, 'source/assets/hski-study');
const data = JSON.parse(fs.readFileSync(path.join(asset, 'study.json'), 'utf8'));
assert.equal(data.steps.length, 10);
for (const [name, file] of Object.entries(data.files)) {
  const bytes = fs.readFileSync(path.join(asset, 'code', name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256, name);
  assert.equal(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), file.code.replace(/\r\n/g, '\n'), name);
}
for (const step of data.steps) {
  assert.ok(fs.statSync(path.join(asset, String(step.id).padStart(2, '0') + '.png')).size > 10000);
  for (const snippet of step.snippets) {
    const lines = data.files[snippet.file].code.split(/\r?\n/);
    assert.ok(snippet.start > 0 && snippet.end >= snippet.start && snippet.end <= lines.length);
    assert.ok(snippet.note && snippet.label);
  }
}
const eye = data.steps[5].snippets[0];
const eyeCode = data.files[eye.file].code.split(/\r?\n/).slice(eye.start-1,eye.end).join('\n');
assert.match(eyeCode, /if \(IsEyeHightLight\)/);
assert.match(eyeCode, /_StudyStage < 6/);
assert.ok(!eyeCode.includes('DirectBRDFSpecular'));
assert.equal(data.validation.teaching_complete_vs_original.different_pixels, 0);
assert.equal(data.validation.step05_to_06.button_roi_changed_pixels, 0);
const article = fs.readFileSync(path.join(root,'public/2026/09/10/hski-shader-painting/index.html'),'utf8');
assert.ok(article.includes('study.js') && article.includes('id="explain"'));
assert.ok(!/[EC]:[\\/]/.test(JSON.stringify(data)));
assert.ok(fs.readFileSync(path.join(root,'public/index.html'),'utf8').includes('/2026/09/10/hski-shader-painting/'));
console.log('PASS: 10 steps, source hashes, code ranges, eye separation, image evidence, article and homepage entry.');
