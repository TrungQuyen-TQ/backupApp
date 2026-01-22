import React, { useState } from 'react';
import { Box, Paper, Button } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import { TabsHeader } from './components/TabsHeader';
import { ConnectionForm } from './components/ConnectionForm';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: '45.124.84.145',
    database: 'master',
    user: 'sa',
    password: 'MatKhauCuaBan@123',
    port: '1433'
  });

const handleCloudUpload = async () => {
  try {
    // Bước 1: Gọi lệnh tạo backup trên Ubuntu và đợi nó kéo về Windows
    // formData lấy từ các ô nhập liệu (IP, User, Pass sa, DB Name)
    const backupResult = await window.electronAPI.createSqlBackup(formData);

    if (backupResult.success) {
      console.log("File đã về máy local tại:", backupResult.filePath);

      // Bước 2: Lấy đường dẫn file vừa tải về để đẩy lên Google Drive
      const driveResult = await window.electronAPI.uploadToDrive(backupResult.filePath);

      if (driveResult.success) {
        alert('Thành công! File đã lên Google Drive. ID: ' + driveResult.fileId);
      } else {
        alert('Lỗi khi upload Drive: ' + driveResult.error);
      }
    } else {
      alert('Lỗi khi tạo backup từ Server: ' + backupResult.error);
    }
  } catch (err) {
    alert('Lỗi hệ thống: ' + err.message);
  }
  console.log("formdata:" ,formData);
};

  return (
    <Box sx={{ bgcolor: '#eaeff1', minHeight: '100vh', p: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <Paper elevation={2} sx={{ width: '100%', maxWidth: 750, borderRadius: 2, overflow: 'hidden' }}>
        {/* Header Tabs */}
        <TabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Form Body */}
        <ConnectionForm formData={formData} setFormData={setFormData} />

        {/* Footer Actions */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', bgcolor: '#fcfcfc', borderTop: 1, borderColor: '#eee' }}>
          <Button 
            onClick={handleCloudUpload} 
            variant="contained" 
            startIcon={<CloudIcon />}
            sx={{ 
              bgcolor: '#1976d2', 
              textTransform: 'none', 
              px: 5, py: 1,
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}
          >
            Cloud
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default App;