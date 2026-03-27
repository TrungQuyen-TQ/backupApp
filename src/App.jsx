import React, { useState, useEffect } from "react"; // SỬA: Thêm useEffect
import UploadPopup from "./components/UploadPopup";
import {
  Box,
  Paper,
  Button,
  List,
  ListItem,
  Typography,
  Divider,
  IconButton,
  CircularProgress,
  Modal,
  TextField,
  Checkbox,
  OutlinedInput,
  InputLabel,
  MenuItem,
  FormControl,
  Select,
  Chip,
  LinearProgress, // SỬA: Thêm LinearProgress
  Snackbar,
  Alert,
  InputAdornment, // <--- THÊM DÒNG NÀY VÀO ĐÂY
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import BackupIcon from "@mui/icons-material/Backup";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { FormAuto } from "./components/FormAuto";
import { TabsHeader } from "./components/TabsHeader";
import { ConnectionForm } from "./components/ConnectionForm";
import { CloudBackup } from "./components/CloudBackup"; // Import component mới
import { useTheme } from "@mui/material/styles";
import { GmailManager } from "./components/GmailManager"; // Đảm bảo đúng đường dẫn file bạn vừa tạo
import { HistoryManager } from "./components/HistoryManager"; // Đảm bảo đúng đường dẫn file bạn vừa tạo
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LoginLayout from "./pages/Login/loginPage";



const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function getStyles(name, selectedNames, theme) {
  return {
    fontWeight: selectedNames.includes(name)
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };
}

function App() {

  // 1. Khai báo thêm useRef ở đầu Component App
const isCancelledRef = React.useRef(false);

  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: "45.124.84.145",
    sshPort: "26266",
    user: "root",
    password: '"04+Shl6|$#^"1@#qe06',
    localPath: "C:\\db_backup",
    dbType: "sqlserver",
    port: "1433",
    dbUser: "sa", // Username riêng cho SQL
    dbPassword: '"04+Shl6|$#^"06', // Password riêng cho SQL
  });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [backingUpId, setBackingUpId] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupStats, setBackupStats] = useState(null);

  const [showInputDbModal, setShowInputDbModal] = useState(false);
  const [selectedLogForBackup, setSelectedLogForBackup] = useState(null);

  const [dbList, setDbList] = useState([]);
  const [selectedDbs, setSelectedDbs] = useState([]);
  const [isFetchingDbs, setIsFetchingDbs] = useState(false);

  const [showUploadPopup, setShowUploadPopup] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Quản lý trạng thái thông báo (Snackbar)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // success, error, warning, info
  });

  // --- Quản lý trạng thái Upload (Chỉ giữ 1 bộ duy nhất) ---
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let unsubUpload;
    let unsubBackup;

    // Lắng nghe tiến trình Upload
    if (window.electronAPI?.onUploadProgress) {
      unsubUpload = window.electronAPI.onUploadProgress((data) => {
        setUploadProgress(data.progress || 0);
        setUploadSpeed(data.speed || "");
      });
    }

    // SỬA: Lắng nghe thêm tiến trình Backup (Cần thêm hàm này vào preload.js)
    if (window.electronAPI?.onBackupProgress) {
      unsubBackup = window.electronAPI.onBackupProgress((data) => {
        setUploadProgress(data.progress || 0); // Dùng chung state progress
        setUploadSpeed(data.message || "Đang xử lý..."); // Hiện trạng thái backup vào ô tốc độ
      });
    }

    return () => {
      if (unsubUpload) unsubUpload();
      if (unsubBackup) unsubBackup();
    };
  }, []);

  // Hàm xử lý khi nhấn nút "Đẩy lên Google Drive" gốc
  const handleOpenDriveSelection = () => {
    setShowUploadPopup(true); // Mở thẳng UploadPopup thay vì showDriveSelectModal
  };

  // Hàm upload thực tế sau khi đã chọn Drive
  const handleFinalUpload = async () => {
    if (!selectedDriveEmail) return showMsg("Vui lòng chọn Drive!", "error");
    setShowDriveSelectModal(false);

    // Gọi popup chọn file của bạn (UploadPopup)
    setShowUploadPopup(true);
  };

  // SỬA: Đảm bảo window.electronAPI tồn tại trước khi đăng ký event

  const showMsg = (msg, type = "success") => {
    setSnackbar({ open: true, message: msg, severity: type });
  };

  /**
   * Logic xử lý đăng nhập
   * Bạn có thể thay đổi logic này để kiểm tra qua electronAPI
   */
  const handleLogin = (username, password) => {
    // Giả lập kiểm tra tài khoản đơn giản cho Desktop App
    if (username === "admin" && password === "123") {
      setIsLoggedIn(true);
      showMsg("Đăng nhập thành công!", "success");
    } else {
      showMsg("Tài khoản hoặc mật khẩu không chính xác", "error");
    }
  };

  /**
   * Hàm đóng Snackbar
   */
  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar({ ...snackbar, open: false });
  };

  const handleTestConnection = async () => {
    // gọi API và chờ kết quả
    const result = await window.electronAPI.testConnection(formData);

    // chỉ ghi log khi có kết quả trả về (thành công hay thất bại)
    const newLog = {
      ...formData,
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      success: result.success,
      error: result.error,
    };

    setConnectionLogs((prev) => [newLog, ...prev]);
    console.log("Test Connection log:", newLog); // Debug kết quả trả về
    if (!result.success) {
      showMsg("Kết nối không thành công: " + result.error, "error");
    }
  };

  const handleDeleteLog = (id) => {
    setConnectionLogs((prev) => prev.filter((log) => log.id !== id));
  };

  // 3. Cập nhật hàm Backup
const handleBackupSpecificDb = async (log) => {
  setBackingUpId(log.id);
  isCancelledRef.current = false; // Reset trạng thái hủy khi bắt đầu mới

  try {
    const result = await window.electronAPI.createSqlBackup(log);

    // KIỂM TRA QUA REF: Ref sẽ luôn giữ giá trị mới nhất ngay cả khi không render lại
    if (isCancelledRef.current) {
      console.log("Tiến trình đã bị người dùng hủy.");
      return; 
    }

    if (result && result.success) {
      setBackupStats(result);
      setShowBackupModal(true);
      await window.electronAPI.saveBackupHistory({
        dbName: result.dbName || log.database,
        fileName: result.fileName,
        stats: result.stats || { rowCounts: {}, version: "N/A" },
        localPath: log.localPath, 
      });
      showMsg(`✅ Backup thành công: ${result.dbName}`, "success");
    } else {
      showMsg(`❌ Lỗi: ${result?.error || 'Không xác định'}`, "error");
    }
  } catch (err) {
    if (!isCancelledRef.current) showMsg("Lỗi: " + err.message, "error");
  } finally {
    setBackingUpId(null);
  }
};

  const handleCheckVersion = async (log) => {
    try {
      const result = await window.electronAPI.checkDatabaseInfo(log);
      if (result.success) {
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

  const handleOpenUploadPopup = () => {
    setShowUploadPopup(true);
  };

  // 6. Xử lý Upload nhiều file sau khi chọn từ Popup

  // App.jsx
  const handleUploadFiles = async (filesToUpload, targetEmails) => {
    setUploadProgress(0);
    setUploadSpeed("Đang khởi tạo...");
    setIsLoading(true);
    setIsUploading(true);
    setShowUploadPopup(false);

    let overallSuccess = true;

    try {
      for (const email of targetEmails) {
        const driveResult = await window.electronAPI.uploadToDrive({
          files: filesToUpload,
          targetEmail: email,
        });

        if (driveResult.success) {
          // LƯU HISTORY: Chỉ lưu 1 lần cho mỗi lượt upload lên 1 Drive
          // Gom tên các file thành 1 chuỗi để dễ nhìn trong History
          const fileNames = filesToUpload.map((f) => f.name).join(", ");
          await window.electronAPI.saveUploadHistory({
            fileName: fileNames, // Lưu danh sách file
            targetEmail: email,
          });
        } else {
          overallSuccess = false;
          showMsg(`Lỗi upload Drive ${email}: ${driveResult.error}`, "error");
        }
      }

      if (overallSuccess) {
        await window.electronAPI.deleteTempFiles(filesToUpload);
        showMsg(
          `Hoàn tất đẩy file lên ${targetEmails.length} Drive.`,
          "success",
        );
      }
    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const handleBrowseFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) {
      setFormData((prev) => ({
        ...prev,
        localPath: path,
      }));
    }
    if (path) {
      const newData = {
        ...formData,
        localPath: path,
      };
      console.log("New data:", newData);

      setFormData(newData);
    }
  };

  const handleOpenBackupConfig = async (log, showModal = true) => {
    setSelectedLogForBackup(log);
    setIsFetchingDbs(true);
    if (showModal) {
      setShowInputDbModal(true);
    }
    setSelectedDbs([]);
    console.log("Log để backup:", log);
    try {
      let result;
      const type = log.dbType?.toLowerCase();
      switch (type) {
        case "mysql":
          result = await window.electronAPI.db.getMySQL(log);
          setDbList(result.databases);
          break;
        case "mongodb":
          result = await window.electronAPI.db.getMongo(log);
          console.log(`MongoDB ${type} Databases:`, result.databases);
          setDbList(result.databases);
          break;
        case "postgresql": // <-- Thêm logic xử lý Postgres
          result = await window.electronAPI.db.getPostgres(log);
          console.log(`Postgres ${type} Databases:`, result.databases);
          setDbList(result.databases);
          break;
        case "sqlserver":
        default:
          // Mặc định là mssql hoặc nếu bạn vẫn muốn dùng hàm cũ thì gọi trực tiếp
          console.log("MSSQL Log Config:", log);
          result = await window.electronAPI.db.getMSSQL(log);
          setDbList(result.databases);

          break;
      }
    } catch (error) {
      alert("Lỗi kết nối server: " + error.message);
    } finally {
      setIsFetchingDbs(false);
    }
  };

  const handleBackupMultipleDbs = async () => {
    if (selectedDbs.length === 0)
      return alert("Vui lòng chọn ít nhất 1 database!");

    setShowInputDbModal(false);

    const limit = 2; // 🔥 số job chạy song song

    for (let i = 0; i < selectedDbs.length; i += limit) {
      const batch = selectedDbs.slice(i, i + limit);

      await Promise.all(
        batch.map((dbName) => {
          const currentConfig = {

            ...selectedLogForBackup,
            database: dbName,
          };

          return handleBackupSpecificDb(currentConfig);
        }),
      );
    }

    setSelectedDbs([]);
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") return; // Tránh đóng khi click ra ngoài nếu muốn
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSelectChange = (event) => {
    const {
      target: { value },
    } = event;
    setSelectedDbs(typeof value === "string" ? value.split(",") : value);
  };


  // Thêm hàm này vào App.jsx
const handleStopCurrentBackup = async (logId) => {
  if (window.confirm("Bạn có chắc muốn dừng backup?")) {
    isCancelledRef.current = true; // Đánh dấu đã hủy vào Ref
    const result = await window.electronAPI.stopBackupProcess(); 
    if (result.success) {
      setBackingUpId(null);
      showMsg("Đã ngắt kết nối!", "warning");
    }
  }
};



  return (
    <Box sx={{ minHeight: "100vh" }}>
      {/* Kiểm tra đăng nhập ở đây */}
      {!isLoggedIn ? (
        <LoginLayout onLogin={handleLogin} />
      ) : (
        <Box
          sx={{
            bgcolor: "#eaeff1",
            minHeight: "100vh",
            p: 3,
            display: "flex",
            gap: 2,
          }}
        >
          {/* MODAL 1: MULTIPLE SELECT */}
          <Modal
            open={showInputDbModal}
            onClose={() => setShowInputDbModal(false)}
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 450,
                bgcolor: "background.paper",
                borderRadius: "12px",
                p: 4,
              }}
            >
              <TextField
                fullWidth
                label="Thư mục lưu trữ (Local Path)"
                variant="outlined"
                size="small"
                value={formData.localPath}
                onChange={(e) =>
                  setFormData({ ...formData, localPath: e.target.value })
                }
                placeholder="Chọn thư mục lưu file backup..."
                sx={{ mt: 2, mb: 1 }}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={handleBrowseFolder}
                      edge="end"
                      color="primary"
                    >
                      <FolderOpenIcon />
                    </IconButton>
                  ),
                }}
                helperText="Bấm vào biểu tượng thư mục để chọn nơi lưu file"
              />

              {isFetchingDbs ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    p: 3,
                  }}
                >
                  <CircularProgress size={40} />
                  <Typography sx={{ mt: 2 }}>Đang quét server...</Typography>
                </Box>
              ) : (
                <FormControl sx={{ width: "100%", mt: 1 }}>
                  <InputLabel>Chọn Database để Backup</InputLabel>
                  <Select
                    multiple
                    value={selectedDbs}
                    onChange={handleSelectChange}
                    input={<OutlinedInput label="Danh sách Database" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip
                            key={value}
                            label={value}
                            size="small"
                            color="primary"
                          />
                        ))}
                      </Box>
                    )}
                    MenuProps={MenuProps}
                  >
                    {dbList.length === 0 ? (
                      <MenuItem disabled>
                        <em>Không có dữ liệu</em>
                      </MenuItem>
                    ) : (
                      dbList.map((name) => (
                        <MenuItem
                          key={name}
                          value={name}
                          style={getStyles(name, selectedDbs, theme)}
                        >
                          {name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              )}
              <Box sx={{ mt: 4, display: "flex", gap: 1 }}>
                <Button
                  fullWidth
                  //variant="outlined"
                  onClick={() => setShowInputDbModal(false)}
                  sx={{
                    bgcolor: "#d32f2f", // Màu đỏ (tương đương color error của MUI)
                    color: "#fff", // Chữ trắng
                    "&:hover": {
                      bgcolor: "#b71c1c", // Màu đỏ đậm hơn khi di chuột vào
                    },
                    px: 3, // Thêm chút padding cho đẹp cân đối với nút bên cạnh
                  }}
                >
                  HỦY
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={selectedDbs.length === 0 || isFetchingDbs}
                  onClick={handleBackupMultipleDbs}
                >
                  BẮT ĐẦU ({selectedDbs.length}) DB
                </Button>
              </Box>
            </Box>
          </Modal>

          {/* MODAL 2: KẾT QUẢ */}
          <Modal
            open={showBackupModal}
            onClose={() => setShowBackupModal(false)}
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 450,
                bgcolor: "background.paper",
                borderRadius: "12px",
                p: 4,
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, color: "#1976d2", fontWeight: 700 }}
              >
                ✅ Hoàn tất BackUp
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2">
                <b>File:</b> {backupStats?.fileName}
              </Typography>
              <Box
                sx={{
                  bgcolor: "#f5f5f5",
                  p: 2,
                  borderRadius: "8px",
                  maxHeight: 200,
                  overflowY: "auto",
                  mt: 2,
                }}
              >
                {/* Hiển thị tên Database ở đây */}
                {backupStats?.dbName && (
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      mb: 1,
                      color: "#1976d2",
                      borderBottom: "2px solid #1976d2",
                    }}
                  >
                    Database: {backupStats.dbName}
                  </Typography>
                )}

                {backupStats &&
                  Object.entries(backupStats.stats.rowCounts).map(
                    ([table, count]) => (
                      <Box
                        key={table}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          borderBottom: "1px solid #ddd",
                          py: 0.5,
                        }}
                      >
                        <Typography variant="caption">{table}</Typography>
                        <Typography
                          variant="caption"
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
                sx={{ mt: 3 }}
                onClick={() => setShowBackupModal(false)}
              >
                Đóng
              </Button>
            </Box>
          </Modal>

          <Box
            sx={{
              bgcolor: "#eaeff1",
              minHeight: "100vh",
              p: 3,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              // Đảm bảo Box ngoài cùng chiếm toàn bộ chiều ngang
              width: "100vw",
              boxSizing: "border-box",
            }}
          >
            {/* --- KHỐI TRÊN: CẤU HÌNH VÀ CHỨC NĂNG --- */}
            <Paper
              elevation={2}
              sx={{
                width: "100%",
                borderRadius: 2,
                overflow: "hidden", // Giữ để bo góc mượt
                display: "flex",
                flexDirection: "column",
                mb: 1, // Khoảng cách nhỏ với khối dưới
              }}
            >
              <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />

              {/* Box nội dung không dùng scroll, cho phép dãn tự nhiên */}
              <Box sx={{ p: 0 }}>
                {activeTab === 0 && (
                  <ConnectionForm
                    formData={formData}
                    setFormData={setFormData}
                    onConnectSuccess={handleTestConnection}
                  />
                )}

                {activeTab === 1 && (
                  <Box sx={{ p: 2 }}>
                    <FormAuto
                      connectionLogs={connectionLogs}
                      setActiveTab={setActiveTab}
                      onFetchDatabases={handleOpenBackupConfig}
                      dbList={dbList}
                      isFetching={isFetchingDbs}
                    />
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <UploadPopup
                      onUpload={handleUploadFiles}
                      showMsg={showMsg}
                      formdata={formData}
                    />
                    <CloudBackup
                      handleOpenUploadPopup={handleOpenUploadPopup}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                      uploadSpeed={uploadSpeed}
                      isLoading={isLoading}
                    />
                  </Box>
                )}

                {/* Trong App.jsx, đoạn Khối Trên */}
                {activeTab === 3 && <GmailManager showMsg={showMsg} />}

                {/* Trong Khối Trên của App.jsx */}
                {activeTab === 4 && <HistoryManager />}
              </Box>
            </Paper>

            {/* --- KHỐI DƯỚI: LỊCH SỬ KẾT NỐI (Chuyển từ cột phải sang) --- */}
            {/* --- KHỐI DƯỚI: LỊCH SỬ KẾT NỐI --- */}
            <Paper
              elevation={2}
              sx={{
                // flex: 1, // SỬA: Xóa flex: 1 để khối này không chiếm toàn bộ màn hình, giúp cố định chiều cao
                borderRadius: 2,
                p: 2,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minHeight: "200px", // <--- THÊM DÒNG NÀY để tạo khung cố định lúc mới vào
                bgcolor: "#fff",
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 1, fontWeight: "bold", px: 1 }}
              >
                Lịch sử kết nối & Trạng thái Backup
              </Typography>
              <Divider />

              <List
  sx={{
    px: 1, mt: 1, maxHeight: "580px", overflowY: "auto",
    display: "grid", gridTemplateColumns: "1fr", gap: 2.5,
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-thumb": { backgroundColor: "#d1d9e0", borderRadius: "10px" },
    "&::-webkit-scrollbar-track": { backgroundColor: "transparent" }
  }}
>
  {connectionLogs.map((log) => (
    <ListItem
      key={log.id}
      sx={{
        borderRadius: "16px", border: "1px solid #f0f2f5", p: 0,
        display: "flex", flexDirection: "column", alignItems: "stretch",
        bgcolor: "#fff", width: "100%", boxSizing: "border-box",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
        overflow: "hidden",
        opacity: log.success ? 1 : 0.8,
        "&:hover": {
          borderColor: log.success ? "#1976d2" : "#d32f2f",
          transform: "translateY(-4px)",
          boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
          "& .delete-btn": { opacity: 1 }
        }
      }}
    >
      {/* PHẦN 1: HEADER */}
      <Box sx={{ p: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Box
            sx={{
              width: 48, height: 48, borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: log.success ? "#e8f5e9" : "#fff1f0",
              color: log.success ? "#2e7d32" : "#d32f2f",
            }}
          >
            {log.success ? <CheckCircleIcon /> : <ErrorIcon />}
          </Box>

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: log.success ? "#1a2027" : "#d32f2f" }}>
              {log.server} {!log.success && "(Kết nối lỗi)"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Chip
                label={log.dbType || "MSSQL"}
                size="small"
                sx={{
                  height: 20, fontSize: "0.65rem", fontWeight: 900,
                  bgcolor: log.success ? (log.dbType === "mongodb" ? "#e6f4ea" : "#e3f2fd") : "#f5f5f5",
                  color: log.success ? (log.dbType === "mongodb" ? "#1e8e3e" : "#1976d2") : "#9e9e9e",
                }}
              />
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>{log.time}</Typography>
            </Box>
          </Box>
        </Box>

        <IconButton
          className="delete-btn"
          size="small"
          onClick={() => handleDeleteLog(log.id)}
          sx={{ color: "#d32f2f", opacity: 0, transition: "0.3s", bgcolor: "#fff1f0" }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* PHẦN 2: THANH ĐIỀU KHIỂN */}
      <Box
        sx={{
          display: "flex", justifyContent: "flex-end", gap: 1.5, p: 1.5,
          bgcolor: "#fcfcfd", borderTop: "1px solid #f0f2f5"
        }}
      >
        {/* NÚT HỦY: Chỉ xuất hiện khi đang trong quá trình Backup */}
        {backingUpId === log.id && (
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => handleStopCurrentBackup(log.id)}
            sx={{ 
              borderRadius: "8px", 
              px: 2, 
              fontWeight: 700, 
              textTransform: "none",
              borderWidth: "1.5px",
              "&:hover": { borderWidth: "1.5px" }
            }}
          >
            Hủy Backup
          </Button>
        )}

        <Button
          variant="contained"
          size="small"
          // Disable nếu: Kết nối lỗi HOẶC đang có một tiến trình backup khác đang chạy
          disabled={!log.success || (backingUpId !== null && backingUpId !== log.id)}
          onClick={() => handleOpenBackupConfig(log, true)}
          sx={{
            borderRadius: "10px", px: 3, textTransform: "none", fontWeight: 800,
            fontSize: "0.8rem", minWidth: "160px", boxShadow: "none",
            backgroundImage: backingUpId === log.id
              ? "linear-gradient(45deg, #f44336 30%, #ba000d 90%)" 
              : (log.success ? "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)" : "linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)"),
            transition: "all 0.4s ease",
            position: "relative", overflow: "hidden",
            "&:hover": { filter: "brightness(1.1)" }
          }}
        >
          <Box sx={{ zIndex: 2, display: "flex", alignItems: "center", gap: 1 }}>
            {backingUpId === log.id ? (
              <>
                <CircularProgress size={16} color="inherit" thickness={6} />
                <Typography variant="caption" sx={{ fontWeight: "900" }}>{uploadProgress}%</Typography>
              </>
            ) : ("BackUp")}
          </Box>

          {backingUpId === log.id && (
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "100%",
                bgcolor: "transparent", opacity: 0.2,
                "& .MuiLinearProgress-bar": { backgroundColor: "#fff" }
              }}
            />
          )}
        </Button>
      </Box>
    </ListItem>
  ))}
</List>
            </Paper>
          </Box>

          {/* SNACKBAR THÔNG BÁO */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={4000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity={snackbar.severity}
              sx={{ width: "100%" }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </Box>
  );
}

export default App;
