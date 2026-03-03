import React, { useState } from "react";
import {
  Box,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
  Modal,
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import BackupIcon from "@mui/icons-material/Backup";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

// Import các components con của bạn
import { TabsHeader } from "./components/TabsHeader";
import { ConnectionForm } from "./components/ConnectionForm";

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: "127.0.0.1",
    database: "master",
    user: "sa",
    password: "MatKhauCuaBan@123",
    port: "1433",
  });
const [isLoading, setIsLoading] = useState(false);

  // State lưu danh sách kết nối
  const [connectionLogs, setConnectionLogs] = useState([]);

  // State theo dõi ID đang thực hiện backup để hiển thị Loading
  const [backingUpId, setBackingUpId] = useState(null);

  const [showBackupModal, setShowBackupModal] = useState(false); // Trạng thái đóng/mở Modal
  const [backupStats, setBackupStats] = useState(null); // Lưu thông tin số bản ghi để hiển thị

  // 1. Hàm Xử lý Kiểm tra kết nối
  const handleTestConnection = async () => {
    const result = await window.electronAPI.testConnection(formData);

    // Copy toàn bộ formData để đảm bảo không bị thiếu user/password trong log
    const newLog = {
      ...formData,
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      success: result.success,
      error: result.error,
    };

    setConnectionLogs((prev) => [newLog, ...prev]);
  };

  // 2. Hàm Xử lý Xóa lịch sử kết nối
  const handleDeleteLog = (id) => {
    setConnectionLogs((prev) => prev.filter((log) => log.id !== id));
  };

  // 3. Hàm Xử lý Backup cho từng dòng cụ thể
  const handleBackupSpecificDb = async (log) => {
    setBackingUpId(log.id);
    try {
      const result = await window.electronAPI.createSqlBackup(log);

      if (result.success) {
        // Thay vì alert, chúng ta lưu dữ liệu vào state và mở Modal
        setBackupStats(result);
        setShowBackupModal(true);
      } else {
        alert(`❌ Lỗi: ${result.error}`);
      }
    } catch (err) {
      alert(`⚠️ Lỗi hệ thống: ${err.message}`);
    } finally {
      setBackingUpId(null);
    }
  };

  // hàm xử lý check thông tin phiên bản SQL Server
  const handleCheckVersion = async (log) => {
    try {
      // Sửa checkSqlVersion thành checkDatabaseInfo để khớp với main.js
      const result = await window.electronAPI.checkDatabaseInfo(log);
      if (result.success) {
        // Hiển thị cả phiên bản và số lượng bảng quét được
        const tableCount = Object.keys(result.counts).length;
        alert(
          `🚀 Phiên bản SQL: ${result.version}\n📊 Quét được: ${tableCount} bảng.`,
        );

        // Nếu bạn muốn hiện Modal danh sách bảng ngay khi bấm CHECK:
        setBackupStats({
          stats: { rowCounts: result.counts },
          fileName: "Thông tin hiện tại",
        });
        setShowBackupModal(true);
      } else {
        alert(`❌ Lỗi: ${result.error}`);
      }
    } catch (err) {
      alert(`⚠️ Lỗi hệ thống: ${err.message}`);
    }
  };

  // 4. Hàm Cloud Upload (Backup + Đẩy lên Drive)
  const handleCloudUpload = async () => {
    setIsLoading(true);
    try {
      const backupResult = await window.electronAPI.createSqlBackup(formData);
      
      if (backupResult.success) {
        console.log("File đã tạo tại:", backupResult.filePath);
        const driveResult = await window.electronAPI.uploadToDrive({
        filePath: backupResult.filePath,
        stats: backupResult.stats || {}, // Truyền thêm stats nếu có, hoặc object rỗng
      });

        if (driveResult.success) {
          alert(
            "Thành công! File đã lên Google Drive. ID: " + driveResult.fileId,
          );
        } else {
          alert("Lỗi khi upload Drive: " + driveResult.error);
        }
      } else {
        alert("Lỗi khi tạo backup: " + backupResult.error);
      }
    } catch (err) {
      alert("Lỗi hệ thống: " + err.message);
    }finally {
    // Kết thúc: Cho dù thành công hay lỗi, nút sẽ được enable trở lại
    setIsLoading(false);
  }
  };

  return (
    <Box
      sx={{
        bgcolor: "#eaeff1",
        minHeight: "100vh",
        p: 3,
        display: "flex",
        gap: 2,
      }}
    >
      {/* MODAL HIỂN THỊ THỐNG KÊ SAU KHI BACKUP */}
      <Modal open={showBackupModal} onClose={() => setShowBackupModal(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 450,
            bgcolor: "background.paper",
            borderRadius: "12px",
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography
            variant="h6"
            component="h2"
            sx={{ mb: 2, color: "#1976d2", fontWeight: 700 }}
          >
            ✅ Backup Thành Công (Local)
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" sx={{ mb: 1 }}>
            <b>File:</b> {backupStats?.fileName}
          </Typography>

          <Typography
            variant="subtitle2"
            sx={{ mt: 2, mb: 1, color: "text.secondary" }}
          >
            📊 Thống kê số lượng bản ghi:
          </Typography>

          {/* PHẦN DANH SÁCH CÓ SCROLL */}
          <Box
            sx={{
              bgcolor: "#f5f5f5",
              p: 2,
              borderRadius: "8px",
              maxHeight: 300,
              overflowY: "auto",
              border: "1px solid #ddd",
            }}
          >
            {backupStats &&
              Object.entries(backupStats.stats.rowCounts).map(
                ([table, count]) => (
                  <Box
                    key={table}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #ddd",
                      py: 0.8,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ textTransform: "capitalize" }}
                    >
                      {table}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: "#2e7d32" }}
                    >
                      {count} dòng
                    </Typography>
                  </Box>
                ),
              )}
          </Box>

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 3, borderRadius: "8px" }}
            onClick={() => setShowBackupModal(false)}
          >
            Đóng thông báo
          </Button>
        </Box>
      </Modal>

      {/* CỘT TRÁI: FORM NHẬP LIỆU */}
      <Paper
        elevation={2}
        sx={{
          width: "100%",
          maxWidth: 600,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <ConnectionForm formData={formData} setFormData={setFormData} />
        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button
            onClick={handleTestConnection}
            variant="outlined"
            sx={{ textTransform: "none" }}
          >
            Kiểm tra kết nối
          </Button>
          <Button
            onClick={handleCloudUpload}
            variant="contained"
            startIcon={<CloudIcon />}
            sx={{ textTransform: "none" }}
            style={{ cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            {isLoading ? 'Đang xử lý...' : 'Đẩy lên Cloud'}
          </Button>
        </Box>
      </Paper>

      {/* CỘT PHẢI: LỊCH SỬ KẾT NỐI */}
      <Paper
        elevation={2}
        sx={{
          flex: 1,
          borderRadius: 2,
          p: 2,
          maxHeight: "131vh",
          overflowY: "auto",
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Lịch sử kết nối
        </Typography>
        <Divider />
        <List sx={{ px: 1 }}>
          {connectionLogs.map((log) => (
            <ListItem
              key={log.id}
              sx={{
                mb: 2,
                borderRadius: "12px",
                bgcolor: "#ffffff",
                border: "1px solid #e0e4e8",
                boxShadow: "0px 2px 4px rgba(0,0,0,0.05)",
                transition: "0.3s",
                "&:hover": {
                  boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
                  borderColor: "#1976d2",
                },
                flexDirection: "column",
                alignItems: "stretch",
                p: 2,
              }}
            >
              {/* Phần thông tin phía trên */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  mb: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      p: 1,
                      borderRadius: "8px",
                      bgcolor: log.success ? "#e8f5e9" : "#ffebee",
                    }}
                  >
                    {log.success ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </Box>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        color: "#1a2027",
                        lineHeight: 1.2,
                      }}
                    >
                      {log.database}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "#707880", display: "block", mt: 0.5 }}
                    >
                      Kết nối lúc: {log.time}
                    </Typography>
                  </Box>
                </Box>

                {/* Nút Xóa nhỏ gọn ở góc */}
                <IconButton
                  size="small"
                  onClick={() => handleDeleteLog(log.id)}
                  disabled={backingUpId === log.id}
                  sx={{ color: "#d32f2f", "&:hover": { bgcolor: "#fff5f5" } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1, borderStyle: "dashed" }} />

              {/* Thông tin Server & Nút Backup phía dưới */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 1,
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#5f666d",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      IP:
                    </Box>{" "}
                    {log.server}
                  </Typography>
                </Box>

                {/* KHỐI NÚT MỚI THÊM VÀO ĐÂY */}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => handleCheckVersion(log)} // Đảm bảo bạn đã thêm hàm handleCheckVersion ở trên
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      fontWeight: 600,
                      px: 2,
                      color: "#1976d2",
                      borderColor: "#1976d2",
                      "&:hover": {
                        bgcolor: "rgba(25, 118, 210, 0.04)",
                        borderColor: "#115293",
                      },
                    }}
                  >
                    CHECK
                  </Button>

                  <Button
                    variant="contained"
                    size="small"
                    disabled={backingUpId !== null}
                    startIcon={
                      backingUpId === log.id ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <BackupIcon />
                      )
                    }
                    onClick={() => handleBackupSpecificDb(log)}
                    sx={{
                      borderRadius: "8px",
                      textTransform: "none",
                      fontWeight: 600,
                      px: 2,
                      bgcolor: log.success ? "#7b1fa2" : "#b0bec5",
                      "&:hover": { bgcolor: "#6a1b9a" },
                    }}
                  >
                    {backingUpId === log.id ? "Backup..." : "BACKUP"}
                  </Button>
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default App;
