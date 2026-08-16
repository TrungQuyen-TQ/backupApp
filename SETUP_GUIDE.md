# 🚀 BỘ TÀI LIỆU HƯỚNG DẪN SETUP & SỬ DỤNG BACKUP TOOL PRO EDITION

Tài liệu này hướng dẫn đầy đủ từ **Tổng quan ứng dụng**, **Setup mã nguồn khi mới Pull về máy Client**, **Cấu hình phân quyền bảo mật trên Máy chủ (Server)** cho đến **Quy trình vận hành chi tiết**.

---

## 📋 MỤC LỤC TỔNG QUAN

- [I. Tổng quan ứng dụng](#i-tổng-quan-ứng-dụng)
  - [1. Backup Tool Pro là gì? Tại sao nên sử dụng?](#1-backup-tool-pro-là-gì-tại-sao-nên-sử-dụng)
  - [2. Giới thiệu công cụ & Kiến trúc hệ thống](#2-giới-thiệu-công-cụ--kiến-trúc-hệ-thống)
- [II. Ứng dụng dùng để làm gì (Tính năng cốt lõi)](#ii-ứng-dụng-dùng-để-làm-gì-tính-năng-cốt-lõi)
- [III. Yêu cầu hệ thống & Thiết bị](#iii-yêu-cầu-hệ-thống--thiết-bị)
- [IV. Khởi chạy Ứng dụng Desktop trên Máy Client (Client Setup)](#iv-khởi-chạy-ứng-dụng-desktop-trên-máy-client-client-setup)
  - [1. Yêu cầu môi trường Client](#1-yêu-cầu-môi-trường-client)
  - [2. Pull mã nguồn & Cài đặt thư viện](#2-pull-mã-nguồn--cài-đặt-thư-viện)
  - [3. Cấu hình tệp tin hệ thống (configs/)](#3-cấu-hình-tệp-tin-hệ-thống-configs)
  - [4. Chạy và Đóng gói Ứng dụng](#4-chạy-và-đóng-gói-ứng-dụng)
- [V. Cấu hình Chuẩn Bảo mật trên Server CSDL (Server Side Setup)](#v-cấu-hình-chuẩn-bảo-mật-trên-server-csdl-server-side-setup)
  - [1. Cấu hình User SSH Linux chuyên dụng](#1-cấu-hình-user-ssh-linux-chuyên-dụng)
  - [2. Cài đặt các công cụ Dump/Backup cần thiết trên Linux Server](#2-cài-đặt-các-công-cụ-dumpbackup-cần-thiết-trên-linux-server)
  - [3. Siết chặt bảo mật SSH Server (Hardening)](#3-siết-chặt-bảo-mật-ssh-server-hardening)
  - [4. Tạo User CSDL với Quyền tối thiểu (Least Privilege)](#4-tạo-user-csdl-với-quyền-tối-thiểu-least-privilege)
- [VI. Hướng dẫn Sử dụng Chi tiết Ứng dụng (User Guide)](#vi-hướng-dẫn-sử-dụng-chi-tiết-ứng-dụng-user-guide)
  - [1. Quản lý Server Kết nối (Quản lý Server)](#1-quản-lý-server-kết-nối-quản-lý-server)
  - [2. Quy trình Sao lưu Thủ công ("Chủ động")](#2-quy-trình-sao-lưu-thủ-công-chủ-động)
  - [3. Quy trình Sao lưu Tự động & Đồng bộ Cloud ("Tự động")](#3-quy-trình-sao-lưu-tự-động--đồng-bộ-cloud-tự-động)
  - [4. Quản lý Gmail & Upload File Cloud](#4-quản-lý-gmail--upload-file-cloud)
  - [5. Tra cứu Lịch sử (History)](#5-tra-cứu-lịch-sử-history)
- [VII. Xử lý Sự cố Thường gặp (Troubleshooting)](#vii-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

# I. Tổng quan ứng dụng

### 1. Backup Tool Pro là gì? Tại sao nên sử dụng?
**Backup Tool Pro Edition** là ứng dụng desktop quản lý sao lưu (backup) và đồng bộ dữ liệu đa nền tảng. Ứng dụng hỗ trợ tự động hóa toàn bộ chu trình từ kết nối server cơ sở dữ liệu, trích xuất dữ liệu, nén mã hóa an toàn cho đến việc đẩy bản sao lưu lên lưu trữ đám mây Google Drive.

**Tại sao nên sử dụng Backup Tool Pro?**
- **Đa nền tảng CSDL**: Quản lý tập trung nhiều hệ quản trị CSDL phổ biến (SQL Server / MSSQL, MySQL, PostgreSQL, MongoDB).
- **Sao lưu an toàn & Linh hoạt**: Hỗ trợ cả sao lưu thủ công tức thì ("Chủ động") lẫn sao lưu tự động theo lịch định kỳ ("Tự động").
- **Tích hợp Cloud tự động**: Đồng bộ dữ liệu sao lưu trực tiếp lên Google Drive của từng tài khoản Gmail được ủy quyền.
- **Tiết kiệm dung lượng & Nén dữ liệu**: Tự động đóng gói và mã hóa file backup dưới dạng tệp `.7z`.
- **Minh bạch & Dễ kiểm tra**: Thống kê số lượng bản ghi (rows), phiên bản CSDL và ghi nhận chi tiết nhật ký thao tác (History).

---

### 2. Giới thiệu công cụ & Kiến trúc hệ thống
Ứng dụng được xây dựng trên nền tảng **Electron + React (Material-UI) + Node.js**, điều hướng trực quan qua thanh Sidebar 6 chức năng chính:
- 🔵 **Chủ động**: Quản lý dòng kết nối, quét database và thực hiện backup ngay lập tức.
- 🟢 **Tự động**: Thiết lập lịch trình chạy tự động (Cron job) theo phút, giờ hoặc ngày.
- 🖥️ **Quản lý Server**: Lưu trữ danh sách IP/Host và thông tin kết nối các máy chủ remote.
- ☁️ **Đẩy lên Cloud**: Tải trực tiếp các file backup từ máy tính lên Google Drive.
- 📧 **Quản lý Gmail**: Quản lý danh sách tài khoản Google Drive đã xác thực OAuth2.
- 📜 **History**: Xem lại nhật ký chi tiết các phiên Backup và Upload Cloud.

---

# II. Ứng dụng dùng để làm gì

Ứng dụng phục vụ các mục đích quản trị và vận hành hệ thống chính:
1. **Lưu trữ tập trung thông tin kết nối máy chủ CSDL** (IP, SSH Port, DB Port, Username/Password).
2. **Quét tự động danh sách Database** đang hoạt động trên máy chủ remote mà không cần truy cập thủ công vào SQL Management Studio hay phpMyAdmin.
3. **Thực hiện Backup một hoặc nhiều Database cùng lúc** về thư mục cục bộ (Local Path).
4. **Tự động hóa lịch backup định kỳ** (Ví dụ: 02:00 AM hàng ngày hoặc mỗi 6 tiếng) và tự động dọn dẹp/đẩy bản sao lưu mới nhất lên Google Drive.
5. **Ủy quyền an toàn nhiều tài khoản Google Drive** và cho phép chọn tài khoản nhận file tương ứng với từng chu trình sao lưu.
6. **Kiểm tra thông số bản backup**: Thống kê số dòng (row counts) từng bảng dữ liệu nhằm đảm bảo file backup đầy đủ dữ liệu.

---

# III. Yêu cầu hệ thống & Thiết bị

### 1. Máy tính Cài đặt Ứng dụng (Client App)
- **Hệ điều hành**: Windows 10/11 (64-bit), macOS, hoặc Linux.
- **Node.js**: Phiên bản `>= 18.x` (Khuyên dùng LTS v20.x).
- **RAM**: Tối thiểu 4 GB (Khuyến nghị 8 GB).
- **Dung lượng ổ đĩa**: Trống tối thiểu 1 GB + dung lượng chứa file backup cục bộ.
- **Kết nối mạng**: Có kết nối Internet/LAN ổn định tới các Server CSDL và Google API.

### 2. Máy chủ Cơ sở dữ liệu (Database Server)
- Hỗ trợ các hệ quản trị CSDL:
  - **Microsoft SQL Server** (Port mặc định: 1433)
  - **MySQL / MariaDB** (Port mặc định: 3306)
  - **PostgreSQL** (Port mặc định: 5432)
  - **MongoDB** (Port mặc định: 27017)
- Cho phép kết nối SSH (Port 22/26266...) nếu kết nối thông qua SSH Tunnel.

---

# IV. Khởi chạy Ứng dụng Desktop trên Máy Client (Client Setup)

### 1. Yêu cầu môi trường Client
- **Node.js**: phiên bản `>= 18.x`.
- **Git**: Đã cài đặt trên máy.

### 2. Pull mã nguồn & Cài đặt thư viện
Mở Terminal / PowerShell và thực hiện các lệnh sau:

```bash
# 1. Clone hoặc Pull dự án về máy
git clone <URL_REPOSITORY_CUẢ_BẠN>
cd backupApp

# 2. Cài đặt toàn bộ phụ thuộc (Dependencies)
npm install
```

### 3. Cấu hình tệp tin hệ thống (`configs/`)
Trước khi chạy app, kiểm tra và chuẩn bị các tệp trong thư mục `configs/`:

1. **Cấu hình Google Drive OAuth (`configs/client_secret.json`)**:
   - Tải tệp JSON OAuth 2.0 Credentials từ Google Cloud Console.
   - Đổi tên tệp thành `client_secret.json` và lưu vào thư mục `configs/client_secret.json`.

2. **Cấu hình Mật khẩu Nén Zip (`configs/passwordzip.json`)**:
   - Tạo tệp `configs/passwordzip.json` (nếu chưa có) để tùy chỉnh mật khẩu mã hóa tệp `.7z`:
   ```json
   {
     "password": "MatKhauMaHoaZip123!"
   }
   ```

### 4. Chạy và Đóng gói Ứng dụng

```bash
# Chạy ở chế độ Phát triển (Dev Mode)
npm run dev
# hoặc
npm start

# Đóng gói ứng dụng thành file cài đặt (.exe / Package)
npm run make
```

---

# V. Cấu hình Chuẩn Bảo mật trên Server CSDL (Server Side Setup)

Để ứng dụng kết nối và thực hiện backup an toàn mà **không cần dùng tài khoản `root` Linux hay `sa` / `root` CSDL**, hãy thiết lập các tài khoản riêng biệt như sau:

---

### 1. Cấu hình User SSH Linux chuyên dụng

Vào Terminal của máy chủ Linux và chạy các lệnh:

```bash
# 1. Tạo user SSH chuyên dụng tên 'backupuser' (không cấp quyền sudo)
sudo adduser backupuser

# 2. Cài đặt công cụ 7-Zip (Bắt buộc để Server thực hiện nén & mã hóa file)
# Đối với Ubuntu / Debian:
sudo apt-get update && sudo apt-get install p7zip-full -y

# Đối với CentOS / RHEL:
sudo yum install p7zip p7zip-plugins -y
```

> **Lưu ý**: `backupuser` là user thường, mặc định có quyền tạo và xóa file tạm trong thư mục `/tmp/`. Ứng dụng sẽ sử dụng `/tmp/` làm nơi chứa file sao lưu trung gian trước khi tải về client qua SFTP.

---

### 2. Cài đặt các công cụ Dump/Backup cần thiết trên Linux Server

Đảm bảo các công cụ CLI của CSDL đã được cài đặt trên máy chủ Linux để ứng dụng có thể gọi lệnh:
- **MySQL**: Cần lệnh `mysqldump`
- **PostgreSQL**: Cần lệnh `pg_dump`
- **MongoDB**: Cần lệnh `mongodump` (thuộc gói `mongodb-database-tools`)
- **SQL Server (MSSQL)**: Cần lệnh `/opt/mssql-tools18/bin/sqlcmd` hoặc `sqlcmd`

---

### 3. Siết chặt bảo mật SSH Server (Hardening)

Để đảm bảo `backupuser` chỉ dùng để phục vụ backup, không thể lợi dụng làm SSH Proxy hay chiếm quyền:

1. Mở file cấu hình SSH trên Server:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
2. Thêm đoạn cấu hình sau vào **cuối file**:
   ```etc
   Match User backupuser
       AllowTcpForwarding no
       X11Forwarding no
       AllowAgentForwarding no
   ```
3. Khởi động lại dịch vụ SSH:
   ```bash
   sudo systemctl restart ssh
   ```

---

### 4. Tạo User CSDL với Quyền tối thiểu (Least Privilege)

Tùy theo hệ quản trị CSDL trên Server, chạy lệnh SQL tương ứng để tạo tài khoản sao lưu dành riêng cho ứng dụng:

#### 🟢 A. PostgreSQL
```sql
-- 1. Tạo user với mật khẩu an toàn
CREATE USER backup_db_user WITH PASSWORD 'MatKhauSieuCap123!';

-- 2. Cấp quyền kết nối đến Database cần backup
GRANT CONNECT ON DATABASE my_database TO backup_db_user;

-- 3. Chuyển sang Database đó (\c my_database) và cấp quyền đọc bảng
GRANT USAGE ON SCHEMA public TO backup_db_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_db_user;

-- 4. Cấp quyền đọc thống kê số lượng bản ghi
GRANT SELECT ON pg_stat_user_tables TO backup_db_user;
```

#### 🟡 B. MySQL / MariaDB
```sql
-- 1. Tạo user kết nối (từ localhost hoặc IP chỉ định)
CREATE USER 'backup_db_user'@'localhost' IDENTIFIED BY 'MatKhauSieuCap123!';

-- 2. Cấp quyền đọc, khóa bảng và trích xuất schema cho mysqldump
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, PROCESS ON *.* TO 'backup_db_user'@'localhost';

-- 3. Cập nhật quyền
FLUSH PRIVILEGES;
```

#### 🍃 C. MongoDB
```javascript
// Đăng nhập mongosh vào db 'admin'
use admin

db.createUser({
  user: "backup_db_user",
  pwd: "MatKhauSieuCap123!",
  roles: [
    { role: "backup", db: "admin" },
    { role: "clusterMonitor", db: "admin" },
    { role: "readAnyDatabase", db: "admin" }
  ]
})
```

#### 🔴 D. Microsoft SQL Server (MSSQL)
```sql
-- 1. Tạo Login ở cấp Server
USE [master];
GO
CREATE LOGIN [backup_db_user] WITH PASSWORD = N'MatKhauSieuCap123!', CHECK_POLICY = ON;
GRANT VIEW ANY DATABASE TO [backup_db_user];
GO

-- 2. Tạo User & Cấp quyền trên Database cần backup (VD: [my_database])
USE [my_database];
GO
CREATE USER [backup_db_user] FOR LOGIN [backup_db_user];

-- Cấp quyền thực thi BACKUP DATABASE
ALTER ROLE [db_backupoperator] ADD MEMBER [backup_db_user];

-- Cấp quyền đọc dữ liệu để đếm thống kê số lượng bản ghi (COUNT)
ALTER ROLE [db_datareader] ADD MEMBER [backup_db_user];
GO
```

---

# VI. Hướng dẫn Sử dụng Chi tiết Ứng dụng (User Guide)

---

### 1. Quản lý Server Kết nối (`Quản lý Server`)
1. Mở giao diện ứng dụng, truy cập mục **Quản lý Server** trên Sidebar.
2. Danh sách các máy chủ IP đã lưu sẽ xuất hiện.
3. Nhấp nút **Kết nối** để khởi chạy quá trình kiểm tra các cổng CSDL đang hoạt động trên Server đó.

---

### 2. Quy trình Sao lưu Thủ công ("Chủ động")
1. Chọn tab **Chủ động**.
2. Nhập/Kiểm tra thông tin kết nối:
   - **Server / IP**: IP máy chủ (VD: `45.124.84.145`).
   - **SSH Port**: Port SSH (Mặc định `22` hoặc port riêng như `26266`).
   - **SSH User/Pass**: Điền `backupuser` và Mật khẩu SSH đã tạo ở Phần V.
   - **Loại CSDL**: Chọn `SQL Server`, `MySQL`, `PostgreSQL` hoặc `MongoDB`.
   - **DB User/Pass**: Điền `backup_db_user` và Mật khẩu CSDL.
   - **Thư mục lưu (Local Path)**: Chọn nơi lưu trữ file `.7z` trên máy client.
3. Nhấn **Thử kết nối** để quét danh sách Database.
4. Chọn danh sách Database cần sao lưu và nhấn **BẮT ĐẦU BACKUP**.
5. Theo dõi tiến trình trực tiếp và kiểm tra popup thống kê số dòng/phiên bản sau khi hoàn tất.

---

### 3. Quy trình Sao lưu Tự động & Đồng bộ Cloud ("Tự động")
1. Chọn tab **Tự động**.
2. **Chọn Server & Database**: Tích chọn danh sách Database cần lên lịch chạy ngầm.
3. **Chọn Drive lưu trữ**: Tích chọn các tài khoản Gmail nhận file tự động.
4. **Cấu hình Chu kỳ (Schedule)**:
   - Đặt khoảng thời gian lặp lại (Mỗi X phút, giờ hoặc ngày).
   - Đặt mốc thời gian chạy cố định (VD: `02:00` hàng ngày).
5. Nhấn **Lưu & Kích hoạt**. Chu trình sẽ tự động sao lưu, nén mã hóa và đẩy lên Google Drive theo lịch.

---

### 4. Quản lý Gmail & Upload File Cloud (`Quản lý Gmail` & `Đẩy lên Cloud`)
- **Ủy quyền Google Drive**: Chọn tab **Quản lý Gmail** -> Nhấn **Thêm tài khoản Google Drive** để liên kết tài khoản qua OAuth2.
- **Đẩy file thủ công**: Chọn tab **Đẩy lên Cloud** -> Chọn file `.7z` từ máy client -> Chọn Drive đích -> Nhấn **Bắt đầu Upload**.

---

### 5. Tra cứu Lịch sử (`History`)
- Xem lại toàn bộ nhật ký phiên backup (Tên DB, thời gian, tên file, số lượng bản ghi) tại tab **History**.
- Xem nhật ký các phiên upload Cloud thành công/thất bại.

---

# VII. Xử lý Sự cố Thường gặp (Troubleshooting)

| Lỗi | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Lỗi 7za: command not found** | Server Linux chưa cài gói `7-Zip` | Chạy `sudo apt-get install p7zip-full -y` trên Server Linux. |
| **Lỗi mysqldump / pg_dump not found** | Máy chủ Linux thiếu công cụ Dump CSDL | Cài đặt `mysql-client` hoặc `postgresql-client` hoặc `mongodb-database-tools` trên Server. |
| **Permission Denied khi nén file trong /tmp** | User SSH không có quyền ghi vào `/tmp` | Kiểm tra lại phân quyền thư mục `/tmp` trên Linux (`sudo chmod 1777 /tmp`). |
| **Cannot connect Google Drive / Client Secret Missing** | Thiếu file OAuth JSON | Kiểm tra file `configs/client_secret.json` đã được đặt đúng vị trí chưa. |
| **Access denied for user 'backup_db_user'** | Sai mật khẩu hoặc chưa cấp đủ quyền CSDL | Kiểm tra lại lệnh `GRANT` trên CSDL ở Phần V.4. |
| **Time Out khi nén Database lớn** | Mạng chập chờn hoặc DB quá lớn | Ứng dụng đã được cấu hình timeout lớn & keepalive. Hãy kiểm tra băng thông mạng SSH. |

---
*Tài liệu được cập nhật tự động dành cho hệ thống Backup Tool Pro Edition.*
