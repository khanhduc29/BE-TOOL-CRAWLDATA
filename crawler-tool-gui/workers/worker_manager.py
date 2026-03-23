"""
Worker Manager - Quản lý spawn/stop worker processes với multi-threading.
Hỗ trợ chạy N threads song song cho mỗi tool.
"""

import os
import sys
import subprocess
import threading
import time
from typing import Dict, List, Optional, Callable
from gui.log_manager import ToolLogger

# ── Tính PROJECT_ROOT (thư mục electron-tool) ──
# Khi chạy bình thường: __file__ = .../crawler-tool-gui/workers/worker_manager.py
# Khi chạy PyInstaller:  __file__ nằm trong _internal, nhưng config.json
#   vẫn được resolve qua app.py cùng cấp.
# Ta cần thư mục chứa config.json = crawler-tool-gui
def _get_config_dir():
    """Trả về thư mục tương đương crawler-tool-gui (nơi relative paths trong config.json có nghĩa)."""
    if getattr(sys, 'frozen', False):
        # PyInstaller: sys.executable = .../crawler-tool-gui/dist/CrawlerTool/CrawlerTool.exe
        # worker_path trong config.json relative tới crawler-tool-gui/
        # Từ dist/CrawlerTool/ lên 2 cấp = crawler-tool-gui/
        return os.path.dirname(os.path.dirname(os.path.dirname(sys.executable)))
    else:
        # Dev: file này = crawler-tool-gui/workers/worker_manager.py
        # Lên 2 cấp = crawler-tool-gui/
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONFIG_DIR = _get_config_dir()


class WorkerThread:
    """Đại diện cho 1 thread chạy worker process."""

    def __init__(self, tool_name: str, thread_id: int, worker_type: str,
                 worker_path: str, logger: ToolLogger, api_base_url: str = "http://localhost:3000",
                 worker_id: str = "", extra_env: dict = None):
        self.tool_name = tool_name
        self.thread_id = thread_id
        self.worker_type = worker_type
        self.worker_path = worker_path
        self.logger = logger
        self.api_base_url = api_base_url
        self.worker_id = worker_id
        self.extra_env = extra_env or {}

        self.process: Optional[subprocess.Popen] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.status = "stopped"  # stopped, running, error

    def start(self):
        """Start worker trong thread riêng."""
        if self.status == "running":
            return

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_worker,
            daemon=True,
            name=f"{self.tool_name}-thread-{self.thread_id}"
        )
        self._thread.start()
        self.status = "running"
        self.logger.info(f"Thread #{self.thread_id} started")

    def stop(self):
        """Stop worker process."""
        self._stop_event.set()
        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            except Exception:
                pass
        self.status = "stopped"
        self.logger.info(f"Thread #{self.thread_id} stopped")

    def _run_worker(self):
        """Chạy worker process và stream output."""
        try:
            # Resolve worker_path relative tới CONFIG_DIR (crawler-tool-gui)
            abs_path = os.path.normpath(os.path.join(CONFIG_DIR, self.worker_path))
            cwd = os.path.dirname(abs_path)

            env = os.environ.copy()
            env["PYTHONIOENCODING"] = "utf-8"
            env["API_BASE_URL"] = self.api_base_url

            # Pass worker_id for multi-server task assignment
            actual_worker_id = self.worker_id or f"{self.tool_name}-{self.thread_id}"
            env["WORKER_ID"] = actual_worker_id

            # Pass extra env (e.g. YOUTUBE_API_KEY)
            for k, v in self.extra_env.items():
                if v:
                    env[k] = v

            if self.worker_type == "python":
                if getattr(sys, 'frozen', False):
                    # PyInstaller: sys.executable = CrawlerTool.exe, dùng python hệ thống
                    import shutil
                    python_exe = shutil.which("python") or shutil.which("python3") or "python"
                    cmd = [python_exe, abs_path]
                else:
                    cmd = [sys.executable, abs_path]
            elif self.worker_type == "node":
                cmd = ["node", abs_path]
            else:
                self.logger.error(f"Unknown worker_type: {self.worker_type}")
                self.status = "error"
                return

            self.logger.info(f"Thread #{self.thread_id} launching: {' '.join(cmd)}")

            self.process = subprocess.Popen(
                cmd,
                cwd=cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )

            # Stream stdout in realtime
            def read_stdout():
                try:
                    for line in self.process.stdout:
                        line = line.rstrip()
                        if line:
                            self.logger.info(f"[T{self.thread_id}] {line}")
                        if self._stop_event.is_set():
                            break
                except Exception:
                    pass

            def read_stderr():
                try:
                    for line in self.process.stderr:
                        line = line.rstrip()
                        if line:
                            self.logger.error(f"[T{self.thread_id}] {line}")
                        if self._stop_event.is_set():
                            break
                except Exception:
                    pass

            stdout_thread = threading.Thread(target=read_stdout, daemon=True)
            stderr_thread = threading.Thread(target=read_stderr, daemon=True)
            stdout_thread.start()
            stderr_thread.start()

            # Wait for process to exit or stop event
            while not self._stop_event.is_set():
                retcode = self.process.poll()
                if retcode is not None:
                    if retcode == 0:
                        self.logger.info(f"Thread #{self.thread_id} exited normally")
                    else:
                        self.logger.error(f"Thread #{self.thread_id} exited with code {retcode}")
                    break
                time.sleep(0.5)

        except Exception as e:
            self.logger.error(f"Thread #{self.thread_id} error: {e}")
            self.status = "error"
        finally:
            if not self._stop_event.is_set():
                self.status = "stopped"


class ToolWorkerManager:
    """Quản lý multiple threads cho 1 tool."""

    def __init__(self, tool_name: str, tool_config: dict, logger: ToolLogger):
        self.tool_name = tool_name
        self.config = tool_config
        self.logger = logger
        self.threads: List[WorkerThread] = []
        self.max_threads = tool_config.get("threads", 1)
        self._on_status_change: Optional[Callable] = None

    def set_status_callback(self, callback: Callable):
        self._on_status_change = callback

    def set_thread_count(self, count: int):
        """Thay đổi số luồng (chỉ áp dụng khi restart)."""
        self.max_threads = max(1, min(count, 10))
        self.config["threads"] = self.max_threads

    def start_all(self, api_base_url: str = "http://localhost:3000"):
        """Start tất cả threads."""
        # Stop hiện tại
        self.stop_all()
        self.threads.clear()

        worker_type = self.config.get("worker_type", "python")
        worker_path = self.config.get("worker_path", "")

        self.logger.success(f"Starting {self.max_threads} thread(s)...")

        worker_id = self.config.get("worker_id", "")
        extra_env = {}
        if self.config.get("api_key"):
            extra_env["YOUTUBE_API_KEY"] = self.config["api_key"]

        for i in range(self.max_threads):
            # Auto-generate worker_id if not set: tool_name-thread_id
            wid = worker_id or f"{self.tool_name}-{i + 1}"
            wt = WorkerThread(
                tool_name=self.tool_name,
                thread_id=i + 1,
                worker_type=worker_type,
                worker_path=worker_path,
                logger=self.logger,
                api_base_url=api_base_url,
                worker_id=wid,
                extra_env=extra_env,
            )
            wt.start()
            self.threads.append(wt)

        if self._on_status_change:
            self._on_status_change("running")

    def stop_all(self):
        """Stop tất cả threads."""
        for wt in self.threads:
            wt.stop()
        self.logger.warning("All threads stopped")
        if self._on_status_change:
            self._on_status_change("stopped")

    def get_status(self) -> dict:
        running = sum(1 for t in self.threads if t.status == "running")
        return {
            "total": len(self.threads),
            "running": running,
            "max": self.max_threads,
        }


class WorkerManagerHub:
    """Hub quản lý tất cả ToolWorkerManagers."""

    def __init__(self, tools_config: dict, log_manager):
        self.managers: Dict[str, ToolWorkerManager] = {}
        self.log_manager = log_manager

        for tool_name, tool_cfg in tools_config.items():
            logger = log_manager.get_logger(tool_name)
            self.managers[tool_name] = ToolWorkerManager(tool_name, tool_cfg, logger)

    def get_manager(self, tool_name: str) -> Optional[ToolWorkerManager]:
        return self.managers.get(tool_name)

    def start_tool(self, tool_name: str, api_base_url: str = "http://localhost:3000"):
        mgr = self.managers.get(tool_name)
        if mgr:
            mgr.start_all(api_base_url)

    def stop_tool(self, tool_name: str):
        mgr = self.managers.get(tool_name)
        if mgr:
            mgr.stop_all()

    def stop_all(self):
        for mgr in self.managers.values():
            mgr.stop_all()
