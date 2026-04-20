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
        <List
          sx={{
            maxHeight: '550px',
            overflowY: 'auto',
            pr: 1, // Tạo khoảng trống cho scrollbar
            // Tùy chỉnh thanh cuộn cho đồng bộ
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: '#e0e0e0', borderRadius: '10px' }
          }}
        >
          {data.map((item) => (
            <Paper
              key={item.id}
              variant="outlined"
              sx={{
                mb: 2,
                p: 2,
                borderRadius: '16px',
                bgcolor: '#fff',
                position: 'relative',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid #f0f0f0',
                display: 'flex',
                flexDirection: 'column',
                // Hiệu ứng hover hiện đại
                '&:hover': {
                  borderColor: '#1976d2',
                  boxShadow: '0 8px 24px rgba(25, 118, 210, 0.12)',
                  transform: 'translateY(-3px)',
                  '& .delete-icon': { opacity: 1, transform: 'scale(1)' }
                }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                  {/* Icon trạng thái tròn phía trước */}
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: '12px',
                      bgcolor: subTab === 0 ? '#e3f2fd' : '#f3e5f5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {subTab === 0 ?
                      <StorageIcon sx={{ color: '#1976d2' }} /> :
                      <CloudDoneIcon sx={{ color: '#9c27b0' }} />
                    }
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#2c3e50', lineHeight: 1.2 }}>
                      {subTab === 0 ? item.dbName : item.fileName}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                        {item.timestamp}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#cbd5e1' }}>•</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                        {subTab === 0 ? "SQL Server Backup" : "Cloud Uploaded"}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{
                        mt: 1, p: 1, borderRadius: '8px', bgcolor: '#f8fafc',
                        fontSize: '0.75rem', color: '#475569', border: '1px solid #f1f5f9'
                      }}
                    >
                      {subTab === 0 ? (
                        <>
                          <div><strong>File:</strong> {item.fileName}</div>
                          {/* THÊM DÒNG NÀY ĐỂ HIỂN THỊ ĐƯỜNG DẪN LƯU TRỮ */}
                          <div style={{ marginTop: '4px', color: '#1976d2' }}>
                            <strong>Đường dẫn:</strong> {item.localPath || "Mặc định"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div><strong>Đích:</strong> {item.targetEmail}</div>
                          {/* THÊM DÒNG NÀY ĐỂ HIỂN THỊ TÊN FOLDER TRÊN DRIVE */}
                          <div style={{ marginTop: '4px', color: '#9c27b0', fontWeight: 'bold' }}>
                            <strong>Folder Drive:</strong> {item.folderName || "SQL_Backups"}
                          </div>
                        </>

                      )}
                    </Typography>

                    {subTab === 0 && item.stats && (
                      <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={`${item.stats.rowCounts ? Object.keys(item.stats.rowCounts).length : 0} Tables`}
                          size="small"
                          sx={{ borderRadius: '6px', fontWeight: 700, bgcolor: '#fff', border: '1px solid #e2e8f0' }}
                        />
                        <Chip
                          label={item.stats.version || "N/A"}
                          size="small"
                          color="primary"
                          sx={{ borderRadius: '6px', fontWeight: 700, fontSize: '0.65rem' }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>

                <IconButton
                  className="delete-icon"
                  size="small"
                  color="error"
                  onClick={() => handleDeleteItem(item.id)}
                  sx={{
                    ml: 1, opacity: 0, transform: 'scale(0.8)',
                    transition: '0.2s ease', bgcolor: '#fff1f1'
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Paper>
          ))}

          {data.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography variant="body1" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                Chưa có lịch sử để hiển thị
              </Typography>
            </Box>
          )}
        </List>
      </Box>
    </Box>
  );
};