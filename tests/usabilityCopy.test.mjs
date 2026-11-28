import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
const templates=readFileSync(new URL('../app/components/MessageTemplates.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
test('첫 안내는 외부 전송과 개인정보 경고만 간결히 표시한다',()=>{
 assert.match(page,/입력한 글은 외부 AI 서비스로 전송됩니다\. 개인정보·민감정보는 입력하지 마세요\./);
 assert.match(page,/결과가 정확하다는 보장은 아닙니다/);
 assert.doesNotMatch(page,/API 이용 비용이 추가로 발생|추가 AI 비용과|서비스로 전송하며 API 이용 비용/);
});
test('검사 취소 비용과 재검색 선택 및 복원 안내를 보존한다',()=>{
 assert.ok((page.match(/이미 발생한 AI 이용 비용은 취소되지 않을 수 있습니다/g)||[]).length>=4);
 assert.match(page,/원문 전체를 다시 검사하지 않으며, 기존 선택은 유지합니다/);
 assert.match(page,/원문 전체를 외부 AI 서비스에 다시 보내고/);
 assert.match(page,/직접 선택한 적용·유지 내용은 초기화됩니다\. 재검사를 취소하거나 실패하면 이전 결과와 선택이 복원됩니다/);
 assert.match(page,/wasRunning[\s\S]*글을 바꿔 이전 결과를 지웠습니다/);
});
test('저장 건수는 제목 옆에 있고 삭제는 항목이 있을 때 제공한다',()=>{
 assert.match(page,/saved-head-title[^\n]*saved-count[^\n]*saved\.length/);
 assert.match(page,/saved\.length > 0 && <button className="btn-clear-all" onClick=\{clearAllSaved\}>전체 삭제/);
 assert.match(page,/저장된 항목을 모두 삭제할까요/);
});
test('팁 출처와 경조사 개인정보·AI·직접 발송 안내를 유지한다',()=>{
 assert.match(css,/\.tips-src \{[^}]*overflow-wrap: anywhere; word-break: keep-all/);
 assert.match(page,/예문 선택·편집·복사는 AI를 호출하지 않습니다/);
 assert.match(page,/자동 검사되지 않으며, 검사 시 외부 AI 서비스로 전송됩니다/);
 assert.match(page,/개인정보·민감정보는 입력하지 마세요/);
 assert.match(templates,/자동 발송되지 않습니다/);
 assert.match(templates,/직접 전송해 주세요/);
});
