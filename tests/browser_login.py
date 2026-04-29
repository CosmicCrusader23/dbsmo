from browser_harness import *

print("Capturing login page")
goto_url("http://localhost:3000/api/auth/signout")
wait_for_load()
try:
    js("document.querySelector('form').submit()")
    wait(1)
except Exception:
    pass

goto_url("http://localhost:3000/login")
wait_for_load()

# Test dark mode visual
js("document.documentElement.className = 'dark'")
wait(0.5)

capture_screenshot("login_screenshot.png")
print("Screenshot saved to login_screenshot.png")

# Now login and screenshot dashboard
click_at_xy(200, 200) # Ensure focus
js("""
Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Bypass')).click()
""")
wait_for_load()
wait(1)

js("document.documentElement.className = 'dark'")
wait(0.5)

capture_screenshot("dashboard_screenshot.png")
print("Screenshot saved to dashboard_screenshot.png")
