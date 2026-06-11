import os

conversations_dir = "/Users/ayaanatalwar/.gemini/antigravity-ide/conversations"
filename = "71dd64f4-a4d0-42a4-ab90-cc7138e079cd.pb"
filepath = os.path.join(conversations_dir, filename)

try:
    with open(filepath, "rb") as f:
        header = f.read(200)
        print("Header:", header)
        
        # Check size
        f.seek(0, 2)
        print("Size:", f.tell())
except Exception as e:
    print("Error:", e)
