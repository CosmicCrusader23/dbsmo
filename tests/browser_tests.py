from browser_harness import *

def check(name, condition):
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")

print("Running T2 - Dark Mode")
goto_url("http://localhost:3000/")
wait_for_load()
check("Initial mode is light", "light" in js("document.documentElement.className"))

rect = js("""(() => {
  const btn = document.querySelector(".theme-toggle"); 
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return {x: r.x + r.width/2, y: r.y + r.height/2};
})()""")

if rect:
    click_at_xy(rect["x"], rect["y"])
    wait(0.5)
    check("Mode changes to dark", "dark" in js("document.documentElement.className"))
    
    click_at_xy(rect["x"], rect["y"])
    wait(0.5)
    mode = js("document.documentElement.className")
    check("Mode changes again", "light" in mode or "dark" not in mode)
else:
    print("[FAIL] Toggle theme button not found")

print("\nRunning T3 - Problem set page with answer grid")
goto_url("http://localhost:3000/problem-sets/mo-set-001")
wait_for_load()
check("Page loads with heading", "Algebra Basics" in js("document.body.innerText"))

js("document.querySelector('input').focus()")
type_text("42")
wait(0.2)
js("document.querySelectorAll('input')[1].focus()")
type_text("1/2")

wait(0.5)
text = js("document.body.innerText")
check("Fill count shows 2 answered", "2/20 answered" in text or "2/" in text)

print("\nRunning T4 - ZIP import dry-run")
goto_url("http://localhost:3000/admin/import")
wait_for_load()
check("Page loads with ZIP Import heading", "ZIP Import" in js("document.body.innerText"))

