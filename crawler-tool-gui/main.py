"""
Crawler Tool GUI - CustomTkinter Desktop Application
Quản lý 8 tools crawler với log riêng biệt và cấu hình multi-threading.
"""

import customtkinter as ctk
from gui.app import CrawlerToolApp


def main():
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")

    app = CrawlerToolApp()
    app.mainloop()


if __name__ == "__main__":
    main()
