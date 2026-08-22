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
  Container,
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
import { ServerManager } from "./components/ServerManager";
import LoginLayout from "./pages/Login/loginPage";
import ConfirmStopModal from "./components/ConfirmStopModal"; // Đảm bảo đúng đường dẫn
import Sidebar from "./components/Sidebar"; // Import Sidebar mới
import { ZipPasswordModal } from "./components/ZipPasswordModal";



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

  // Đặt ngay dòng đầu tiên của function
  console.log(">>> [App] Đang khởi tạo Component...");
  // 1. Khai báo thêm useRef ở đầu Component App
  const isCancelledRef = React.useRef(false);

  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  // 1. Thêm State để lưu dữ liệu server được chọn từ ServerManager
  const [selectedServer, setSelectedServer] = useState(null);

  console.log(">>> [App] State selectedServer hiện tại:", selectedServer);

  const [formData, setFormData] = useState({
    server: "",
    sshPort: "22",
    user: "",
    password: "",
    localPath: "C:\\db_backup",
    dbType: "sqlserver",
    port: "1433",
    dbUser: "",
    dbPassword: "",
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

  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Quản lý trạng thái thông báo (Snackbar)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // success, error, warning, info
  });

  // --- Quản lý trạng thái Upload (Chỉ giữ 1 bộ duy nhất) ---
  const [uploadProgress, setUploadProgress] = useState(0);
  const [driveProgress, setDriveProgress] = useState(0);   // THÊM: Dùng riêng cho Google Drive


  const [uploadSpeed, setUploadSpeed] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Thêm các state bị thiếu
  const [selectedDriveEmail, setSelectedDriveEmail] = useState("");
  const [showDriveSelectModal, setShowDriveSelectModal] = useState(false);

  const [showConfirmStopModal, setShowConfirmStopModal] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);

  const handleStopCurrentBackup = () => {
    setShowConfirmStopModal(true); // Chỉ mở Modal
  };


  const handleConfirmStop = async () => {
    setShowConfirmStopModal(false);
    isCancelledRef.current = true; //

    // Gọi xuống Backend để đóng kết nối thực tế
    const result = await window.electronAPI.stopBackupProcess();

    if (result.success) {
      setBackingUpId(null);
      setUploadProgress(0);
      showMsg("Đã dừng tiến trình và ngắt kết nối!", "warning");
    }
  };


  // App.jsx






  useEffect(() => {
    let unsubUpload;
    let unsubBackup;

    // 1. Sửa phần Upload: Cập nhật vào driveProgress
    if (window.electronAPI?.onUploadProgress) {
      unsubUpload = window.electronAPI.onUploadProgress((data) => {
        setDriveProgress(data.progress || 0); // Đổi từ setUploadProgress sang setDriveProgress
        setUploadSpeed(data.speed || "");
      });
    }

    // 2. Phần Backup: Giữ nguyên cập nhật vào uploadProgress
    if (window.electronAPI?.onBackupProgress) {
      unsubBackup = window.electronAPI.onBackupProgress((data) => {
        setUploadProgress(data.progress || 0);
        setUploadSpeed(data.message || "Đang xử lý...");
      });
    }

    return () => {
      if (unsubUpload) unsubUpload();
      if (unsubBackup) unsubBackup();
    };
  }, []);
  const onScanAndConnect = async (serverConfig) => {
    setIsLoading(true);
    try {
      // 1. Lấy danh sách cấu hình từ info.json
      const configRes = await window.electronAPI.getLoginConfigs();
      if (!configRes.success) return showMsg("Không thể đọc danh sách cấu hình", "error");

      // 2. Lọc ra các loại DB (MySQL, MSSQL...) của IP này
      const relatedConfigs = configRes.serverConfigs.filter(
        (cfg) => cfg.server === serverConfig.server
      );

      showMsg(`🔍 Đang kiểm tra kết nối tới các loại DB trên server ${serverConfig.server}...`, "info");

      let validConnections = [];

      // 3. Vòng lặp kiểm tra kết nối (Chỉ check xem Server đó có sống không)
      for (const config of relatedConfigs) {
        // Gọi hàm test-connection chung của hệ thống thay vì quét từng DB
        const result = await window.electronAPI.testConnection(config);

        if (result.success) {
          // Nếu kết nối được, tạo 1 bản ghi đại diện cho loại DB đó
          validConnections.push({
            ...config,
            id: Date.now() + Math.random(),
            database: "Dòng kết nối chính", // Không liệt kê database con nữa
            time: new Date().toLocaleTimeString(),
            success: true,
          });
        } else {
          console.warn(`Kết nối lỗi cho ${config.dbType}:`, result.error);
        }
      }

      // 4. Đẩy kết quả ra bảng lịch sử
      if (validConnections.length > 0) {
        setConnectionLogs((prev) => [...validConnections, ...prev]);
        showMsg(`✅ Đã thiết lập xong ${validConnections.length} cổng kết nối!`, "success");
      } else {
        showMsg("Không có cổng kết nối nào hoạt động.", "error");
      }

    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };



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
   * Hàm xử lý khi đăng nhập thành công từ ConnectionForm
   */
  const handleLoginSuccess = () => {
    // Có thể thêm logic bổ sung ở đây nếu cần
    console.log(">>> [App] Đăng nhập cơ sở dữ liệu thành công!");
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
    setBackingUpId(log.id); // Giữ ID này để UI sáng đèn
    setUploadProgress(0);

    // 1. CẬP NHẬT TÊN DATABASE VÀO STATE LOG ĐỂ HIỂN THỊ
    setConnectionLogs((prev) =>
      prev.map((item) =>
        item.id === log.id ? { ...item, database: log.database } : item
      )
    );

    // 2. Thiết lập thông báo chuẩn bị
    setUploadSpeed(`Đang chuẩn bị: ${log.database}...`);
    isCancelledRef.current = false;

    try {
      // 3. Gọi API xuống Electron để thực hiện backup
      const result = await window.electronAPI.createSqlBackup(log);

      // 4. Nếu người dùng đã nhấn nút Hủy trong lúc chờ, thoát ngay
      if (isCancelledRef.current) return { success: false, cancelled: true };

      // 5. KIỂM TRA CHẶT CHẼ: Phải thành công VÀ phải có dữ liệu thống kê (stats)
      if (result && result.success) {
        // Lưu dữ liệu vào State để hiển thị Modal
        setBackupStats(result);
        setShowBackupModal(true);

        // Lưu lịch sử backup vào Database (Dùng stats mặc định nếu result.stats bị rỗng)
        await window.electronAPI.saveBackupHistory({
          dbName: result.dbName || log.database,
          fileName: result.fileName,
          stats: result.stats || { rowCounts: {}, version: "N/A" },
          localPath: log.localPath,
        });

        // Hiện thông báo xanh rực rỡ
        showMsg(`✅ Backup thành công: ${result.dbName || log.database}`, "success");

        // Trả kết quả về cho hàm cha (handleBackupMultipleDbs) để tăng successCount
        return result;
      }
      else {
        // Trường hợp lỗi ngầm (file rỗng) hoặc lỗi từ Backend
        const errorDetail = result?.error || "Dữ liệu backup bị rỗng hoặc không lấy được thông tin bảng.";
        showMsg(`❌ Lỗi Backup [${log.database}]: ${errorDetail}`, "error");
        setBackupStats(null);

        // Trả về false để hàm cha không đếm bản này là thành công
        return { success: false, error: errorDetail };
      }

    } catch (err) {
      // Bắt các lỗi crash hệ thống
      if (!isCancelledRef.current) {
        showMsg(`⚠️ Lỗi hệ thống: ` + err.message, "error");
      }
      return { success: false, error: err.message };
    } finally {
      // Đưa thanh progress về 0
      setUploadProgress(0);
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
        showMsg(`❌ Lỗi: ${result.error}`, "error");
      }
    } catch (err) {
      showMsg(`⚠️ Lỗi hệ thống: ${err.message}`, "error");
    }
  };

  const handleOpenUploadPopup = () => {
    setShowUploadPopup(true);
  };

  // 6. Xử lý Upload nhiều file sau khi chọn từ Popup
  // App.jsx
  const handleUploadFiles = async (filesToUpload, targetEmails, folderName) => {
    setDriveProgress(0); // Đảm bảo reset từ đầu
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
          folderName: folderName || "SQL_Backups",
        });

        if (driveResult.success) {
          const fileNames = filesToUpload.map((f) => f.name).join(", ");
          await window.electronAPI.saveUploadHistory({
            fileName: fileNames,
            targetEmail: email,
            folderName: folderName || "SQL_Backups", // Lưu tên folder động
          });

          // Sau khi xong 1 email, có thể set lên 100% tạm thời
          setDriveProgress(100);
          setUploadSpeed("Hoàn tất");
        } else {
          overallSuccess = false;
          showMsg(`Lỗi upload Drive ${email}: ${driveResult.error}`, "error");
        }
      }

      if (overallSuccess) {
        await window.electronAPI.deleteTempFiles(filesToUpload);
        //return { success: true };
        showMsg(
          `Hoàn tất đẩy file lên ${targetEmails.length} Drive.`,
          "success",
        );
      }
    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
      setDriveProgress(0); // SỬA: Reset driveProgress thay vì uploadProgress
    } finally {
      // Đợi 2 giây để người dùng thấy thanh Progress chạy đến 100% rồi mới reset
      setTimeout(() => {
        setIsLoading(false);
        setIsUploading(false);

        // --- ĐOẠN QUAN TRỌNG NHẤT CẦN SỬA ---
        setDriveProgress(0);   // SỬA: Đưa thanh tiến trình CLOUD về 0
        setUploadProgress(0);  // Reset cả thanh backup cho chắc chắn
        // ------------------------------------

        setUploadSpeed("Hệ thống sẵn sàng");
      }, 2000);
    }
  };

  const handleBrowseFolder = async () => {
    const path = await window.electronAPI.selectFolder();
    if (path) {
      setFormData((prev) => ({
        ...prev,
        localPath: path, // Chỉ cập nhật đường dẫn, giữ nguyên server/user/pass
      }));
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
      showMsg("Lỗi kết nối server: " + error.message, "error");
    } finally {
      setIsFetchingDbs(false);
    }
  };

  const handleBackupMultipleDbs = async () => {
    if (selectedDbs.length === 0) return showMsg("Vui lòng chọn ít nhất 1 database!", "warning");
    setShowInputDbModal(false);

    // --- THÊM BIẾN ĐẾM THÀNH CÔNG ---
    let successCount = 0;
    let totalSelected = selectedDbs.length;

    for (const dbName of selectedDbs) {
      const currentConfig = {
        ...selectedLogForBackup,
        database: dbName,
        id: selectedLogForBackup.id
      };

      // --- BƯỚC QUAN TRỌNG: Cập nhật tên DB vào danh sách log để hiển thị lên UI ---
      setConnectionLogs((prev) =>
        prev.map((item) =>
          item.id === selectedLogForBackup.id ? { ...item, database: dbName } : item
        )
      );

      setUploadSpeed(`Đang chuẩn bị: ${dbName}...`);

      // Đợi kết quả từ hàm backup con
      const result = await handleBackupSpecificDb(currentConfig);

      if (!isCancelledRef.current && result && result.success) {
        successCount++;
      }

      if (isCancelledRef.current) break;
      setUploadProgress(0);
    }

    // --- LOGIC HIỆN THÔNG BÁO CUỐI CÙNG ---
    if (isCancelledRef.current) {
      showMsg("Đã dừng tiến trình backup theo yêu cầu.", "warning");
    } else if (successCount === totalSelected) {
      // Tất cả đều thành công
      showMsg(`✅ Đã hoàn thành toàn bộ ${successCount}/${totalSelected} bản backup!`, "success");
    } else if (successCount > 0) {
      // Thành công một phần
      showMsg(`⚠️ Chỉ hoàn thành ${successCount}/${totalSelected} bản backup. Vui lòng kiểm tra lại các bản lỗi!`, "warning");
    } else {
      // Thất bại toàn bộ
      showMsg(`❌ Không có bản backup nào thành công!`, "error");
    }

    setBackingUpId(null);
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
  // App.jsx
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#eaeff1" }}>
      <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%', bgcolor: '#eaeff1' }}>
        {/* 1. SIDEBAR CỐ ĐỊNH BÊN TRÁI */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenZipModal={() => setShowZipModal(true)}
        />
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
                <InputLabel>Chọn Database Backup</InputLabel>
                <Select
                  multiple
                  value={selectedDbs}
                  onChange={handleSelectChange}
                  input={<OutlinedInput label="Chọn Database Backup" />}
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
                  {(dbList || []).length === 0 ? (
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
                onClick={() => setShowInputDbModal(false)}
                sx={{
                  px: 3,
                  borderRadius: "12px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#fff",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",

                  // --- GRADIENT ĐỎ NEON CHUYỂN ĐỘNG ---
                  backgroundSize: "200% 200%",
                  backgroundImage: "linear-gradient(135deg, #f44336 0%, #ba000d 50%, #f44336 100%)",
                  animation: "redFlow 3s ease infinite",

                  "@keyframes redFlow": {
                    "0%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                    "100%": { backgroundPosition: "0% 50%" },
                  },

                  boxShadow: "0 4px 15px rgba(211, 47, 47, 0.3)",

                  "&:hover": {
                    transform: "translateY(-2px)",
                    filter: "brightness(1.15)",
                    boxShadow: "0 8px 25px rgba(211, 47, 47, 0.5)",
                    "&::after": {
                      left: "100%",
                    },
                  },

                  // Hiệu ứng ánh kim quét qua
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: "-100%",
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                    transition: "all 0.6s",
                  },

                  "&:active": { transform: "scale(0.95)" }
                }}
              >
                HỦY
              </Button>
              <Button
                fullWidth
                variant="contained"
                disabled={selectedDbs.length === 0 || isFetchingDbs}
                onClick={handleBackupMultipleDbs}
                sx={{
                  borderRadius: "12px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#fff",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",

                  // --- GRADIENT XANH NEON CHUYỂN ĐỘNG ---
                  backgroundSize: "200% 200%",
                  backgroundImage: (selectedDbs.length === 0 || isFetchingDbs)
                    ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)" // Màu xám khi disabled
                    : "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 50%, #00d2ff 100%)",

                  animation: !(selectedDbs.length === 0 || isFetchingDbs) ? "blueFlow 3s ease infinite" : "none",

                  "@keyframes blueFlow": {
                    "0%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                    "100%": { backgroundPosition: "0% 50%" },
                  },

                  boxShadow: (selectedDbs.length === 0 || isFetchingDbs)
                    ? "none"
                    : "0 4px 15px rgba(0, 210, 255, 0.3)",

                  "&:hover": {
                    transform: !(selectedDbs.length === 0 || isFetchingDbs) ? "translateY(-2px)" : "none",
                    filter: "brightness(1.1)",
                    boxShadow: !(selectedDbs.length === 0 || isFetchingDbs) ? "0 8px 25px rgba(0, 210, 255, 0.5)" : "none",
                    "&::after": {
                      left: "100%",
                    },
                  },

                  // Hiệu ứng ánh kim quét qua
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: "-100%",
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                    transition: "all 0.6s",
                  },

                  "&.Mui-disabled": {
                    background: "#e2e8f0 !important",
                    color: "#94a3b8 !important",
                  },

                  "&:active": { transform: "scale(0.95)" }
                }}
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
            <Typography variant="body2" component="div">
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
                  component="div" // <--- THÊM DÒNG NÀY
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
              onClick={() => setShowBackupModal(false)}
              sx={{
                mt: 3,
                borderRadius: "12px",
                textTransform: "none",
                fontWeight: 800,
                fontSize: "0.9rem",
                py: 1.2, // Tăng độ dày cho nút trông cân đối hơn
                color: "#fff",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 4px 15px rgba(0, 212, 255, 0.3)",

                // --- GRADIENT XANH NEON DI CHUYỂN ---
                backgroundSize: "200% 200%",
                backgroundImage: "linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00f2fe 100%)",
                animation: "neonGradient 3s ease infinite",

                "@keyframes neonGradient": {
                  "0%": { backgroundPosition: "0% 50%" },
                  "50%": { backgroundPosition: "100% 50%" },
                  "100%": { backgroundPosition: "0% 50%" },
                },

                // --- HIỆU ỨNG KHI HOVER ---
                "&:hover": {
                  transform: "translateY(-3px)",
                  filter: "brightness(1.1)",
                  boxShadow: "0 8px 25px rgba(0, 242, 254, 0.5)",
                  "&::before": {
                    left: "100%",
                  },
                },

                // --- VỆT SÁNG QUÉT QUA (SHINE EFFECT) ---
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "-100%",
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  transition: "all 0.6s",
                },

                // Hiệu ứng nhấn nút (Active)
                "&:active": {
                  transform: "scale(0.95)",
                }
              }}
            >
              Đóng
            </Button>
          </Box>
        </Modal>

        {/* 2. NỘI DUNG CHÍNH BÊN PHẢI */}
        <Box component="main"
          sx={{
            flex: 1,           // Thay flexGrow bằng flex: 1
            minWidth: 0,       // QUAN TRỌNG: Ngăn nội dung đẩy bung layout
            p: 3,
            height: '100vh',   // Cố định chiều cao
            overflowY: 'scroll', // ÉP HIỆN THANH CUỘN LUÔN LUÔN để không bị giật 15px
            bgcolor: '#eaeff1'
          }}
        >

          {console.log(">>> [App] Tab đang hiển thị là:", activeTab)}
          <Container maxWidth="lg" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>


            {/* --- KHỐI TRÊN: CẤU HÌNH VÀ CHỨC NĂNG --- */}
            <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden", mb: 1 }}>

              {/* Box nội dung không dùng scroll, cho phép dãn tự nhiên */}
              {/* Thay thế đoạn này trong App.jsx từ dòng 758 đến 813 */}
              <Box sx={{ p: 0 }}>
                {/* Index 0: Chủ động */}
                {activeTab === 0 && (
                  <>
                    {console.log(">>> [App] Đang nạp ConnectionForm...")}
                    <ConnectionForm
                      formData={formData}
                      setFormData={setFormData}
                      onConnectSuccess={handleTestConnection}
                      showMsg={showMsg}
                      onLoginSuccess={handleLoginSuccess}
                      initialData={selectedServer}
                    />
                  </>

                )}

                {/* Index 1: Tự động */}
                {activeTab === 1 && (
                  <Box sx={{ p: 2 }}>
                    <FormAuto
                      showMsg={showMsg}
                      connectionLogs={connectionLogs}
                      setActiveTab={setActiveTab} // THÊM DÒNG NÀY ĐỂ TRÁNH LỖI
                      onFetchDatabases={handleOpenBackupConfig}
                      dbList={dbList}
                      isFetching={isFetchingDbs}
                    />
                  </Box>
                )}

                {/* Index 2: Quản lý Server */}
                {activeTab === 2 && (
                  <ServerManager
                    showMsg={showMsg}
                    onScanAndConnect={(serverData) => {
                      console.log(">>> [App] Kết nối từ ServerManager:", serverData);
                      setFormData((prev) => ({
                        ...prev,
                        ...serverData,
                      }));
                      setSelectedServer(serverData);
                      setActiveTab(0);
                    }}
                  />
                )}



                {/* Index 3: Đẩy lên Cloud */}
                {activeTab === 3 && (
                  <Box>
                    <UploadPopup onUpload={handleUploadFiles} showMsg={showMsg} formdata={formData} />
                    <CloudBackup
                      handleOpenUploadPopup={handleOpenUploadPopup}
                      isUploading={isUploading}
                      uploadProgress={driveProgress}
                      uploadSpeed={uploadSpeed}
                      isLoading={isLoading}
                      showMsg={showMsg}
                    />
                  </Box>
                )}

                {/* Index 4: Quản lý Gmail */}
                {activeTab === 4 && <GmailManager showMsg={showMsg} />}

                {/* Index 5: History */}
                {activeTab === 5 && <HistoryManager />}
              </Box>
            </Paper>

            {/* --- KHỐI DƯỚI: LỊCH SỬ KẾT NỐI (Chỉ hiển thị ở tab Chủ động - activeTab === 0) --- */}
            {activeTab === 0 && (
              <Paper elevation={2} sx={{ borderRadius: 2, p: 2, minHeight: "200px", bgcolor: "#fff" }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: "bold", px: 1 }}>
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


                            {/* --- ĐÂY LÀ DÒNG CHỮ ĐANG BACKUP LINH CẦN THÊM --- */}
                            {backingUpId === log.id && (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  mt: 0.8,
                                  color: "#1976d2",
                                  fontWeight: "900",
                                  fontStyle: "italic",
                                  animation: "pulseText 2s infinite"
                                }}
                              >
                                {/* Kiểm tra nếu uploadSpeed chứa chữ "Đang chuẩn bị" thì mới bóc tách, 
          nếu không thì hiển thị tên DB trực tiếp từ config của log */}
                                ● Đang backup db: {
                                  uploadSpeed.includes("Đang chuẩn bị")
                                    ? uploadSpeed.split("...")[0].replace("Đang chuẩn bị: ", "")
                                    : (log.database || "Đang xử lý")
                                } ...
                              </Typography>
                            )}



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
                          disabled={!log.success || (backingUpId !== null && backingUpId !== log.id)}
                          onClick={() => handleOpenBackupConfig(log, true)}
                          sx={{
                            borderRadius: "12px",
                            px: 3,
                            textTransform: "none",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            minWidth: "160px",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                            position: "relative",
                            overflow: "hidden",
                            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",

                            // --- LOGIC MÀU SẮC & GRADIENT ---
                            backgroundSize: "200% 200%",
                            backgroundImage: backingUpId === log.id
                              ? "linear-gradient(45deg, #f44336, #ba000d, #f44336)" // Đỏ rực khi chạy
                              : (log.success
                                ? "linear-gradient(135deg, #1976d2, #00d4ff, #1565c0)" // Xanh neon hiện đại
                                : "linear-gradient(135deg, #bdbdbd, #9e9e9e)"),

                            // --- ANIMATION KHI ĐANG BACKUP ---
                            animation: backingUpId === log.id ? "gradientMove 2s ease infinite" : "none",
                            "@keyframes gradientMove": {
                              "0%": { backgroundPosition: "0% 50%" },
                              "50%": { backgroundPosition: "100% 50%" },
                              "100%": { backgroundPosition: "0% 50%" },
                            },

                            // --- HIỆU ỨNG HOVER ---
                            "&:hover": {
                              transform: "translateY(-2px)",
                              boxShadow: log.success ? "0 8px 25px rgba(25, 118, 210, 0.4)" : "none",
                              filter: "brightness(1.15)",
                              "&::after": {
                                left: "100%",
                              },
                            },

                            // --- HIỆU ỨNG ÁNH SÁNG LƯỚT QUA (SHINE) ---
                            "&::after": {
                              content: '""',
                              position: "absolute",
                              top: 0,
                              left: "-100%",
                              width: "100%",
                              height: "100%",
                              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                              transition: "all 0.6s",
                            },

                            // Trạng thái Disabled
                            "&.Mui-disabled": {
                              background: "#e0e0e0",
                              color: "#9e9e9e",
                            }
                          }}
                        >
                          <Box
                            sx={{
                              zIndex: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              padding: "4px 8px",
                              borderRadius: "8px",
                              // Tạo hiệu ứng lấp lánh nhẹ khi đang backup
                              animation: backingUpId === log.id ? "pulse 2s infinite" : "none",
                              "@keyframes pulse": {
                                "0%": { opacity: 1 },
                                "50%": { opacity: 0.8 },
                                "100%": { opacity: 1 },
                              },
                            }}
                          >
                            {backingUpId === log.id ? (
                              <>
                                <CircularProgress
                                  size={18}
                                  thickness={6}
                                  sx={{
                                    color: "#fff",
                                    // Animation xoay mượt mà hơn
                                    animationDuration: "550ms",
                                    filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))",
                                  }}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: "900",
                                    fontSize: "0.85rem",
                                    letterSpacing: "0.5px",
                                    textShadow: "0px 1px 3px rgba(0,0,0,0.3)",
                                    fontFamily: "'Roboto Mono', monospace", // Nhìn giống số điện tử hơn
                                  }}
                                >
                                  {uploadProgress}%
                                </Typography>
                              </>
                            ) : (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <BackupIcon sx={{ fontSize: 18 }} />
                                <Typography sx={{ fontWeight: "800", letterSpacing: "1px" }}>
                                  BACKUP NOW
                                </Typography>
                              </Box>
                            )}
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
            )}


          </Container>



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
            variant="filled" // Sử dụng biến thể filled để màu sắc đậm đà hơn
            sx={{
              width: "100%",
              borderRadius: "16px", // Bo góc lớn hiện đại
              fontWeight: 600,
              fontSize: "0.95rem",
              alignItems: "center",

              // Đổ bóng đa lớp (Soft UI Shadow)
              boxShadow: "0 10px 30px rgba(0,0,0,0.15), 0 4px 8px rgba(0,0,0,0.1)",

              // Tùy chỉnh màu sắc dựa trên severity (độ nghiêm trọng)
              backgroundColor: (theme) => {
                if (snackbar.severity === "success") return "#10b981"; // Xanh Emerald
                if (snackbar.severity === "error") return "#ef4444";   // Đỏ Rose
                if (snackbar.severity === "warning") return "#f59e0b"; // Vàng Amber
                return "#3b82f6"; // Blue mặc định
              },

              // Hiệu ứng viền mảnh (Border) để trông sắc nét
              border: "1px solid rgba(255, 255, 255, 0.2)",

              // Tùy chỉnh Icon
              "& .MuiAlert-icon": {
                fontSize: "24px",
                opacity: 0.9,
              },

              // Tùy chỉnh nội dung tin nhắn
              "& .MuiAlert-message": {
                padding: "8px 0",
                letterSpacing: "0.3px",
              },

              // Hiệu ứng Hover nhẹ
              transition: "transform 0.3s ease",
              "&:hover": {
                transform: "translateY(-2px)",
              },

              // Animation khi xuất hiện (Slide & Fade)
              animation: "slideInRight 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
              "@keyframes slideInRight": {
                "0%": {
                  opacity: 0,
                  transform: "translateX(100%)",
                },
                "100%": {
                  opacity: 1,
                  transform: "translateX(0)",
                },
              },
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
      {/* Chèn ở bất kỳ đâu trong phần return (thường là gần Snackbar) */}
      <ConfirmStopModal
        open={showConfirmStopModal}
        onClose={() => setShowConfirmStopModal(false)}
        onConfirm={handleConfirmStop}
      />
      <ZipPasswordModal
        open={showZipModal}
        onClose={() => setShowZipModal(false)}
        showMsg={showMsg}
      />
    </Box >
  );
}

export default App;
