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
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import BackupIcon from "@mui/icons-material/Backup";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { FormAuto } from "./components/FormAuto";
import { TabsHeader } from "./components/TabsHeader";
import { ConnectionForm } from "./components/ConnectionForm";
import { useTheme } from "@mui/material/styles";

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
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: "45.124.84.145",
    sshPort: "26266",
    user: "root",
    password: '"04+Shl6|$#^"1@#qe06',
    // Database Info (Mới)
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(true);



  // Quản lý trạng thái thông báo (Snackbar)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // success, error, warning, info
  });

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
  useEffect(() => {
    if (window.electronAPI?.onUploadProgress) {
      window.electronAPI.onUploadProgress((progress) => {
        setUploadProgress(progress);
      });
    }
  }, []);

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

  const handleBackupSpecificDb = async (log) => {
    setBackingUpId(log.id);
    try {
      const result = await window.electronAPI.createSqlBackup(log);
      if (result.success) {
        setBackupStats(result);
        setShowBackupModal(true);
      } else {
        showMsg(`❌ Lỗi [${log.database}]: ${result.error}`);
      }
    } catch (err) {
      showMsg(`⚠️ Lỗi hệ thống: ${err.message}`);
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
  // const handleUploadFiles = async (filesToUpload, targetEmails) => {
  //   setIsLoading(true);
  //   setIsUploading(true);
  //   setShowUploadPopup(false);

  //   try {
  //     // Duyệt qua từng email để upload
  //     for (const email of targetEmails) {
  //       const driveResult = await window.electronAPI.uploadToDrive({
  //         files: filesToUpload,
  //         targetEmail: email 
  //       });

  //       if (!driveResult.success) {
  //         showMsg(`Lỗi khi tải lên ${email}: ${driveResult.error}`, "error");
  //       }
  //     }
  //     showMsg(`Hoàn tất đẩy file lên ${targetEmails.length} Drive.`, "success");
  //   } catch (err) {
  //     showMsg("Lỗi hệ thống: " + err.message, "error");
  //   } finally {
  //     setIsLoading(false);
  //     setIsUploading(false);
  //   }
  // };

  // App.jsx
  const handleUploadFiles = async (filesToUpload, targetEmails) => {
    setIsLoading(true);
    setIsUploading(true);
    setShowUploadPopup(false);

    let overallSuccess = true;

    try {
      // 1. Chạy vòng lặp upload cho từng Email
      for (const email of targetEmails) {
        const driveResult = await window.electronAPI.uploadToDrive({
          files: filesToUpload,
          targetEmail: email 
        });

        if (!driveResult.success) {
          overallSuccess = false;
          showMsg(`Lỗi upload Drive ${email}: ${driveResult.error}`, "error");
        }
      }

      // 2. CHỈ XÓA FILE SAU KHI TẤT CẢ EMAIL ĐÃ CHẠY XONG
      if (overallSuccess) {
        await window.electronAPI.deleteTempFiles(filesToUpload);
        showMsg(`Hoàn tất đẩy file lên ${targetEmails.length} Drive và đã dọn dẹp file tạm.`, "success");
      } else {
        showMsg("Quá trình hoàn tất nhưng có một số Drive bị lỗi. File tạm chưa được xóa để bạn có thể thử lại.", "warning");
      }

    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
    } finally {
      setIsLoading(false);
      setIsUploading(false);
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
        case "postgres": // <-- Thêm logic xử lý Postgres
          result = await window.electronAPI.db.getPostgres(log);
          console.log(`Postgres ${type} Databases:`, result.databases);
          setDbList(result.databases);
          break;
        case "mssql":
        default:
          // Mặc định là mssql hoặc nếu bạn vẫn muốn dùng hàm cũ thì gọi trực tiếp
          console.log("MSSQL Log Config:", log);
          result = await window.electronAPI.db.getMSSQL(log);
          setDbList(result.databases);
          console.log(`Postgres ${type} Databases:`, result.databases);

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
    for (const dbName of selectedDbs) {
      const currentConfig = { ...selectedLogForBackup, database: dbName };
      await handleBackupSpecificDb(currentConfig);
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
      <UploadPopup
        open={showUploadPopup}
        onClose={() => setShowUploadPopup(false)}
        onUpload={handleUploadFiles}
        showMsg={showMsg}
      />

      {/* MODAL 1: MULTIPLE SELECT */}
      <Modal open={showInputDbModal} onClose={() => setShowInputDbModal(false)}>
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
            sx={{
              mb: 2,
              fontWeight: "bold",
              color: "#1565c0",
              display: "flex",
              alignItems: "center",
            }}
          >
            <BackupIcon sx={{ mr: 1 }} /> Chọn Databases để Backup
          </Typography>
          <Divider sx={{ mb: 3 }} />
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
              <InputLabel>Danh sách Database</InputLabel>
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
              variant="outlined"
              onClick={() => setShowInputDbModal(false)}
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
            p: 4,
          }}
        >
          <Typography
            variant="h6"
            sx={{ mb: 2, color: "#1976d2", fontWeight: 700 }}
          >
            ✅ Hoàn tất sao lưu
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

      {/* CỘT TRÁI */}
      <Paper
        elevation={2}
        sx={{
          width: "100%",
          maxWidth: 500,
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <Box sx={{ flex: 1, overflowY: "auto" }}>
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
                // Truyền thêm list DB để FormAuto hiển thị
                dbList={dbList} 
                isFetching={isFetchingDbs}
              />
            </Box>
          )}
        </Box>

        {/* SỬA: Đưa nút Cloud vào cuối Cột Trái để giao diện cân đối */}
        <Box sx={{ p: 2, borderTop: "1px solid #eee", bgcolor: "#fff" }}>
          <Button
            fullWidth
            onClick={handleOpenUploadPopup}
            variant="contained"
            startIcon={
              isUploading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <CloudIcon />
              )
            }
            disabled={isLoading || isUploading}
            sx={{ py: 1.5, position: "relative", overflow: "hidden" }}
          >
            {isUploading
              ? `Đang tải lên (${uploadProgress}%)`
              : "Đẩy lên Google Drive"}
            {isUploading && (
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{
                  position: "absolute",
                  bottom: 10,
                  left: 0,
                  right: 0,
                  height: 4,
                }}
              />
            )}
          </Button>
        </Box>
      </Paper>

      {/* CỘT PHẢI */}
      <Paper
        elevation={2}
        sx={{
          flex: 1,
          borderRadius: 2,
          p: 2,
          maxHeight: "100vh",
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
                border: "1px solid #e0e4e8",
                p: 2,
                flexDirection: "column",
                alignItems: "stretch",
              }}
            >
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {log.server}
                    </Typography>

                    {/* THÊM DÒNG NÀY: Hiển thị Loại DB và Port */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 0.2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          textTransform: "uppercase",
                          fontWeight: 800,
                          color:
                            log.dbType === "mongodb" ? "#4db33d" : "#00758f", // Màu theo brand
                          fontSize: "0.65rem",
                        }}
                      >
                        {log.dbType || "MSSQL"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#9e9e9e" }}>
                        •
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "#707880", fontWeight: 500 }}
                      >
                        Port: {log.port}
                      </Typography>
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{ color: "#707880", display: "block" }}
                    >
                      {log.time}
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteLog(log.id)}
                  sx={{ color: "#d32f2f", alignSelf: "flex-start" }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1,
                  mt: 1,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleCheckVersion(log)}
                >
                  CHECK
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={backingUpId !== null}
                  onClick={() => handleOpenBackupConfig(log, true)}
                  sx={{ bgcolor: log.success ? "#7b1fa2" : "#b0bec5" }}
                >
                  {backingUpId === log.id ? "..." : "BACKUP"}
                </Button>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>

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
  );
}

export default App;
