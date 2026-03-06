import React, { useState } from "react";
import {
  Box,
  Paper,
  Button,
  List,
  Typography,
  CircularProgress,
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import { BackupModal } from "../components/BackupModal";
import { LogItem } from "../components/LogItem";
import { TabsHeader } from "../components/TabsHeader";
import { ConnectionForm } from "../components/ConnectionForm";

const DashboardPage = ({ showMsg }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: "127.0.0.1",
    database: "master",
    user: "sa",
    password: "MatKhauCuaBan@123",
    port: "1433",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [backingUpId, setBackingUpId] = useState(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupStats, setBackupStats] = useState(null);

  // 1. Kiểm tra kết nối
  const handleTestConnection = async () => {
    try {
      const result = await window.electronAPI.testConnection(formData);
      const newLog = {
        ...formData,
        id: Date.now(),
        time: new Date().toLocaleTimeString(),
        success: result.success,
        error: result.error,
      };
      setConnectionLogs((prev) => [newLog, ...prev]);
      
      if (result.success) {
        showMsg("Kết nối thành công!", "success");
      } else {
        showMsg("Kết nối thất bại: " + result.error, "error");
      }
    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
    }
  };

  // 2. Xóa lịch sử
  const handleDeleteLog = (id) => {
    setConnectionLogs((prev) => prev.filter((log) => log.id !== id));
  };

  // 3. Backup dòng cụ thể
  const handleBackupSpecificDb = async (log) => {
    setBackingUpId(log.id);
    try {
      const result = await window.electronAPI.createSqlBackup(log);
      if (result.success) {
        setBackupStats(result);
        setShowBackupModal(true);
      } else {
        showMsg(`❌ Lỗi backup: ${result.error}`, "error");
      }
    } catch (err) {
      showMsg(`⚠️ Hệ thống: ${err.message}`, "error");
    } finally {
      setBackingUpId(null);
    }
  };

  // 4. Check thông tin phiên bản
  const handleCheckVersion = async (log) => {
    try {
      const result = await window.electronAPI.checkDatabaseInfo(log);
      if (result.success) {
        const tableCount = Object.keys(result.counts).length;
        showMsg(`🚀 SQL: ${result.version} | 📊 Quét: ${tableCount} bảng.`, "success");
        setBackupStats({
          stats: { rowCounts: result.counts },
          fileName: "Thông tin hiện tại",
        });
        setShowBackupModal(true);
      } else {
        showMsg(`❌ Lỗi: ${result.error}`, "error");
      }
    } catch (err) {
      showMsg(`⚠️ Hệ thống: ${err.message}`, "error");
    }
  };

  // 5. Upload Cloud
  const handleCloudUpload = async () => {
    setIsLoading(true);
    try {
      const backupResult = await window.electronAPI.createSqlBackup(formData);
      if (backupResult.success) {
        const driveResult = await window.electronAPI.uploadToDrive({
          filePath: backupResult.filePath,
          stats: backupResult.stats || {},
        });
        if (driveResult.success) {
          showMsg("Thành công! File đã lên Google Drive.", "success");
        } else {
          showMsg("Lỗi upload: " + driveResult.error, "error");
        }
      } else {
        showMsg("Lỗi backup: " + backupResult.error, "error");
      }
    } catch (err) {
      showMsg("Lỗi hệ thống: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 2,width:"70%" }}>
      <BackupModal
        open={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        data={backupStats}
      />

      {/* CỘT TRÁI: FORM */}
      <Paper elevation={2} sx={{ width: "100%", maxWidth: 600, borderRadius: 2 }}>
        <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <ConnectionForm formData={formData} setFormData={setFormData} />
        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button onClick={handleTestConnection} variant="outlined">
            Kiểm tra
          </Button>
          <Button
            onClick={handleCloudUpload}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CloudIcon />}
          >
            {isLoading ? "Đang xử lý..." : "Đẩy lên Cloud"}
          </Button>
        </Box>
      </Paper>

      {/* CỘT PHẢI: LOGS */}
      <Paper elevation={2} sx={{ flex: 1, borderRadius: 2, p: 2, maxHeight: '85vh', overflowY: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Lịch sử kết nối
        </Typography>
        <List>
          {connectionLogs.map((log) => (
            <LogItem
              key={log.id}
              log={log}
              backingUpId={backingUpId}
              onDelete={handleDeleteLog}
              onCheck={handleCheckVersion}
              onBackup={handleBackupSpecificDb}
            />
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default DashboardPage;