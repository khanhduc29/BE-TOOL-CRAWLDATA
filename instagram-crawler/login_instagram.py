from playwright.sync_api import sync_playwright


def login():

    with sync_playwright() as p:

        context = p.chromium.launch_persistent_context(
            user_data_dir="./insta_session",
            headless=False
        )

        page = context.new_page()

        page.goto("https://www.instagram.com/accounts/login/")

        print("👉 Hãy đăng nhập Instagram trong cửa sổ browser")

        input("Sau khi login xong nhấn ENTER...")

        context.close()


if __name__ == "__main__":
    login()