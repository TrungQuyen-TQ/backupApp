import React, { useState } from 'react';
import {
    Box,
    Tabs,
    Tab,
    Typography,
    Button,
    CircularProgress,
    TextField,
    InputAdornment,
    LinearProgress
} from '@mui/material';
import CloudIcon from "@mui/icons-material/Cloud";

export const CloudBackup = ({
    handleOpenUploadPopup,
    isUploading,
    uploadProgress,
    uploadSpeed, // Nhận thêm tốc độ
    isLoading
}) => {
    const [cloudSubTab, setCloudSubTab] = useState(0);

    return (
        <Box sx={{ p: 0 }}>
            {/* Thanh điều hướng Sub-tabs */}
            <Box sx={{ width: '100%', bgcolor: '#f5f7fa', borderBottom: 1, borderColor: 'divider' }}>

                <Tabs
                    value={cloudSubTab}
                    onChange={(e, v) => setCloudSubTab(v)}
                    centered
                    sx={{
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 'bold', fontSize: '1rem' },
                        '& .Mui-selected': { color: '#fff !important', bgcolor: '#1976d2' },
                        '& .MuiTabs-indicator': { display: 'none' }
                    }}
                >
                    <Tab label="Google Drive" />
                    <Tab label="AWS" />
                </Tabs>
            </Box>

            <Box sx={{ p: 2 }}>
                {/* NỘI DUNG GOOGLE DRIVE */}
                {cloudSubTab === 0 && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: '#666' }}>
                            Cấu hình và Giám sát Google Drive
                        </Typography>

                        {/* Nút bấm đẩy lên Drive di chuyển từ App.jsx sang */}
                        <Button
                            fullWidth
                            onClick={handleOpenUploadPopup}
                            variant="contained"
                            startIcon={
                                isUploading ? <CircularProgress size={20} color="inherit" /> : <CloudIcon />
                            }
                            disabled={isLoading || isUploading}
                            sx={{ py: 1.5, position: "relative", overflow: "hidden", mb: 2 }}
                        >
                            {isUploading ? `Đang tải lên (${uploadProgress}%)` : "Bắt đầu tải lên Drive"}
                            {isUploading && (
                                <LinearProgress
                                    variant="determinate"
                                    value={uploadProgress}
                                    sx={{
                                        position: "absolute",
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: 4,
                                    }}
                                />
                            )}
                        </Button>

                        {/* Ô Giám sát đường truyền di chuyển từ App.jsx sang */}
                        <TextField
                            fullWidth
                            label="Giám sát đường truyền"
                            size="small"
                            variant="outlined"
                            value={isUploading ? uploadSpeed : "Hệ thống sẵn sàng"}
                            InputProps={{
                                readOnly: true,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <CloudIcon
                                            sx={{
                                                color: isUploading ? "#1976d2" : "#b0bec5",
                                                animation: isUploading ? "pulse 1.5s infinite" : "none",
                                                "@keyframes pulse": {
                                                    "0%": { opacity: 1 },
                                                    "50%": { opacity: 0.4 },
                                                    "100%": { opacity: 1 },
                                                }
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                                sx: {
                                    fontFamily: "'JetBrains Mono', monospace",
                                    bgcolor: isUploading ? "#f0f7ff" : "#fafafa",
                                    fontWeight: "bold",
                                    fontSize: "0.9rem",
                                    color: isUploading ? "#1976d2" : "#607d8b",
                                    "& fieldset": {
                                        borderColor: isUploading ? "#1976d2 !important" : "#e0e0e0",
                                        borderWidth: isUploading ? "2px" : "1px",
                                    },
                                }
                            }}
                            helperText={
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}>
                                    {isUploading ? (
                                        <>
                                            <CircularProgress size={10} thickness={6} />
                                            <span style={{ color: '#1976d2' }}>Đang đẩy dữ liệu lên Google Drive...</span>
                                        </>
                                    ) : (
                                        "Trạng thái: Nhàn rỗi"
                                    )}
                                </Box>
                            }
                        />
                    </Box>
                )}

                {/* NỘI DUNG AWS S3 */}
                {cloudSubTab === 1 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="textSecondary">
                            Tính năng AWS S3 sẽ sớm ra mắt...
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};