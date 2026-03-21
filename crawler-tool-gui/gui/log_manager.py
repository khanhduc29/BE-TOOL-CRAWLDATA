"""
Log Manager - Thread-safe per-tool logging with GUI integration.
Mỗi tool có logger riêng, ghi ra file + hiển thị trên GUI qua Queue.
"""

import os
import logging
import datetime
from queue import Queue
from typing import Dict, Optional, Callable


class ToolLogger:
    """Logger riêng cho mỗi tool, thread-safe."""

    def __init__(self, tool_name: str, log_dir: str = "./logs"):
        self.tool_name = tool_name
        self.log_dir = log_dir
        self.queue: Queue = Queue()
        self._callbacks: list[Callable] = []

        os.makedirs(log_dir, exist_ok=True)

        # File logger
        self.logger = logging.getLogger(f"crawler.{tool_name}")
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers.clear()

        # File handler
        log_file = os.path.join(log_dir, f"{tool_name}.log")
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.DEBUG)
        fmt = logging.Formatter("[%(asctime)s] %(levelname)s — %(message)s", datefmt="%H:%M:%S")
        fh.setFormatter(fmt)
        self.logger.addHandler(fh)

    def on_log(self, callback: Callable):
        """Đăng ký callback nhận log message (GUI sẽ dùng)."""
        self._callbacks.append(callback)

    def _emit(self, level: str, msg: str):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        entry = {"time": timestamp, "level": level, "msg": msg, "tool": self.tool_name}
        self.queue.put(entry)
        for cb in self._callbacks:
            try:
                cb(entry)
            except Exception:
                pass

    def info(self, msg: str):
        self.logger.info(msg)
        self._emit("INFO", msg)

    def error(self, msg: str):
        self.logger.error(msg)
        self._emit("ERROR", msg)

    def warning(self, msg: str):
        self.logger.warning(msg)
        self._emit("WARNING", msg)

    def success(self, msg: str):
        self.logger.info(f"[SUCCESS] {msg}")
        self._emit("SUCCESS", msg)

    def debug(self, msg: str):
        self.logger.debug(msg)
        self._emit("DEBUG", msg)

    def clear_file(self):
        """Xóa nội dung file log."""
        log_file = os.path.join(self.log_dir, f"{self.tool_name}.log")
        try:
            open(log_file, "w").close()
        except Exception:
            pass

    def get_log_path(self) -> str:
        return os.path.join(self.log_dir, f"{self.tool_name}.log")


class LogManager:
    """Quản lý tất cả ToolLoggers."""

    def __init__(self, log_dir: str = "./logs"):
        self.log_dir = log_dir
        self._loggers: Dict[str, ToolLogger] = {}

    def get_logger(self, tool_name: str) -> ToolLogger:
        if tool_name not in self._loggers:
            self._loggers[tool_name] = ToolLogger(tool_name, self.log_dir)
        return self._loggers[tool_name]

    def clear_all(self):
        for logger in self._loggers.values():
            logger.clear_file()
