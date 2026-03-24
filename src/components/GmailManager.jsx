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
      <Paper variant="outlined" sx={{ maxHeight: '300px', overflowY: 'auto' }}>
        <List dense>
          {accounts.map((acc, index) => (
            <ListItem key={index} divider 
              secondaryAction={
                <IconButton edge="end" color="error" onClick={() => handleDelete(acc.email)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <EmailIcon sx={{ mr: 2, color: '#1976d2' }} />
              <ListItemText primary={acc.email} secondary={acc.label} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};