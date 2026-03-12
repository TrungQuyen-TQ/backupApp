import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  TextField,
  Typography,
  FormControl,
  Button,
  Autocomplete,
  Checkbox,
  Alert,
  Divider,
  Stack,
  Paper,
  
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import StorageIcon from "@mui/icons-material/Storage";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";


const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export const FormAuto = ({
  connectionLogs,
  setActiveTab,
  onFetchDatabases,
  dbList,
  isFetching,
}) => {
  const handleServerChange = (e) => {
    const serverId = e.target.value;
    const conn = successfulConnections.find(
      (c) => String(c.id) === String(serverId),
    );

    setSelectedServer(conn);

    if (conn) {
      // Gọi hàm của App.jsx truyền xuống
      // conn.raw chính là đối tượng "log" chứa config
      onFetchDatabases(conn.raw, false); // Không show modal chọn DB nữa vì đã có sẵn list DB trả về
      setSelectedDBs([]); // Reset danh sách chọn cũ
    }
  };
  // 1. Lọc danh sách các kết nối thành công (Unique bằng Server + Type)
  const successfulConnections = useMemo(() => {
    const successLogs = connectionLogs.filter((log) => log.success);
    // Lọc trùng để hiển thị danh sách gọn gàng
    const unique = [];
    const map = new Map();
    for (const item of successLogs) {
      const key = `${item.server}-${item.dbType}`;
      if (!map.has(key)) {
        map.set(key, true);
        unique.push({
          id: item.id,
          displayName: `${item.server} (${item.dbType})`,
          raw: item,
        });
      }
    }
    return unique;
  }, [connectionLogs]);

  const [driveAccounts, setDriveAccounts] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);

  const refreshActiveTasks = async () => {
  const res = await window.electronAPI.getAutoConfigs(); // Bạn cần thêm hàm này ở preload/main
  if (res.success) {
    setActiveTasks(res.configs);
  }
};

useEffect(() => {
  refreshActiveTasks(); // Chạy khi tab Auto được mở
}, []);

  // 2. Fetch danh sách email khi component mount
  useEffect(() => {
    const fetchEmails = async () => {
      const res = await window.electronAPI.getDriveAccounts();
      if (res.success) {
        setDriveAccounts(res.accounts);
      }
    };
    fetchEmails();
  }, []);

  // 2. States quản lý form
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDBs, setSelectedDBs] = useState([]);
  const [schedule, setSchedule] = useState({
    type: "day", // Mặc định là theo ngày
    interval: 1, // Mỗi 1 đơn vị
    time: "02:00", // Giờ bắt đầu
    retention: 7, // Số bản giữ lại
  });

  const handleSaveConfig = async () => {
    const finalConfig = {
      server: selectedServer?.raw,
      databases: selectedDBs,
      schedule: schedule,
      targetEmails: selectedEmails, // TRUYỀN EMAIL Ở ĐÂY
    };
    const res = await window.electronAPI.saveAutoBackup(finalConfig);
    if (res.success) {
    alert("Kích hoạt chu trình backup thành công!");
    refreshActiveTasks(); // <--- Cập nhật lại danh sách hiển thị
    // Reset form nếu muốn
    setSelectedDBs([]);
  }
  };

  const handleStopTask = async (taskId) => {
    const res = await window.electronAPI.stopAutoBackup(taskId);
    if (res.success) {
      alert("Đã dừng và xóa lịch trình backup thành công!");
      // Cập nhật lại giao diện
      setActiveTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleStopAllTasks = async () => {
  if (window.confirm("Bạn có chắc chắn muốn dừng tất cả lịch trình backup hiện có?")) {
    // Gọi xuống Electron để stop cron jobs
    const res = await window.electronAPI.stopAllBackups(); 
    if (res.success) {
      setActiveTasks([]); // Xóa trắng danh sách trên giao diện
      alert("Đã dừng tất cả chu trình!");
    }
  }
};

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ fontWeight: "bold", color: "#1976d2" }}
      >
        Thiết lập Sao lưu Tự động
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {successfulConnections.length === 0 ? (
        <Alert severity="warning">
          Chưa có kết nối nào thành công. Vui lòng kiểm tra kết nối ở tab{" "}
          <b>Chủ động</b> trước.
        </Alert>
      ) : (
        <Stack spacing={4}>
          {/* PHẦN 1: CHỌN SERVER */}
          <Box>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <StorageIcon color="primary" /> Cấu hình
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                select
                fullWidth
                value={selectedServer?.id || ""}
                onChange={handleServerChange}
                SelectProps={{ native: true }}
              >
                <option value="" disabled>
                  -- Chọn server --
                </option>
                {successfulConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.displayName}
                  </option>
                ))}
              </TextField>
              <IconButton
                color="primary"
                onClick={() => setActiveTab(0)} // Giả sử Tab Chủ động là index 0
                sx={{
                  bgcolor: "rgba(25, 118, 210, 0.04)",
                  border: "1px solid",
                  borderColor: "primary.main",
                  borderRadius: 1,
                }}
                title="Thêm kết nối mới"
              >
                <AddIcon />
              </IconButton>
            </Box>
          </Box>

          {/* PHẦN 2: CHỌN NHIỀU DATABASE (Chỉ hiện khi đã chọn Server) */}
          {/* 2. Chọn Database (Dùng list DB trả về từ App.jsx) */}
          {selectedServer && (
            <Autocomplete
              multiple
              options={dbList || []}
              loading={isFetching}
              getOptionLabel={(option) => option} // Vì hàm của bạn trả về mảng string
              value={selectedDBs}
              onChange={(_, newValue) => setSelectedDBs(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={isFetching ? "Đang tải DB..." : "Chọn Database"}
                />
              )}
            />
          )}
          <Autocomplete
            multiple
            options={driveAccounts}
            // Thêm dòng này để MUI biết cách so sánh 2 object tài khoản
            isOptionEqualToValue={(option, value) =>
              option.email === value.email
            }
            getOptionLabel={(option) => {
              // Kiểm tra an toàn trước khi render label
              if (!option.label) return "";
              return `${option.label} (${option.email})`;
            }}
            value={selectedEmails} // State này giờ là một mảng: ["mail1@gmail.com", "mail2@gmail.com"]
            onChange={(_, newValue) => setSelectedEmails(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="Các Drive lưu trữ" />
            )}
          />

          {/* PHẦN 3: LỊCH TRÌNH */}
          <Box>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: "bold" }}
            >
              <ScheduleIcon /> 3. Cấu hình lịch trình
            </Typography>

            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  label="Lặp lại mỗi"
                  type="number"
                  size="small"
                  sx={{ width: 120 }}
                  value={schedule.interval}
                  onChange={(e) => setSchedule({ ...schedule, interval: e.target.value })}
                />

                <TextField
                  select
                  label="Đơn vị"
                  size="small"
                  sx={{ width: 120 }}
                  value={schedule.type}
                  onChange={(e) => setSchedule({ ...schedule, type: e.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="minute">Phút (Để Test)</option>
                  <option value="hour">Giờ</option>
                  <option value="day">Ngày</option>
                </TextField>

                {schedule.type === "day" && (
                  <TextField
                    label="Vào lúc"
                    type="time"
                    size="small"
                    sx={{ width: 150 }}
                    value={schedule.time}
                    onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary">
                {schedule.type === "day"
                  ? `Hệ thống sẽ backup ${schedule.interval} ngày một lần, vào lúc ${schedule.time}.`
                  : `Hệ thống sẽ tự động backup cứ sau mỗi ${schedule.interval} ${schedule.type === 'minute' ? 'phút' : 'giờ'}.`}
              </Typography>
            </Stack>
          </Box>

          {/* NÚT ĐIỀU KHIỂN */}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              color="error"
              size="large"
              fullWidth
              onClick={handleStopAllTasks}
            >
              Dừng tất cả
            </Button>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleSaveConfig}
              disabled={!selectedServer || selectedDBs.length === 0 || selectedEmails.length === 0}
              sx={{ bgcolor: "#1976d2", "&:hover": { bgcolor: "#1565c0" } }}
            >
              Lưu & Kích hoạt
            </Button>
          </Stack>

          {/* TRỰC QUAN HÓA CHU TRÌNH */}
          {activeTasks.length > 0 && (
            <Box sx={{ mt: 4, p: 2, bgcolor: "#f5f5f5", borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ScheduleIcon color="primary" /> Các chu trình đang hoạt động
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                {activeTasks.map((task) => (
                  <Paper key={task.id} elevation={1} sx={{ p: 2, borderLeft: "4px solid #4caf50" }}>
                    <Typography variant="subtitle2" color="primary">
                      🌐 Server: {task.server?.server} ({task.server?.dbType})
                    </Typography>
                    <Typography variant="body2">
                      🗄️ Databases: <b>{task.databases.join(", ")}</b>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ⏱️ Tần suất: {task.schedule.interval} {task.schedule.type === 'minute' ? 'phút' : 'giờ'}/lần
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};
