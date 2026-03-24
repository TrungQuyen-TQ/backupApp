import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, List, Paper, Typography, Chip, IconButton, Button, Divider } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export const HistoryManager = () => {
  const [subTab, setSubTab] = useState(0);
  const [data, setData] = useState([]);

  const loadHistory = async () => {
    const type = subTab === 0 ? "backup" : "upload";
    const res = await window.electronAPI.getHistory(type);
    setData(res);
  };

  useEffect(() => {
    if (window.electronAPI) loadHistory();
  }, [subTab]);

  const handleDeleteItem = async (id) => {
    const type = subTab === 0 ? "backup" : "upload";
    const res = await window.electronAPI.deleteHistoryItem({ type, id });
    if (res.success) loadHistory();
  };

  const handleClearAll = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử này không?")) {
      const type = subTab === 0 ? "backup" : "upload";
      const res = await window.electronAPI.clearAllHistory(type);
      if (res.success) loadHistory();
    }
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', pr: 2 }}>
        <Tabs value={subTab} onChange={(e, v) => setSubTab(v)} sx={{ flex: 1 }}>
          <Tab label="Lịch sử Backup" icon={<StorageIcon />} iconPosition="start" />
          <Tab label="Lịch sử Cloud" icon={<CloudDoneIcon />} iconPosition="start" />
        </Tabs>
        <Button 
          size="small" 
          color="error" 
          startIcon={<DeleteSweepIcon />} 
          onClick={handleClearAll}
          disabled={data.length === 0}
        >
          Xóa tất cả
        </Button>
      </Box>

      <Box sx={{ p: 2 }}>
        <List sx={{ maxHeight: '550px', overflowY: 'auto' }}>
          {data.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ mb: 1.5, p: 2, bgcolor: '#fff', position: 'relative', '&:hover': { borderColor: '#1976d2' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                    {subTab === 0 ? `📁 DB: ${item.dbName}` : `☁️ File: ${item.fileName}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Thời gian: {item.timestamp}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, color: '#555' }}>
                    {subTab === 0 ? `Tên file: ${item.fileName}` : `Đích: ${item.targetEmail}`}
                  </Typography>
                  
                  {/* SỬA LỖI ROWCOUNTS: Kiểm tra stats tồn tại trước khi render */}
                  {subTab === 0 && item.stats && (
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`${item.stats.rowCounts ? Object.keys(item.stats.rowCounts).length : 0} bảng`} 
                        size="small" variant="outlined" 
                      />
                      <Chip label={item.stats.version || "N/A"} size="small" color="primary" variant="outlined" />
                    </Box>
                  )}
                </Box>

                <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)} sx={{ ml: 1 }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          ))}
          {data.length === 0 && (
            <Typography variant="body2" sx={{ textAlign: 'center', py: 8, color: '#999' }}>
              Trống rỗng... Chưa có dữ liệu lịch sử.
            </Typography>
          )}
        </List>
      </Box>
    </Box>
  );
};