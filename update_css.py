import re

with open('app/globals.css', 'r') as f:
    content = f.read()

# Replace all linear-gradient and radial-gradient with solid colors or the bg image
# Actually, let's just replace the specific gradient declarations.
content = re.sub(r'linear-gradient\([^)]+\)', '#ffffff', content)
content = re.sub(r'radial-gradient\([^)]+\)', 'transparent', content)

# But wait, --sidebar-bg should be a solid color
content = content.replace('var(--color-bg)', 'url("https://colorfulstage.com/img/bg_lottie_pc.jpg") center/cover fixed')

with open('app/globals.css', 'w') as f:
    f.write(content)
