import { Modal, Box, Typography, Divider, Button, Table, TableBody, TableCell, TableContainer, TableRow } from "@mui/material";
import React from "react";

export const BackupModal = ({ open, onClose, data }) => {
  if (!data) return null;
  
  return (
    <Modal open={open} onClose={onClose} disableEnforceFocus disableRestoreFocus>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 450, bgcolor: "background.paper", borderRadius: 3, boxShadow: 24, p: 3
      }}>
        <Typography variant="h6" color="primary" fontWeight={700} gutterBottom>
          📊 Kết quả kiểm tra dữ liệu
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}><b>File:</b> {data.fileName}</Typography>
        
        <TableContainer sx={{ maxHeight: 300, bgcolor: "#f8f9fa", borderRadius: 2, border: "1px solid #eee" }}>
          <Table size="small" stickyHeader>
            <TableBody>
              {Object.entries(data.stats.rowCounts).map(([table, count]) => (
                <TableRow key={table}>
                  <TableCell sx={{ textTransform: "capitalize" }}>{table}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "#2e7d32" }}>
                    {count.toLocaleString()} dòng
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button variant="contained" fullWidth sx={{ mt: 3 }} onClick={onClose}>Đóng</Button>
      </Box>
    </Modal>
  );
};