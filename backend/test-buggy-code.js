/**
 * テスト用のバグを含むコードファイル
 * Phase 2自動バグ検知・修正システムのテスト用
 */

// メモリリークバグ
const intervalId = setInterval(() => {
  console.log('Memory leak potential');
}, 1000);
// clearInterval not called - MEMORY LEAK

// XSS脆弱性バグ
function updateContent(userInput) {
  document.getElementById('content').innerHTML = userInput; // XSS VULNERABILITY
}

// SQL インジェクションバグ
function getUserData(userId) {
  const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL INJECTION
  return database.query(query);
}

// 非同期エラーハンドリング不足
async function fetchData() {
  const response = await fetch('/api/data'); // UNHANDLED ASYNC ERROR
  return response.json();
}

// リソースリークバグ
function readFile() {
  const stream = fs.createReadStream('data.txt'); // RESOURCE LEAK
  return stream;
}

// 型エラー可能性
function processArray(data) {
  return data.length > 0 ? data[0] : null; // TYPE ERROR POTENTIAL
}

module.exports = {
  updateContent,
  getUserData,
  fetchData,
  readFile,
  processArray
};