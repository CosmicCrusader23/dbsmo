import os

from browser_harness import *


BASE_URL = os.environ.get("BASE_URL", "http://localhost:3001")


def check(name, condition):
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")
    if not condition:
        raise AssertionError(name)


new_tab(BASE_URL)
wait_for_load()
check("landing or dashboard loads", "DBS" in js("document.body.innerText"))

login = js(
    """
(async () => {
  const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    role: "ADMIN",
    callbackUrl: "/dashboard",
    json: "true",
  });
  const response = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return response.status;
})()
"""
)
check("admin dev login succeeds", login == 200)

for path, expected in [
    ("/dashboard", "Training Dashboard"),
    ("/problem-sets", "Problem Sets"),
    ("/admin/analytics", "Analytics overview"),
    ("/admin/import", "JSON Import"),
    ("/settings", "Settings"),
]:
    new_tab(f"{BASE_URL}{path}")
    wait_for_load()
    check(f"{path} loads", expected in js("document.body.innerText"))

new_tab(f"{BASE_URL}/dashboard")
wait_for_load()
dashboard_text = js("document.body.innerText")
check(
    "dashboard shows next-step zone",
    "today" in dashboard_text.lower() and "next step" in dashboard_text.lower(),
)

new_tab(f"{BASE_URL}/problem-sets?status=not-started&media=all&sort=latest")
wait_for_load()
problem_sets_text = js("document.body.innerText")
check(
    "problem-set discovery filters render",
    "status" in problem_sets_text.lower()
    and "media" in problem_sets_text.lower()
    and "latest" in problem_sets_text.lower(),
)
check("problem-set filters persist in URL", "status=not-started" in js("location.href"))

new_tab(f"{BASE_URL}/admin/analytics")
wait_for_load()
analytics_text = js("document.body.innerText")
check(
    "analytics decision metrics render",
    "first attempt avg" in analytics_text.lower()
    and "best attempt avg" in analytics_text.lower()
    and "suspicious answer keys" in analytics_text.lower(),
)

new_tab(f"{BASE_URL}/admin/sets")
wait_for_load()
set_export = js(
    """
const link = document.querySelector('a[href*="/api/admin/sets/"][href$="/export"]');
return link ? link.href : null;
"""
)
check("admin set JSON export link renders", bool(set_export))
set_export_response = js(
    """
(async () => {
  const link = document.querySelector('a[href*="/api/admin/sets/"][href$="/export"]');
  if (!link) return { status: 0, type: "", hasPayload: false };
  const response = await fetch(link.href);
  const text = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    hasPayload: text.includes('"slug"') && text.includes('"problems"'),
  };
})()
"""
)
check(
    "admin set JSON export works",
    set_export_response["status"] == 200
    and "application/json" in set_export_response["type"]
    and set_export_response["hasPayload"],
)

new_tab(f"{BASE_URL}/settings")
wait_for_load()
wait(0.5)
settings_text = js("document.body.innerText")
check(
    "settings training stats render",
    "Sets tried" in settings_text and "Practice" in settings_text and "Attempts" in settings_text,
)

new_tab(f"{BASE_URL}/users/bypass-admin")
wait_for_load()
profile_text = js("document.body.innerText")
check(
    "profile training sections render",
    "Strongest topics" in profile_text
    and "Recent completions" in profile_text
    and "Bookmarked sets" in profile_text,
)

new_tab(f"{BASE_URL}/problem-sets?status=not-started")
wait_for_load()
problem_href = js(
    """
const link = [...document.links].find((anchor) => {
  const path = new URL(anchor.href).pathname;
  return /^\\/problem-sets\\/[^/]+$/.test(path);
});
return link ? link.href : null;
"""
)
if not problem_href:
    new_tab(f"{BASE_URL}/problem-sets")
    wait_for_load()
    problem_href = js(
        """
const link = [...document.links].find((anchor) => {
  const path = new URL(anchor.href).pathname;
  return /^\\/problem-sets\\/[^/]+$/.test(path);
});
return link ? link.href : null;
"""
    )
check("problem set page link found", bool(problem_href))

new_tab(problem_href)
wait_for_load()
problem_text = js("document.body.innerText")
if "Perfect score already recorded" not in problem_text and "Submit" in problem_text:
    js(
        """
const input = document.querySelector('input[name="answer-1"]');
if (input) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, "wrong");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
"""
    )
    wait(0.3)
    js(
        """
const submit = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Submit"));
if (submit) submit.click();
"""
    )
    wait(2.0)
    coaching_text = js("document.body.innerText")
    check(
        "post-submit coaching renders",
        "next step" in coaching_text.lower() and "review later" in coaching_text.lower(),
    )
else:
    check("problem set page available for coaching", "Perfect score already recorded" in problem_text)

api = js(
    """
(async () => {
  const exportResponse = await fetch("/api/admin/export?type=students");
  return {
    exportStatus: exportResponse.status,
    exportType: exportResponse.headers.get("content-type") || "",
  };
})()
"""
)
check("students CSV export works", api["exportStatus"] == 200 and "text/csv" in api["exportType"])
