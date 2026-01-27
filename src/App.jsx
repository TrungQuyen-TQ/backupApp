import React, { useState } from 'react';
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
  CircularProgress 
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import BackupIcon from '@mui/icons-material/Backup';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// Import các components con của bạn
import { TabsHeader } from './components/TabsHeader';
import { ConnectionForm } from './components/ConnectionForm';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: '127.0.0.1',
    database: 'master',
    user: 'sa',
    password: 'MatKhauCuaBan@123',
    port: '1433'
  });

  // State lưu danh sách kết nối
  const [connectionLogs, setConnectionLogs] = useState([]);
  
  // State theo dõi ID đang thực hiện backup để hiển thị Loading
  const [backingUpId, setBackingUpId] = useState(null);

  // 1. Hàm Xử lý Kiểm tra kết nối
  const handleTestConnection = async () => {
    const result = await window.electronAPI.testConnection(formData);
    
    // Copy toàn bộ formData để đảm bảo không bị thiếu user/password trong log
    const newLog = {
      ...formData, 
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      success: result.success,
      error: result.error
    };
    
    setConnectionLogs(prev => [newLog, ...prev]);
  };

  // 2. Hàm Xử lý Xóa lịch sử kết nối
  const handleDeleteLog = (id) => {
    setConnectionLogs(prev => prev.filter(log => log.id !== id));
  };

  // 3. Hàm Xử lý Backup cho từng dòng cụ thể
  const handleBackupSpecificDb = async (log) => {
    if (backingUpId) return; // Ngăn chặn bấm nhiều nút cùng lúc

    // Kiểm tra dữ liệu đăng nhập
    if (!log.user || !log.password) {
      alert("❌ Lỗi: Thông tin đăng nhập của bản ghi này bị thiếu!");
      return;
    }

    setBackingUpId(log.id); // Bắt đầu trạng thái Loading cho dòng này
    try {
      const result = await window.electronAPI.createSqlBackup(log);

      if (result.success) {
        alert(`✅ Backup thành công!\nDatabase: ${log.database}\nFile: ${result.filePath}`);
      } else {
        alert(`❌ Backup thất bại!\nLỗi: ${result.error}`);
      }
    } catch (err) {
      alert(`⚠️ Lỗi hệ thống: ${err.message}`);
    } finally {
      setBackingUpId(null); // Kết thúc trạng thái Loading
    }
  };

  // 4. Hàm Cloud Upload (Backup + Đẩy lên Drive)
  const handleCloudUpload = async () => {
    try {
      const backupResult = await window.electronAPI.createSqlBackup(formData);

      if (backupResult.success) {
        console.log("File đã tạo tại:", backupResult.filePath);
        const driveResult = await window.electronAPI.uploadToDrive(backupResult.filePath);

        if (driveResult.success) {
          alert('Thành công! File đã lên Google Drive. ID: ' + driveResult.fileId);
        } else {
          alert('Lỗi khi upload Drive: ' + driveResult.error);
        }
      } else {
        alert('Lỗi khi tạo backup: ' + backupResult.error);
      }
    } catch (err) {
      alert('Lỗi hệ thống: ' + err.message);
    }
  };

  return (
    <Box sx={{ bgcolor: '#eaeff1', minHeight: '100vh', p: 3, display: 'flex', gap: 2 }}>
      {/* CỘT TRÁI: FORM NHẬP LIỆU */}
      <Paper elevation={2} sx={{ width: '100%', maxWidth: 600, borderRadius: 2, overflow: 'hidden' }}>
        <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <ConnectionForm formData={formData} setFormData={setFormData} />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleTestConnection} variant="outlined" sx={{ textTransform: 'none' }}>
            Kiểm tra kết nối
          </Button>
          <Button 
            onClick={handleCloudUpload} 
            variant="contained" 
            startIcon={<CloudIcon />}
            sx={{ textTransform: 'none' }}
          >
            Cloud
          </Button>
        </Box>
      </Paper>

      {/* CỘT PHẢI: LỊCH SỬ KẾT NỐI */}
      <Paper elevation={2} sx={{ flex: 1, borderRadius: 2, p: 2, maxHeight: '131vh', overflowY: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>Lịch sử kết nối</Typography>
        <Divider />
        <List sx={{ px: 1 }}>
          {connectionLogs.map((log) => (
            <ListItem
              key={log.id}
              sx={{
                mb: 2,
                borderRadius: '12px',
                bgcolor: '#ffffff',
                border: '1px solid #e0e4e8',
                boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
                transition: '0.3s',
                '&:hover': {
                  boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
                  borderColor: '#1976d2',
                },
                flexDirection: 'column',
                alignItems: 'stretch',
                p: 2
              }}
            >
              {/* Phần thông tin phía trên */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      p: 1,
                      borderRadius: '8px',
                      bgcolor: log.success ? '#e8f5e9' : '#ffebee'
                    }}
                  >
                    {log.success ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1a2027', lineHeight: 1.2 }}>
                      {log.database}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#707880', display: 'block', mt: 0.5 }}>
                      Kết nối lúc: {log.time}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Nút Xóa nhỏ gọn ở góc */}
                <IconButton 
                  size="small" 
                  onClick={() => handleDeleteLog(log.id)}
                  disabled={backingUpId === log.id}
                  sx={{ color: '#d32f2f', '&:hover': { bgcolor: '#fff5f5' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              <Divider sx={{ my: 1, borderStyle: 'dashed' }} />

              {/* Thông tin Server & Nút Backup phía dưới */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#5f666d', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>IP:</Box> {log.server}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  disabled={backingUpId !== null}
                  startIcon={backingUpId === log.id ? <CircularProgress size={16} color="inherit" /> : <BackupIcon />}
                  onClick={() => handleBackupSpecificDb(log)}
                  sx={{
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                    bgcolor: log.success ? '#7b1fa2' : '#b0bec5', // Màu tím đặc trưng cho Backup
                    '&:hover': { bgcolor: '#6a1b9a' }
                  }}
                >
                  {backingUpId === log.id ? 'Đang chạy...' : 'BACKUP'}
                </Button>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}

export default App;