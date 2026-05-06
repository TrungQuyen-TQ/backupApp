import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, List, Paper, Typography, Chip, IconButton, Button, Divider } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Fade } from '@mui/material';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export const HistoryManager = () => {
  const [subTab, setSubTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'single' | 'all', id?: any, name?: string }

  const loadHistory = async () => {
    setLoading(true); // Bắt đầu load thì bật loading
    const type = subTab === 0 ? "backup" : "upload";
    const res = await window.electronAPI.getHistory(type);
    setData(res);
    setLoading(false); // Load xong thì tắt
  };

  // const loadHistory = async () => {
  //   const type = subTab === 0 ? "backup" : "upload";
  //   const res = await window.electronAPI.getHistory(type);
  //   setData(res);
  // };

  useEffect(() => {
    if (window.electronAPI) loadHistory();
  }, [subTab]);

  const handleDeleteItem = async (id) => {
    const type = subTab === 0 ? "backup" : "upload";
    const res = await window.electronAPI.deleteHistoryItem({ type, id });
    if (res.success) loadHistory();
  };

  const handleClearAll = async () => {
    const type = subTab === 0 ? "backup" : "upload";
    const res = await window.electronAPI.clearAllHistory(type);
    if (res.success) loadHistory();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'all') {
      handleClearAll();
    } else {
      handleDeleteItem(deleteTarget.id);
    }
    setDeleteTarget(null);
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
          onClick={() => setDeleteTarget({ type: 'all' })}
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

          {loading ? (
            // Hiển thị các khung giữ chỗ khi đang load để giao diện không bị sụp
            [1, 2, 3].map((i) => (
              <Paper
                key={i}
                variant="outlined"
                sx={{
                  height: 140, // Cố định chiều cao khớp với item Backup
                  mb: 2,
                  p: 2,
                  borderRadius: '16px',
                  display: 'flex',
                  gap: 2,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  bgcolor: 'rgba(0,0,0,0.02)',
                  border: '1px solid #f0f0f0',
                  overflow: 'hidden'
                }}
              >
                {/* Giả lập Icon Box */}
                <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: '#eee', flexShrink: 0 }} />
                {/* Gi giả lập dòng Text */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ width: '60%', height: 20, bgcolor: '#eee', mb: 1, borderRadius: '4px' }} />
                  <Box sx={{ width: '40%', height: 15, bgcolor: '#eee', mb: 2, borderRadius: '4px' }} />
                  <Box sx={{ width: '100%', height: 40, bgcolor: '#eee', borderRadius: '8px' }} />
                </Box>
              </Paper>
            ))
          ) : (

            data.map((item) => (
              <Fade in={true} key={item.id} timeout={300}>
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
                    width: '100%', // Đảm bảo Paper luôn chiếm hết chiều ngang cha
                    boxSizing: 'border-box', // Chống padding đẩy width ra ngoài
                    '&:hover': {
                      borderColor: '#1976d2',
                      boxShadow: '0 8px 24px rgba(25, 118, 210, 0.12)',
                      transform: 'translateY(-3px)',
                      '& .delete-icon': { opacity: 1, transform: 'scale(1)' }
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    {/* Box chứa icon và nội dung chính - minWidth: 0 là chìa khóa để chống vỡ */}
                    <Box sx={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 44, height: 44, borderRadius: '12px',
                          bgcolor: subTab === 0 ? '#e3f2fd' : '#f3e5f5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {subTab === 0 ? <StorageIcon sx={{ color: '#1976d2' }} /> : <CloudDoneIcon sx={{ color: '#9c27b0' }} />}
                      </Box>

                      {/* Box chứa Text - Thêm minWidth: 0 ở đây nữa */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* PHẦN HIỂN THỊ TIÊU ĐỀ: Tách dòng cho Cloud (subTab !== 0) */}
                        {subTab !== 0 ? (
                          item.fileName.split(',').map((name, i) => (
                            <Typography
                              key={i}
                              variant="subtitle1"
                              sx={{
                                fontWeight: 800,
                                color: '#2c3e50',
                                lineHeight: 1.4,
                                wordBreak: 'break-all', // Ngắt dòng cho các file quá dài
                                display: 'block',
                                mb: 0.5
                              }}
                            >
                              {name.trim()}
                            </Typography>
                          ))
                        ) : (
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 800, color: '#2c3e50', lineHeight: 1.3 }}
                          >
                            {item.dbName}
                          </Typography>
                        )}

                        {/* Thông tin phụ: Thời gian */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                            {item.timestamp}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>•</Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                            {subTab === 0 ? "SQL Server Backup" : "Cloud Uploaded"}
                          </Typography>
                        </Box>

                        {/* Box thông tin chi tiết (Đích, Folder...) */}
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1, p: 1.5, borderRadius: '8px', bgcolor: '#f8fafc',
                            fontSize: '0.75rem', color: '#475569', border: '1px solid #f1f5f9',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'block',
                            wordBreak: 'break-all',
                            whiteSpace: 'normal'
                          }}
                        >
                          {subTab === 0 ? (
                            <>
                              <div style={{ wordBreak: 'break-all' }}><strong>File:</strong> {item.fileName}</div>
                              <div style={{ marginTop: '4px', color: '#1976d2', wordBreak: 'break-all' }}>
                                <strong>Đường dẫn:</strong> {item.localPath || "Mặc định"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ wordBreak: 'break-all' }}><strong>Đích:</strong> {item.targetEmail}</div>
                              <div style={{ marginTop: '6px', color: '#9c27b0', fontWeight: 'bold', wordBreak: 'break-all' }}>
                                <strong>Folder Drive:</strong> {item.folderName || "SQL_Backups"}
                              </div>
                            </>
                          )}
                        </Typography>

                        {/* Chip hiển thị số Table (chỉ cho Backup) */}
                        {subTab === 0 && item.stats && (
                          <Box sx={{
                            mt: 1.5,
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'nowrap', // Đổi từ wrap sang nowrap để cố định trên 1 dòng
                            overflow: 'hidden',
                            height: '32px' // Cố định chiều cao cho vùng chứa Chip
                          }}>
                            <Chip
                              label={`${item.stats.rowCounts ? Object.keys(item.stats.rowCounts).length : 0} Tables`}
                              size="small"
                              sx={{ flexShrink: 0, borderRadius: '6px', fontWeight: 700 }} // Thêm flexShrink: 0
                            />
                            <Chip
                              label={item.stats.version || "N/A"}
                              size="small"
                              color="primary"
                              sx={{ flexShrink: 0, borderRadius: '6px', fontWeight: 700 }} // Thêm flexShrink: 0
                            />
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Nút xóa item */}
                    <IconButton
                      className="delete-icon"
                      size="small"
                      color="error"
                      onClick={() => setDeleteTarget({ 
                        type: 'single', 
                        id: item.id, 
                        name: subTab === 0 ? item.dbName : item.fileName 
                      })}
                      sx={{
                        ml: 1, opacity: 0, transform: 'scale(0.8)',
                        transition: '0.2s ease', bgcolor: '#fff1f1',
                        flexShrink: 0
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>

              </Fade>

            ))

          )}




          {data.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 10 }}>
              <Typography variant="body1" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                Chưa có lịch sử để hiển thị
              </Typography>
            </Box>
          )}
        </List>
      </Box>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.type === 'all' ? "Xóa toàn bộ lịch sử?" : "Xóa lịch sử này?"}
        confirmText={deleteTarget?.type === 'all' ? "Xóa tất cả" : "Xóa bản ghi"}
        description={
          deleteTarget?.type === 'all' 
            ? `Bạn có chắc chắn muốn xóa toàn bộ lịch sử ${subTab === 0 ? "Backup" : "Cloud"} không?`
            : `Bạn có chắc chắn muốn xóa bản ghi: ${deleteTarget?.name}?`
        }
      />
    </Box >
  );
};