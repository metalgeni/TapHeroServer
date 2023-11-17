
const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;


// JSON 파싱을 위한 미들웨어
app.use(bodyParser.json());

// SQLite 데이터베이스 설정
const db = new sqlite3.Database('mydatabase.db');

// 데이터베이스 테이블 생성 (랭킹 및 구매 여부)
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS weekly_ranking (username TEXT, score INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS purchased_items (username TEXT, item TEXT)");
});

// 주간 랭킹을 반환하는 엔드포인트
app.get('/weekly-ranking', (req, res) => {
  db.all("SELECT username, score FROM weekly_ranking ORDER BY score DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ message: '서버 에러' });
    } else {
      res.json(rows);
    }
  });
});

// 아이템 구매 여부를 확인하고 업데이트하는 엔드포인트
app.post('/purchase-item', (req, res) => {
  const { username, item } = req.body;

  db.get("SELECT * FROM purchased_items WHERE username = ? AND item = ?", [username, item], (err, row) => {
    if (err) {
      res.status(500).json({ message: '서버 에러' });
    } else if (row) {
      res.status(400).json({ message: '이미 아이템을 구입했습니다.' });
    } else {
      db.run("INSERT INTO purchased_items (username, item) VALUES (?, ?)", [username, item], (err) => {
        if (err) {
          res.status(500).json({ message: '서버 에러' });
        } else {
          res.json({ message: `${username}님이 ${item} 아이템을 구입하셨습니다.` });
        }
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Express.js 서버가 포트 ${port}에서 실행 중입니다.`);
});





