# MLN133 • Quiz Dân tộc & Tôn giáo (WebSocket)

Game hỏi đáp **đấu giá quyền trả lời** cho Chương 6 MLN133 – *Vấn đề dân tộc và tôn giáo trong thời kỳ quá độ lên CNXH*.

- 1 **Admin** điều khiển phòng, nhiều **người chơi** tham gia bằng mã phòng (ví dụ `ABC123`) từ điện thoại / laptop.
- Toàn bộ realtime chạy qua **một Node.js WebSocket server** (thư viện `ws`). Không dùng Supabase, Firebase hay polling.
- **Server là trọng tài duy nhất**: điểm, đấu giá, đồng hồ, người thắng, đáp án đúng và jackpot đều do server quyết định. Trình duyệt chỉ gửi thao tác và hiển thị trạng thái server gửi về.

```
Admin (laptop) ──┐
Player (phone) ──┼──► Node.js server (HTTP + WebSocket) ──► Rooms / Game state (RAM)
Player (phone) ──┘
```

## Cấu trúc

```
game_mln133/
├── index.html            # Giao diện (Admin + Player), kết nối WebSocket
├── server/
│   ├── server.js         # HTTP + WebSocket, xác thực, định tuyến lệnh, heartbeat
│   ├── game-manager.js   # Luật chơi: đấu giá, timer, chấm điểm, jackpot, dữ liệu gửi cho từng client
│   ├── room-manager.js   # Lưu phòng / người chơi / phiên Admin (RAM – có thể thay bằng DB sau)
│   └── questions.js      # 40 câu hỏi (Phần I–IV + Tôn giáo) – CHỈ nằm trên server
├── scripts/smoke-test.js # Test end-to-end: 1 Admin + nhiều Player qua WebSocket thật
├── package.json
└── .gitignore
```

## 1. Cài Node.js

Cài **Node.js 18 trở lên** (khuyên dùng bản LTS) từ <https://nodejs.org>. Kiểm tra:

```bash
node -v
npm -v
```

## 2. Cài thư viện

```bash
cd game_mln133
npm install
```

## 3. Chạy server

```bash
npm start
```

Server in ra:

```
[SERVER] WebSocket started on ws://localhost:3000 (HTTP: http://localhost:3000)
```

## 4. Mở game

Mở trình duyệt: <http://localhost:3000>

Góc trên bên phải hiển thị trạng thái kết nối: 🟢 **Đã kết nối** / 🟡 **Đang kết nối lại...** / 🔴 **Mất kết nối**.

## 5–6. Admin đăng nhập và tạo phòng

1. Bấm **Vào Admin**, nhập mật khẩu (mặc định `congminh`, đổi bằng biến môi trường `ADMIN_PASSWORD`).
2. Mật khẩu được gửi lên server để kiểm tra; `index.html` **không** chứa mật khẩu. Server cấp một *admin token* và tự tạo phòng mới với mã 6 ký tự (3 chữ + 3 số, ví dụ `SPN438`).
3. Bấm **🔗 Copy link** để lấy link dạng `http://<server>/?room=SPN438` gửi cho người chơi.
4. Nếu Admin reload trang, trình duyệt tự dùng token đã lưu để vào lại **đúng phòng cũ** (nếu server chưa khởi động lại).

Luồng một câu hỏi (các nút chỉ bật khi đúng bước, server cũng kiểm tra lại):

```
▶ Bắt đầu game → 🔨 Mở đấu giá (30s) → 🏆 Chốt người thắng (hoặc server tự chốt khi hết giờ)
→ 📖 Mở câu hỏi (30s) → người thắng gửi đáp án → ✅ Chấm đáp án (hoặc server tự chấm khi hết giờ)
→ ➡ Câu tiếp
```

- Đúng: người thắng **+ số điểm cược**. Sai / hết giờ: **− số điểm cược** và số điểm đó vào **Jackpot**.
- Sau mỗi 10 câu (câu 10, 20, 30, 40): nếu Jackpot > 0 phải bấm **🎰 Quay Jackpot** trước khi sang câu tiếp. Server chọn ngẫu nhiên một người chơi đang online.
- Nếu người thắng trả lời **miệng**: Admin bấm chọn đáp án trên màn hình Admin rồi bấm **✅ Chấm đáp án**.
- Nếu không ai cược, khi hết giờ đấu giá Admin có thể mở lại đấu giá hoặc sang câu tiếp.

## 7. Người chơi tham gia

1. Mở link Admin gửi (hoặc vào trang chủ → **Tham gia chơi**).
2. Nhập **tên** và **mã phòng** → **🎮 Tham gia**. Mỗi người chơi được server cấp một `playerId` (UUID) riêng, nên trùng tên vẫn là hai người khác nhau.
3. Admin thấy người chơi xuất hiện ngay trong mục **👥 Người chơi** (🟢 online / 🔴 mất kết nối).
4. Mất mạng hoặc reload: trình duyệt tự kết nối lại và khôi phục đúng người chơi, đúng điểm. Người chơi mất kết nối được giữ trong phòng 30 phút.
5. Bấm **Thoát**: server xoá người chơi khỏi phòng, Admin thấy ngay.

## 8. Test nhiều thiết bị

Tất cả thiết bị phải truy cập **cùng một địa chỉ server**:

| Cách | Khi nào dùng | Địa chỉ người chơi mở |
| --- | --- | --- |
| **Cùng Wi-Fi / LAN** | Test nhanh trong lớp | `http://<IP-máy-chạy-server>:3000` (xem IP bằng `ipconfig` / `ifconfig`) |
| **Tunnel tạm thời** (không cần cùng Wi-Fi) | Demo từ laptop, mạng trường chặn LAN | chạy `npx cloudflared tunnel --url http://localhost:3000` → mở link `https://xxxx.trycloudflare.com` |
| **Deploy online** (mục 10) | Dùng lâu dài, không cần laptop bật | `https://your-app.onrender.com` |

Với tunnel hoặc deploy HTTPS, trang tự dùng `wss://`, không cần cấu hình gì thêm.

> Nếu Windows Firewall hỏi quyền cho Node.js, chọn **Allow** để máy khác trong LAN truy cập được.

## 9. Test nhiều người chơi trên nhiều tab (1 máy)

- Người chơi được lưu **theo từng tab** (`sessionStorage`), nên mỗi tab là một người chơi riêng.
- Tab 1: `http://localhost:3000` → Admin → tạo phòng, ví dụ `ABC123`.
- Tab 2, 3, 4…: mở `http://localhost:3000/?room=ABC123` → nhập tên khác nhau → Tham gia.
  (Tham số `?room=` giúp tab mới vào màn hình tham gia thay vì tự vào lại Admin.)
- Muốn đồng hồ ngắn cho dễ test:

```bash
# macOS / Linux
AUCTION_SECONDS=8 ANSWER_SECONDS=12 npm start
# Windows PowerShell
$env:AUCTION_SECONDS="8"; $env:ANSWER_SECONDS="12"; npm start
```

- Test tự động toàn bộ luồng (1 Admin + nhiều Player, 2 phòng độc lập, câu 1 → 12, jackpot, reconnect, Admin reload…):

```bash
npm test
```

## 10. Deploy server

Server phục vụ luôn `index.html`, nên **chỉ cần deploy một dịch vụ Node.js**. Hosting phải hỗ trợ WebSocket; Render, Railway, Fly.io và VPS đều hỗ trợ.

**Render.com (miễn phí):**

1. Đẩy code lên GitHub.
2. Render → **New → Web Service** → chọn repo.
3. Build command: `npm install` • Start command: `npm start`.
4. Environment: `ADMIN_PASSWORD=<mật-khẩu-mạnh>` (không đặt `PORT`; Render tự cấp).
5. Mở `https://<tên-app>.onrender.com`.

> Gói miễn phí của Render "ngủ" sau một thời gian không dùng; hãy mở trang khoảng 1 phút trước giờ chơi. Room lưu trong RAM nên mất khi server khởi động lại hoặc deploy lại.

**VPS (Ubuntu) + Nginx:** chạy bằng `pm2 start server/server.js --name mln133`, rồi cấu hình Nginx chuyển tiếp cả HTTP và WebSocket:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
}
```

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP + WebSocket |
| `HOST` | `0.0.0.0` | Địa chỉ lắng nghe |
| `ADMIN_PASSWORD` | `congminh` | Mật khẩu Admin (**đổi khi deploy**) |
| `AUCTION_SECONDS` | `30` | Thời gian đấu giá |
| `ANSWER_SECONDS` | `30` | Thời gian trả lời |
| `MAX_PLAYERS_PER_ROOM` | `100` | Giới hạn người chơi mỗi phòng |
| `QUIET` | – | `1` để tắt log chi tiết |

## 11. Cấu hình WebSocket URL

- **Mặc định (khuyên dùng):** mở trang từ chính server. Client tự suy ra địa chỉ: `http://host` dùng `ws://host`, `https://host` dùng `wss://host`. Không cần sửa gì, không bị Mixed Content.
- **Frontend deploy tách riêng** (ví dụ `index.html` trên GitHub Pages, server trên Render): sửa dòng này trong `index.html`:

```html
<script>
  window.MLN133_CONFIG = { WS_URL: "wss://your-server.onrender.com" };
</script>
```

## 12. HTTPS / WSS khi chạy thật

- Trang chạy `https://` thì **bắt buộc** dùng `wss://`. Trình duyệt chặn `ws://` từ trang HTTPS (Mixed Content). Để `WS_URL` trống thì client tự chọn đúng.
- Render / Railway / Fly.io / Cloudflare Tunnel đã có sẵn HTTPS + WSS.
- VPS: dùng Nginx ở trên + chứng chỉ miễn phí `sudo certbot --nginx -d your-domain.com`.

## WebSocket protocol

Mọi tin nhắn là JSON có trường `type`. Client chỉ thao tác trong phòng mà kết nối đó đã được server gắn vào; `roomCode`/`playerId` gửi kèm chỉ để đối chiếu (sai lệch sẽ trả về `ROOM_MISMATCH`/`FORBIDDEN`).

**Client → Server**

| type | payload | quyền |
| --- | --- | --- |
| `admin_login` | `password` | ai cũng gửi được → `admin_session { adminToken }` |
| `create_room` | `adminToken` | cần token → `room_created { roomCode }` |
| `admin_resume` | `adminToken, roomCode` | token của phòng đó → `admin_resumed` |
| `admin_start_game`, `admin_open_auction`, `admin_finalize_auction`, `admin_open_question`, `admin_submit_answer { answer? }`, `admin_next_question`, `admin_spin_jackpot`, `admin_end_game`, `admin_reset_room`, `admin_get_questions`, `admin_leave` | – | Admin của phòng |
| `join_room` | `roomCode, name` | → `joined { playerId, playerToken }` |
| `reconnect` | `roomCode, playerId, playerToken, takeover` | → `joined { reconnected: true }` |
| `player_bid` | `bid` | người chơi trong phòng → `ack` |
| `player_answer` | `answer` | chỉ người thắng → `ack` |
| `player_leave` | – | → `left` |
| `ping` | – | → `pong` |

**Server → Client**

- `room_state { state }`: ảnh chụp trạng thái **riêng cho từng người nhận**, gửi sau mọi thay đổi. Người chơi không bao giờ nhận `correct`, mức cược hay đáp án của người khác; chỉ người thắng thấy nội dung câu hỏi khi câu hỏi đang mở.
- Sự kiện: `hello`, `players_updated`, `game_started`, `auction_started`, `auction_updated` (chỉ Admin), `auction_finished`, `question_opened`, `answer_submitted` (chỉ Admin), `answer_result`, `score_updated`, `jackpot_updated`, `jackpot_result`, `question_changed`, `round_cancelled`, `game_ended`, `room_reset`, `questions_list` (chỉ Admin), `ack`, `left`.
- Lỗi: `{ "type": "error", "code": "AUCTION_CLOSED", "message": "Phiên đấu giá đã kết thúc.", "command": "player_bid" }`.
  Các mã lỗi gồm: `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_ENDED`, `ROOM_MISMATCH`, `INVALID_NAME`, `PLAYER_NOT_JOINED`, `PLAYER_NOT_FOUND`, `PLAYER_IN_USE`, `FORBIDDEN`, `WRONG_PASSWORD`, `TOO_MANY_ATTEMPTS`, `ADMIN_NOT_AUTHENTICATED`, `ADMIN_SESSION_EXPIRED`, `GAME_NOT_STARTED`, `AUCTION_NOT_OPEN`, `AUCTION_CLOSED`, `ALREADY_BID`, `INVALID_BID`, `INSUFFICIENT_SCORE`, `NO_BIDS`, `ANSWER_NOT_OPEN`, `NOT_WINNER`, `ALREADY_ANSWERED`, `INVALID_ANSWER`, `ROUND_NOT_FINISHED`, `JACKPOT_PENDING`, `JACKPOT_ALREADY_AWARDED`, `INVALID_JSON`, `UNKNOWN_COMMAND`, `RATE_LIMITED`.

## Log khi demo

```
[ROOM] Created SPN438
[PLAYER] Minh joined SPN438
[AUCTION] SPN438 started (câu 1)
[BID] SPN438 Minh -> 30
[BID] SPN438 Nam -> 50
[AUCTION] SPN438 winner Nam 50 (hết giờ)
[QUESTION] SPN438 Question 1 opened for Nam
[ANSWER] SPN438 Nam answered B
[SCORE] SPN438 Nam +50
[QUESTION] SPN438 Question 1 finished
```

## Sửa / thêm câu hỏi

Sửa `server/questions.js` (`correct` là chỉ số đáp án đúng, bắt đầu từ 0), rồi khởi động lại server. Câu hỏi và đáp án không bao giờ được gửi xuống trình duyệt người chơi.

## Giới hạn hiện tại

- Trạng thái phòng lưu trong RAM: server khởi động lại thì mất phòng. Mọi truy cập dữ liệu đi qua `RoomManager`, nên có thể thêm SQLite / PostgreSQL / Redis sau mà không phải sửa luật chơi.
- Chạy một tiến trình server duy nhất. Muốn chạy nhiều instance cần chuyển trạng thái sang Redis và dùng pub/sub.
