// STUB. Task 7 replaces this with the real scenes. Contract: renderScene(stageEl, scene) -> { at(t) }.
export function renderScene(stageEl, scene) {
  const pre = document.createElement('pre');
  pre.style.cssText = 'margin:0;padding:48px;font:24px/1.4 monospace;color:#0b0f2e;white-space:pre-wrap';
  pre.textContent = `${scene.id}\n${JSON.stringify(scene.props, null, 2)}`;
  stageEl.append(pre);
  return { at() {} };
}
