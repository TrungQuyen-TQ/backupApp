import { ListItem, Box, Typography, IconButton, Divider, Button, CircularProgress } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import DeleteIcon from "@mui/icons-material/Delete";
import BackupIcon from "@mui/icons-material/Backup";
import React from "react";

export const LogItem = ({ log, backingUpId, onDelete, onCheck, onBackup }) => (
  <ListItem sx={{
    mb: 2, borderRadius: 3, bgcolor: "#fff", border: "1px solid #e0e4e8",
    flexDirection: "column", alignItems: "stretch", p: 2,
    "&:hover": { boxShadow: "0px 4px 12px rgba(0,0,0,0.1)", borderColor: "#1976d2" }
  }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ p: 1, borderRadius: 2, bgcolor: log.success ? "#e8f5e9" : "#ffebee" }}>
          {log.success ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{log.database}</Typography>
          <Typography variant="caption" color="text.secondary">Lúc: {log.time}</Typography>
        </Box>
      </Box>
      <IconButton size="small" onClick={() => onDelete(log.id)} sx={{ color: "#d32f2f" }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>

    <Divider sx={{ my: 1, borderStyle: "dashed" }} />

    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="caption"><b>IP:</b> {log.server}</Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" variant="outlined" onClick={() => onCheck(log)}>CHECK</Button>
        <Button 
          size="small" variant="contained" 
          disabled={backingUpId !== null}
          color={log.success ? "secondary" : "inherit"}
          startIcon={backingUpId === log.id ? <CircularProgress size={14} color="inherit" /> : <BackupIcon />}
          onClick={() => onBackup(log)}
        >
          {backingUpId === log.id ? "..." : "BACKUP"}
        </Button>
      </Box>
    </Box>
  </ListItem>
);