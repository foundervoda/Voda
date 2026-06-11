import math
import collections

filepath = "/Users/ayaanatalwar/.gemini/antigravity-ide/conversations/5ea8a98e-ec6e-42d4-b5c9-2d4a2214da52.pb"

with open(filepath, "rb") as f:
    data = f.read()

counter = collections.Counter(data)
entropy = 0.0
for val in counter.values():
    p = val / len(data)
    entropy -= p * math.log2(p)

print("Entropy:", entropy)
print("Most common bytes:", counter.most_common(10))

# Print first 200 bytes as integers
print("First 50 bytes:", list(data[:50]))
