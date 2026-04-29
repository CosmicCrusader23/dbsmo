from browser_harness import *

def check(name, condition):
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")

tests = [
    ("T5 - Admin sets list", "http://localhost:3000/admin/sets", "Problem sets"),
    ("T9 - Analytics overview", "http://localhost:3000/admin/analytics", "Analytics"),
    ("T10 - Student list page", "http://localhost:3000/admin/students", "Students"),
    ("T13 - CSV Export API (Attempts)", "http://localhost:3000/api/admin/export?type=attempts", ""),
    ("T13 - CSV Export API (Students)", "http://localhost:3000/api/admin/export?type=students", ""),
    ("T14 - Sidebar links", "http://localhost:3000/", "Analytics")
]

for name, url, text in tests:
    print(f"\nRunning {name}")
    if "api/admin/export" in url:
        resp = http_get(url)
        check("Returns 200", resp.status_code == 200)
    else:
        goto_url(url)
        wait_for_load()
        page_text = js("document.body.innerText")
        check("Page loads correctly", text in page_text or "No problem sets" in page_text or "No students" in page_text)

