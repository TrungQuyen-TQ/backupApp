import React, { useState } from 'react';
import { Box, Paper, Button } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import { TabsHeader } from './components/TabsHeader';
import { ConnectionForm } from './components/ConnectionForm';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState({
    server: '',
    database: '',
    user: '',
    password: '',
    port: '1433'
  });

  const handleConnect = () => {
    console.log("Dữ liệu gửi sang Electron Main:", formData);
    // Gửi sang Electron Main Process qua IPC
    if (window.electronAPI) {
      window.electronAPI.testConnection(formData);
    } else {
      alert("Chạy trong trình duyệt - Dữ liệu: " + JSON.stringify(formData));
    }
  };

  const handleCloudUpload = async () => {
  // Ở đây tôi giả định bạn đã có một file .sql được tạo ra trước đó
  const testFilePath = 'C:/hls_output/test.sql';
  
  const result = await window.electronAPI.uploadToDrive(testFilePath);

  if (result.success) {
    alert('Đã đẩy file lên Google Drive thành công! ID: ' + result.fileId);
  } else {
    alert('Thất bại: ' + result.error);
  }
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