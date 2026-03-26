import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, List, ListItem, ListItemText, IconButton, Paper, Typography, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EmailIcon from '@mui/icons-material/Email';

export const GmailManager = ({ showMsg }) => {
  const [accounts, setAccounts] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Load danh sách lúc mở Tab
  const loadAccounts = async () => {
    const result = await window.electronAPI.getDriveAccounts();
    if (result.success) setAccounts(result.accounts);
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleAdd = async () => {
    if (!newEmail || !newEmail.includes("@")) return showMsg("Email không hợp lệ", "error");
    
    // Gửi xuống Backend để lưu vào file JSON
    const updatedList = [...accounts, { email: newEmail, label: newLabel || "Drive mới" }];
    const result = await window.electronAPI.updateDriveAccounts(updatedList);
    
    if (result.success) {
      setAccounts(updatedList);
      setNewEmail("");
      setNewLabel("");
      showMsg("Đã thêm Gmail thành công!");
    }
  };

  const handleDelete = async (emailToDelete) => {
    const updatedList = accounts.filter(acc => acc.email !== emailToDelete);
    const result = await window.electronAPI.updateDriveAccounts(updatedList);
    if (result.success) {
      setAccounts(updatedList);
      showMsg("Đã xóa Gmail!");
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Thêm tài khoản nhận Backup</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField 
          size="small" label="Gmail Address" value={newEmail} 
          onChange={(e) => setNewEmail(e.target.value)} sx={{ flex: 2 }} 
        />
        <TextField 
          size="small" label="Ghi chú (Ví dụ: Drive phụ)" value={newLabel} 
          onChange={(e) => setNewLabel(e.target.value)} sx={{ flex: 1 }} 
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>Thêm</Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Danh sách Gmail hiện có</Typography>
      <Paper 
  variant="outlined" 
  sx={{ 
    maxHeight: '400px', 
    overflowY: 'auto', 
    border: 'none', 
    bgcolor: 'transparent',
    
    // Custom scrollbar cho tinh tế
    '&::-webkit-scrollbar': { width: '5px' },
    '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '10px' }
  }}
>
  <List dense sx={{ p: 0 }}>
    {accounts.map((acc, index) => (
      <ListItem 
        key={index} 
        sx={{ 
          mt: 1, // Tạo khoảng cách giữa các card
          mb: 1.5, // Tạo khoảng cách giữa các card
          borderRadius: '12px',
          border: '1px solid #e0e4e8',
          bgcolor: '#fff',
          transition: 'all 0.3s ease', // Hiệu ứng mượt mà
          '&:hover': {
            borderColor: '#1976d2',
            transform: 'translateY(-2px)', // Nhấc nhẹ card lên
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.08)',
            '& .delete-btn': { opacity: 1 } // Hiện nút xóa khi hover
          }
        }}
        secondaryAction={
          <IconButton 
            className="delete-btn"
            edge="end" 
            color="error" 
            onClick={() => handleDelete(acc.email)}
            sx={{ 
              opacity: 0.6, // Mặc định hơi mờ
              transition: '0.2s',
              '&:hover': { bgcolor: '#fff1f1', transform: 'scale(1.1)' } 
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        }
      >
        <Box 
          sx={{ 
            p: 1, 
            mr: 2, 
            borderRadius: '10px', 
            bgcolor: '#f0f7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <EmailIcon sx={{ color: '#1976d2', fontSize: '1.2rem' }} />
        </Box>

        <ListItemText 
          primary={
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2c3e50' }}>
              {acc.email}
            </Typography>
          } 
          secondary={
            <Typography variant="caption" sx={{ color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4caf50', display: 'inline-block' }}></span>
              {acc.label || "Tài khoản liên kết"}
            </Typography>
          } 
        />
      </ListItem>
    ))}
  </List>
</Paper>
    </Box>
  );
};