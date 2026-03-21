"""
Crawler Tool App - Main CustomTkinter Application.
Giao diện chính: sidebar 8 tools + main area hiển thị tool panel.
"""

import json
import os
import customtkinter as ctk
from typing import Dict
from gui.tool_panel import ToolPanel
from gui.log_manager import LogManager
from workers.worker_manager import WorkerManagerHub


CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.json")


class SidebarToolButton(ctk.CTkButton):
    """Button cho mỗi tool trong sidebar."""

    def __init__(self, master, tool_name: str, tool_config: dict, command=None, **kwargs):
        icon = tool_config.get("icon", "🔧")
        label = tool_config.get("label", tool_name)
        color = tool_config.get("color", "#4FC3F7")

        super().__init__(
            master,
            text=f" {icon}  {label}",
            anchor="w",
            font=ctk.CTkFont(size=14),
            fg_color="transparent",
            text_color="#B0BEC5",
            hover_color="#1E293B",
            height=42,
            corner_radius=8,
            command=command,
            **kwargs,
        )
        self.tool_name = tool_name
        self.color = color
        self._active = False

        # Status indicator
        self.status_color = "#546E7A"  # default = stopped gray

    def set_active(self, active: bool):
        self._active = active
        if active:
            self.configure(fg_color="#1E293B", text_color="#FFFFFF")
        else:
            self.configure(fg_color="transparent", text_color="#B0BEC5")

    def set_running(self, running: bool):
        if running:
            self.status_color = "#66BB6A"
        else:
            self.status_color = "#546E7A"


class CrawlerToolApp(ctk.CTk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        # ─── Window Setup ────────────────────────────────────
        self.title("🛠 Crawler Tool Manager")
        self.geometry("1280x820")
        self.minsize(1000, 650)

        # ─── Load Config ─────────────────────────────────────
        self.config = self._load_config()
        all_tools = self.config.get("tools", {})
        # Chỉ giữ tools có enabled=True
        self.tools_config = {k: v for k, v in all_tools.items() if v.get("enabled", True)}
        self.api_base_url = self.config.get("api_base_url", "http://localhost:3000")

        # ─── Managers ────────────────────────────────────────
        log_dir = self.config.get("log_dir", "./logs")
        self.log_manager = LogManager(log_dir)
        self.worker_hub = WorkerManagerHub(self.tools_config, self.log_manager)

        # ─── UI State ────────────────────────────────────────
        self.sidebar_buttons: Dict[str, SidebarToolButton] = {}
        self.tool_panels: Dict[str, ToolPanel] = {}
        self.current_tool: str = ""

        # ─── Build Layout ────────────────────────────────────
        self._pending_logs = []

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self._build_main_area()

        # ─── Wire up log callbacks ───────────────────────────
        for tool_name in self.tools_config:
            logger = self.log_manager.get_logger(tool_name)
            # Use after() to marshal log entries to GUI thread
            logger.on_log(lambda entry, tn=tool_name: self._schedule_log(tn, entry))

        # ─── Select first tool ───────────────────────────────
        if self.tools_config:
            first_tool = list(self.tools_config.keys())[0]
            self._select_tool(first_tool)

        # ─── Poll log queue ──────────────────────────────────
        self._poll_logs()

        # ─── On close: stop all workers ──────────────────────
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ═══════════════════════════════════════════════════════════
    # CONFIG
    # ═══════════════════════════════════════════════════════════

    def _load_config(self) -> dict:
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"tools": {}, "api_base_url": "http://localhost:3000", "log_dir": "./logs"}

    def _save_config(self):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def _save_api_url(self):
        """Lưu API Base URL từ entry vào config.json."""
        new_url = self.api_entry.get().strip()
        if not new_url:
            return
        self.api_base_url = new_url
        self.config["api_base_url"] = new_url
        self._save_config()
        # Visual feedback
        self.save_api_btn.configure(fg_color="#2E7D32", text="✅")
        self.after(1500, lambda: self.save_api_btn.configure(fg_color="#1E88E5", text="💾"))

    # ═══════════════════════════════════════════════════════════
    # SIDEBAR
    # ═══════════════════════════════════════════════════════════

    def _build_sidebar(self):
        sidebar = ctk.CTkFrame(self, width=260, fg_color="#0F172A", corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_propagate(False)
        sidebar.grid_columnconfigure(0, weight=1)

        # ─── Logo / Title ────────────────────────────────────
        title_frame = ctk.CTkFrame(sidebar, fg_color="transparent", height=70)
        title_frame.grid(row=0, column=0, sticky="ew", padx=15, pady=(18, 5))
        title_frame.grid_propagate(False)

        ctk.CTkLabel(
            title_frame,
            text="🛠 Crawler Tools",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#4FC3F7",
        ).pack(anchor="w")

        ctk.CTkLabel(
            title_frame,
            text=f"Quản lý {len(self.tools_config)} tools · Multi-thread",
            font=ctk.CTkFont(size=11),
            text_color="#546E7A",
        ).pack(anchor="w", pady=(2, 0))

        # ─── Separator ───────────────────────────────────────
        ctk.CTkFrame(sidebar, height=1, fg_color="#1E293B").grid(
            row=1, column=0, sticky="ew", padx=15, pady=8
        )

        # ─── Tool Buttons ────────────────────────────────────
        tools_frame = ctk.CTkScrollableFrame(
            sidebar, fg_color="transparent", label_text=""
        )
        tools_frame.grid(row=2, column=0, sticky="nsew", padx=8, pady=2)
        sidebar.grid_rowconfigure(2, weight=1)

        for tool_name, tool_cfg in self.tools_config.items():
            btn = SidebarToolButton(
                tools_frame,
                tool_name=tool_name,
                tool_config=tool_cfg,
                command=lambda tn=tool_name: self._select_tool(tn),
            )
            btn.pack(fill="x", pady=2)
            self.sidebar_buttons[tool_name] = btn

        # ─── Bottom Controls ─────────────────────────────────
        bottom = ctk.CTkFrame(sidebar, fg_color="transparent", height=120)
        bottom.grid(row=3, column=0, sticky="ew", padx=15, pady=12)

        ctk.CTkFrame(bottom, height=1, fg_color="#1E293B").pack(fill="x", pady=(0, 10))

        # API URL
        ctk.CTkLabel(
            bottom, text="API Base URL:",
            font=ctk.CTkFont(size=11),
            text_color="#78909C",
        ).pack(anchor="w")

        api_row = ctk.CTkFrame(bottom, fg_color="transparent")
        api_row.pack(fill="x", pady=(2, 8))

        self.api_entry = ctk.CTkEntry(
            api_row,
            placeholder_text="http://localhost:3000",
            font=ctk.CTkFont(size=12),
            height=30,
        )
        self.api_entry.pack(side="left", fill="x", expand=True, padx=(0, 4))
        self.api_entry.insert(0, self.api_base_url)

        self.save_api_btn = ctk.CTkButton(
            api_row, text="💾",
            width=32, height=30,
            fg_color="#1E88E5", hover_color="#1976D2",
            font=ctk.CTkFont(size=14),
            command=self._save_api_url,
        )
        self.save_api_btn.pack(side="left")

        # Start All / Stop All
        btn_row = ctk.CTkFrame(bottom, fg_color="transparent")
        btn_row.pack(fill="x")

        ctk.CTkButton(
            btn_row, text="▶ Start All",
            fg_color="#2E7D32", hover_color="#388E3C",
            height=32, font=ctk.CTkFont(size=12, weight="bold"),
            command=self._start_all,
        ).pack(side="left", expand=True, fill="x", padx=(0, 4))

        ctk.CTkButton(
            btn_row, text="■ Stop All",
            fg_color="#C62828", hover_color="#D32F2F",
            height=32, font=ctk.CTkFont(size=12, weight="bold"),
            command=self._stop_all,
        ).pack(side="left", expand=True, fill="x", padx=(4, 0))

    # ═══════════════════════════════════════════════════════════
    # MAIN AREA
    # ═══════════════════════════════════════════════════════════

    def _build_main_area(self):
        self.main_container = ctk.CTkFrame(self, fg_color="#121829", corner_radius=0)
        self.main_container.grid(row=0, column=1, sticky="nsew")
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_rowconfigure(0, weight=1)

        # Create all tool panels (hidden by default)
        for tool_name, tool_cfg in self.tools_config.items():
            panel = ToolPanel(
                self.main_container,
                tool_name=tool_name,
                tool_config=tool_cfg,
                on_start=self._on_tool_start,
                on_stop=self._on_tool_stop,
                on_threads_change=self._on_threads_change,
                fg_color="#121829",
                corner_radius=0,
            )
            self.tool_panels[tool_name] = panel

    # ═══════════════════════════════════════════════════════════
    # TOOL SELECTION
    # ═══════════════════════════════════════════════════════════

    def _select_tool(self, tool_name: str):
        # Deactivate previous
        if self.current_tool and self.current_tool in self.sidebar_buttons:
            self.sidebar_buttons[self.current_tool].set_active(False)

        # Hide previous panel
        if self.current_tool and self.current_tool in self.tool_panels:
            self.tool_panels[self.current_tool].grid_forget()

        # Activate new
        self.current_tool = tool_name
        if tool_name in self.sidebar_buttons:
            self.sidebar_buttons[tool_name].set_active(True)

        # Show new panel
        if tool_name in self.tool_panels:
            self.tool_panels[tool_name].grid(row=0, column=0, sticky="nsew")

    # ═══════════════════════════════════════════════════════════
    # WORKER CONTROLS
    # ═══════════════════════════════════════════════════════════

    def _on_tool_start(self, tool_name: str):
        api_url = self.api_entry.get().strip() or self.api_base_url
        self.worker_hub.start_tool(tool_name, api_url)
        if tool_name in self.sidebar_buttons:
            self.sidebar_buttons[tool_name].set_running(True)

    def _on_tool_stop(self, tool_name: str):
        self.worker_hub.stop_tool(tool_name)
        if tool_name in self.sidebar_buttons:
            self.sidebar_buttons[tool_name].set_running(False)

    def _on_threads_change(self, tool_name: str, count: int):
        mgr = self.worker_hub.get_manager(tool_name)
        if mgr:
            mgr.set_thread_count(count)
        # Update config
        if tool_name in self.tools_config:
            self.tools_config[tool_name]["threads"] = count
            self._save_config()

    def _start_all(self):
        api_url = self.api_entry.get().strip() or self.api_base_url
        for tool_name in self.tools_config:
            if self.tools_config[tool_name].get("enabled", True):
                self.worker_hub.start_tool(tool_name, api_url)
                if tool_name in self.tool_panels:
                    self.tool_panels[tool_name]._handle_start()
                if tool_name in self.sidebar_buttons:
                    self.sidebar_buttons[tool_name].set_running(True)

    def _stop_all(self):
        self.worker_hub.stop_all()
        for tool_name in self.tools_config:
            if tool_name in self.tool_panels:
                self.tool_panels[tool_name]._handle_stop()
            if tool_name in self.sidebar_buttons:
                self.sidebar_buttons[tool_name].set_running(False)

    # ═══════════════════════════════════════════════════════════
    # LOG POLLING
    # ═══════════════════════════════════════════════════════════

    def _schedule_log(self, tool_name: str, entry: dict):
        """Thread-safe: schedule log entry to be appended in GUI thread."""
        self._pending_logs.append((tool_name, entry))

    def _poll_logs(self):
        """Consume pending log entries every 100ms."""
        batch = list(self._pending_logs)
        self._pending_logs.clear()

        for tool_name, entry in batch:
            panel = self.tool_panels.get(tool_name)
            if panel:
                try:
                    panel.append_log(entry)
                except Exception:
                    pass

        self.after(100, self._poll_logs)

    # ═══════════════════════════════════════════════════════════
    # CLEANUP
    # ═══════════════════════════════════════════════════════════

    def _on_close(self):
        self.worker_hub.stop_all()
        self._save_config()
        self.destroy()
