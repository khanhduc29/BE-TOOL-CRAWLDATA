"""
Tool Panel - Panel UI cho mỗi tool trong GUI.
Gồm: Config section, Threading controls, Log viewer.
"""

import customtkinter as ctk
from typing import Optional, Callable


LOG_COLORS = {
    "INFO": "#B0BEC5",
    "ERROR": "#EF5350",
    "WARNING": "#FFA726",
    "SUCCESS": "#66BB6A",
    "DEBUG": "#78909C",
}


class ToolPanel(ctk.CTkFrame):
    """Panel cho 1 tool: config, threading controls, log viewer."""

    def __init__(self, master, tool_name: str, tool_config: dict,
                 on_start: Callable, on_stop: Callable,
                 on_threads_change: Callable, **kwargs):
        super().__init__(master, **kwargs)

        self.tool_name = tool_name
        self.tool_config = tool_config
        self.on_start = on_start
        self.on_stop = on_stop
        self.on_threads_change = on_threads_change
        self._is_running = False

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)  # Log area expands

        self._build_header()
        self._build_controls()
        self._build_log_area()

    # ─── HEADER ───────────────────────────────────────────────
    def _build_header(self):
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=15, pady=(15, 5))
        header.grid_columnconfigure(1, weight=1)

        icon = self.tool_config.get("icon", "🔧")
        label = self.tool_config.get("label", self.tool_name)
        color = self.tool_config.get("color", "#4FC3F7")

        ctk.CTkLabel(
            header, text=f"{icon}  {label}",
            font=ctk.CTkFont(size=22, weight="bold"),
            text_color=color,
        ).grid(row=0, column=0, sticky="w")

        self.status_label = ctk.CTkLabel(
            header, text="● Stopped",
            font=ctk.CTkFont(size=13),
            text_color="#78909C",
        )
        self.status_label.grid(row=0, column=1, sticky="e", padx=(10, 0))

    # ─── CONTROLS ─────────────────────────────────────────────
    def _build_controls(self):
        control_frame = ctk.CTkFrame(self, fg_color="#1A1A2E", corner_radius=10)
        control_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=8)
        control_frame.grid_columnconfigure(3, weight=1)

        # Thread count
        ctk.CTkLabel(
            control_frame, text="Số luồng:",
            font=ctk.CTkFont(size=13),
        ).grid(row=0, column=0, padx=(15, 5), pady=12)

        self.thread_var = ctk.IntVar(value=self.tool_config.get("threads", 1))
        self.thread_slider = ctk.CTkSlider(
            control_frame,
            from_=1, to=10,
            number_of_steps=9,
            variable=self.thread_var,
            width=180,
            command=self._on_slider_change,
        )
        self.thread_slider.grid(row=0, column=1, padx=5, pady=12)

        self.thread_count_label = ctk.CTkLabel(
            control_frame,
            textvariable=self.thread_var,
            font=ctk.CTkFont(size=14, weight="bold"),
            width=30,
        )
        self.thread_count_label.grid(row=0, column=2, padx=5, pady=12)

        # Spacer
        ctk.CTkFrame(control_frame, fg_color="transparent", width=10).grid(row=0, column=3)

        # Poll interval
        ctk.CTkLabel(
            control_frame, text="Poll (s):",
            font=ctk.CTkFont(size=13),
        ).grid(row=0, column=4, padx=(10, 5), pady=12)

        self.poll_var = ctk.StringVar(value=str(self.tool_config.get("poll_interval", 50)))
        ctk.CTkEntry(
            control_frame,
            textvariable=self.poll_var,
            width=60,
            font=ctk.CTkFont(size=13),
        ).grid(row=0, column=5, padx=5, pady=12)

        # Buttons
        btn_frame = ctk.CTkFrame(control_frame, fg_color="transparent")
        btn_frame.grid(row=0, column=6, padx=15, pady=12)

        self.start_btn = ctk.CTkButton(
            btn_frame, text="▶ Start",
            fg_color="#2E7D32", hover_color="#388E3C",
            width=90, height=34,
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self._handle_start,
        )
        self.start_btn.pack(side="left", padx=4)

        self.stop_btn = ctk.CTkButton(
            btn_frame, text="■ Stop",
            fg_color="#C62828", hover_color="#D32F2F",
            width=90, height=34,
            font=ctk.CTkFont(size=13, weight="bold"),
            command=self._handle_stop,
            state="disabled",
        )
        self.stop_btn.pack(side="left", padx=4)

    # ─── LOG AREA ─────────────────────────────────────────────
    def _build_log_area(self):
        log_frame = ctk.CTkFrame(self, fg_color="#0D1117", corner_radius=10)
        log_frame.grid(row=2, column=0, sticky="nsew", padx=15, pady=(5, 15))
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)

        # Log toolbar
        toolbar = ctk.CTkFrame(log_frame, fg_color="transparent", height=35)
        toolbar.grid(row=0, column=0, sticky="ew", padx=10, pady=(8, 2))

        ctk.CTkLabel(
            toolbar, text="📋 Logs",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#4FC3F7",
        ).pack(side="left")

        self.log_count_label = ctk.CTkLabel(
            toolbar, text="0 entries",
            font=ctk.CTkFont(size=11),
            text_color="#546E7A",
        )
        self.log_count_label.pack(side="left", padx=10)

        ctk.CTkButton(
            toolbar, text="🗑 Clear",
            width=70, height=26,
            fg_color="#37474F", hover_color="#455A64",
            font=ctk.CTkFont(size=11),
            command=self._clear_logs,
        ).pack(side="right", padx=4)

        ctk.CTkButton(
            toolbar, text="📥 Export",
            width=70, height=26,
            fg_color="#37474F", hover_color="#455A64",
            font=ctk.CTkFont(size=11),
            command=self._export_logs,
        ).pack(side="right", padx=4)

        # Auto-scroll checkbox
        self.auto_scroll_var = ctk.BooleanVar(value=True)
        ctk.CTkCheckBox(
            toolbar, text="Auto-scroll",
            variable=self.auto_scroll_var,
            font=ctk.CTkFont(size=11),
            width=30, height=20,
            checkbox_width=16, checkbox_height=16,
        ).pack(side="right", padx=10)

        # Log textbox
        self.log_text = ctk.CTkTextbox(
            log_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#0D1117",
            text_color="#B0BEC5",
            wrap="word",
            state="disabled",
            corner_radius=0,
        )
        self.log_text.grid(row=1, column=0, sticky="nsew", padx=5, pady=(2, 8))

        # Configure tags for log colors
        for level, color in LOG_COLORS.items():
            self.log_text._textbox.tag_configure(level, foreground=color)

        self._log_count = 0

    # ─── HANDLERS ─────────────────────────────────────────────

    def _on_slider_change(self, value):
        int_val = int(value)
        self.thread_var.set(int_val)
        self.on_threads_change(self.tool_name, int_val)

    def _handle_start(self):
        self._is_running = True
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal")
        self.thread_slider.configure(state="disabled")
        self.status_label.configure(text="● Running", text_color="#66BB6A")
        self.on_start(self.tool_name)

    def _handle_stop(self):
        self._is_running = False
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled")
        self.thread_slider.configure(state="normal")
        self.status_label.configure(text="● Stopped", text_color="#78909C")
        self.on_stop(self.tool_name)

    def append_log(self, entry: dict):
        """Thêm dòng log vào textbox (gọi từ GUI thread)."""
        level = entry.get("level", "INFO")
        time_str = entry.get("time", "")
        msg = entry.get("msg", "")
        line = f"[{time_str}] [{level}] {msg}\n"

        self.log_text.configure(state="normal")
        self.log_text._textbox.insert("end", line, level)
        self.log_text.configure(state="disabled")

        self._log_count += 1
        self.log_count_label.configure(text=f"{self._log_count} entries")

        if self.auto_scroll_var.get():
            self.log_text.see("end")

    def _clear_logs(self):
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")
        self._log_count = 0
        self.log_count_label.configure(text="0 entries")

    def _export_logs(self):
        """Export logs to file."""
        import tkinter.filedialog as fd
        path = fd.asksaveasfilename(
            defaultextension=".log",
            filetypes=[("Log files", "*.log"), ("Text files", "*.txt")],
            initialfile=f"{self.tool_name}_log.txt",
        )
        if path:
            try:
                self.log_text.configure(state="normal")
                content = self.log_text.get("1.0", "end")
                self.log_text.configure(state="disabled")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
            except Exception:
                pass

    def update_status(self, status: str):
        """Cập nhật trạng thái hiển thị."""
        if status == "running":
            self.status_label.configure(text="● Running", text_color="#66BB6A")
        elif status == "error":
            self.status_label.configure(text="● Error", text_color="#EF5350")
        else:
            self.status_label.configure(text="● Stopped", text_color="#78909C")
