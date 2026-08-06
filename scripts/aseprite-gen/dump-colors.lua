local path = app.params["ref"]
local spr = app.open(path)
if not spr then print("FAILED TO OPEN") return end
local img = spr.cels[1].image
local counts = {}
local total = 0
for it in img:pixels() do
  local px = it()
  local a = app.pixelColor.rgbaA(px)
  if a > 128 then
    local r = app.pixelColor.rgbaR(px)
    local g = app.pixelColor.rgbaG(px)
    local b = app.pixelColor.rgbaB(px)
    local key = string.format("#%02X%02X%02X", r, g, b)
    counts[key] = (counts[key] or 0) + 1
    total = total + 1
  end
end
local arr = {}
for k, v in pairs(counts) do table.insert(arr, {c = k, n = v}) end
table.sort(arr, function(x, y) return x.n > y.n end)
print("TOTAL_OPAQUE=" .. total)
for i = 1, math.min(#arr, 24) do
  print(string.format("%s %d %.1f%%", arr[i].c, arr[i].n, arr[i].n / total * 100))
end
