from browser_harness import *

print("Running Auth Button Check")
goto_url("http://localhost:3000/")
wait_for_load()

page_text = js("document.body.innerText")
if "Sign in with Google" in page_text:
    print("[PASS] Found 'Sign in with Google' button")
else:
    print("[FAIL] 'Sign in with Google' button not found")

capture_screenshot("auth_screenshot.png")
print("Screenshot saved to auth_screenshot.png")
