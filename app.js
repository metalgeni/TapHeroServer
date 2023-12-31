
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const port = 3000;


// JSON 파싱을 위한 미들웨어
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// SQLite 데이터베이스 설정
const db = new sqlite3.Database('mydatabase.db');

// 사용자와 접속 상태를 추적하기 위한 객체
const activeSessions = {};


db.serialize(() => {  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )
    `);
  db.run("CREATE TABLE IF NOT EXISTS weekly_ranking (username TEXT, score INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS purchased_items (username TEXT, item TEXT)");  
  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT
    )
  `);


  // 사용자 일일 출석 정보 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        UNIQUE(user_id, date),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // 아이템 및 인벤토리 테이블 생성
  db.run(`
      CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL
      )
  `);
  
  db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          equipped BOOLEAN NOT NULL DEFAULT 0,
          FOREIGN KEY(user_id) REFERENCES users(id),
          FOREIGN KEY(item_id) REFERENCES items(id)
      )
  `);

  
});


// 루트 경로
app.get('/', (req, res) => {
  res.send('Game Server is running!');
});


// 회원가입
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
      if (err) {
          console.error(err.message);
          res.status(500).json({ error: 'Internal Server Error' });
      } else {
          res.json({ success: true, message: 'User registered successfully' });
      }
  });
});

// 로그인
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // 사용자 인증 로직 (예: 데이터베이스에서 확인)
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
      if (err) {
          console.error(err.message);
          res.status(500).json({ error: 'Internal Server Error' });
      } else if (user) {
          // 이미 로그인한 경우, 기존 세션 종료
          if (activeSessions[username]) {
              activeSessions[username].destroy();
          }

          // 현재 세션을 활성 세션에 등록
          req.session.userId = user.id;
          activeSessions[username] = req.session;

          res.json({ success: true, message: 'Login successful' });
      } else {
          res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
  });
});

// 로그아웃
app.post('/logout', (req, res) => {
  const { userId } = req.session;

  // 로그아웃 시, 활성 세션에서 제거
  if (userId && activeSessions[userId]) {
      activeSessions[userId] = null;
  }

  req.session.destroy(() => {
      res.json({ success: true, message: 'Logout successful' });
  });
});

// 토너먼트 목록 조회
app.get('/tournaments', (req, res) => {
  db.all('SELECT * FROM tournaments', (err, tournaments) => {
      if (err) {
          console.error(err.message);
          res.status(500).json({ error: 'Internal Server Error' });
      } else {
          res.json({ tournaments });
      }
  });
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

// 상품 구매
app.post('/purchase', (req, res) => {
  const { userId, item_name, price } = req.body;
  const purchase_date = new Date().toISOString();

  db.run(
      'INSERT INTO purchases (user_id, item_name, price, purchase_date) VALUES (?, ?, ?, ?)',
      [userId, item_name, price, purchase_date],
      function (err) {
          if (err) {
              console.error(err.message);
              res.status(500).json({ error: 'Internal Server Error' });
          } else {
              res.json({ success: true, message: 'Purchase successful', purchaseId: this.lastID });
          }
      }
  );
});

// 사용자 정보 조회
app.get('/user/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (user) {
            res.json({ user });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

// 사용자 정보 갱신 (스테이지 및 소지한 골드)
app.post('/user/:userId/update', (req, res) => {
    const userId = req.params.userId;
    const { currentStage, gold } = req.body;

    db.run(
        'UPDATE users SET current_stage = ?, gold = ? WHERE id = ?',
        [currentStage, gold, userId],
        function (err) {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: 'Internal Server Error' });
            } else {
                res.json({ success: true, message: 'User information updated successfully' });
            }
        }
    );
});

// Unity 클라이언트에서 호출할 함수
app.get('/user/:userId/info', (req, res) => {
    const userId = req.params.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (user) {
            res.json({
                currentStage: user.current_stage,
                gold: user.gold
            });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});


// 클라이언트에서 호출할 함수: 일일 출석 체크 및 출석 보상 확인
/*
app.post('/user/:userId/checkAttendance', (req, res) => {
    const userId = req.params.userId;
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환

    // 오늘의 날짜로 이미 출석한 기록이 있는지 확인
    db.get('SELECT * FROM daily_attendance WHERE user_id = ? AND date = ?', [userId, currentDate], (err, attendance) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (attendance) {
            // 이미 출석한 경우
            res.json({ success: true, alreadyAttended: true, message: 'Already attended today' });
        } else {
            // 출석하지 않은 경우, 출석 기록 저장
            db.run(
                'INSERT INTO daily_attendance (user_id, date) VALUES (?, ?)',
                [userId, currentDate],
                function (err) {
                    if (err) {
                        console.error(err.message);
                        res.status(500).json({ error: 'Internal Server Error' });
                    } else {
                        // 출석 보상 계산 및 응답 전송
                        const reward = calculateDailyReward();
                        res.json({ success: true, alreadyAttended: false, reward, message: 'Attendance recorded' });
                    }
                }
            );
        }
    });
});
*/

// 클라이언트에서 호출할 함수: 일일 출석 체크 및 출석 보상 확인
app.post('/user/:userId/checkAttendance', (req, res) => {
    const userId = req.params.userId;
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식으로 변환

    // 오늘의 날짜로 이미 출석한 기록이 있는지 확인
    db.get('SELECT * FROM daily_attendance WHERE user_id = ? AND date = ?', [userId, currentDate], (err, attendance) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else if (attendance) {
            // 이미 출석한 경우
            res.json({ success: true, alreadyAttended: true, message: 'Already attended today' });
        } else {
            // 출석하지 않은 경우, 출석 기록 저장
            db.run(
                'INSERT INTO daily_attendance (user_id, date) VALUES (?, ?)',
                [userId, currentDate],
                function (err) {
                    if (err) {
                        console.error(err.message);
                        res.status(500).json({ error: 'Internal Server Error' });
                    } else {
                        // 7일 연속 출석 여부 확인
                        checkConsecutiveAttendance(userId, currentDate, res);
                    }
                }
            );
        }
    });
});

// 7일 연속 출석 여부 확인 함수
function checkConsecutiveAttendance(userId, currentDate, res) {
    // 최근 7일간의 출석 여부를 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    db.all('SELECT * FROM daily_attendance WHERE user_id = ? AND date >= ? ORDER BY date DESC', [userId, sevenDaysAgo.toISOString().split('T')[0]], (err, attendanceRecords) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            if (attendanceRecords.length === 7) {
                // 최근 7일간 출석한 경우, 출석 보상 계산
                const reward = calculateDailyReward();
                res.json({ success: true, alreadyAttended: false, reward, message: 'Attendance recorded' });
            } else {
                res.json({ success: true, alreadyAttended: false, message: 'Attendance recorded' });
            }
        }
    });
}


// 출석 보상 계산 함수
function calculateDailyReward() {
    // 일일 출석 보상 로직 ( 7일 연속 출석 시 더 좋은 보상 )
    // 플레이 상황에 따라 다르게 재구현
    return Math.floor(Math.random() * 100) + 50; // 랜덤한 골드 보상 (50에서 150까지)
}

// 클라이언트에서 호출할 함수: 재시작 요청
app.post('/user/:userId/requestRestart', (req, res) => {
    const userId = req.params.userId;

    // 일일 출석 정보 초기화 (하루라도 빠지면 재시작)
    db.run('DELETE FROM daily_attendance WHERE user_id = ?', [userId], (err) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ success: true, message: 'Restart requested successfully' });
        }
    });
});



// 클라이언트에서 호출할 함수: 아이템 목록 조회
app.get('/items', (req, res) => {
    db.all('SELECT * FROM items', (err, items) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ items });
        }
    });
});

// 클라이언트에서 호출할 함수: 사용자의 인벤토리 조회
app.get('/user/:userId/inventory', (req, res) => {
    const userId = req.params.userId;

    db.all('SELECT inventory.id, items.name, items.type, inventory.equipped FROM inventory JOIN items ON inventory.item_id = items.id WHERE user_id = ?', [userId], (err, inventory) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ inventory });
        }
    });
});

// 클라이언트에서 호출할 함수: 아이템 장착
app.post('/user/:userId/equipItem/:itemId', (req, res) => {
    const userId = req.params.userId;
    const itemId = req.params.itemId;

    // 아이템 장착 상태 업데이트
    db.run('UPDATE inventory SET equipped = NOT equipped WHERE user_id = ? AND item_id = ?', [userId, itemId], function (err) {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.json({ success: true, message: 'Item equipped/unequipped successfully' });
        }
    });
});

//   client ... get 
//   private string serverUrl = "http://localhost:3000"; // Express 서버 주소
//   $"{serverUrl}/user/{userId}/info"
//   
//   UserInfoRes response = JsonUtility.FromJson<UserInfoRes>(www.downloadHandler.text);
//   
//   [System.Serializable]
//   public class UserInfoRes
//   {
//       public int currentStage;
//       public int gold;
//   }

app.listen(port, () => {
  console.log(`Hero Server가 포트 ${port}에서 실행 중입니다.`);
});



