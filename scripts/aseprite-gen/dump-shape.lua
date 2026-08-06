local path = app.params["ref"]
local spr = app.open(path)
local img = spr.cels[1].image
local cel = spr.cels[1]
local W, H = spr.width, spr.height
local minX, maxX, minY, maxY = 9999, -1, 9999, -1
local rows = {}
for y = 0, H - 1 do rows[y] = {n = 0, lo = 9999, hi = -1} end
for it in img:pixels() do
  local px = it()
  if app.pixelColor.rgbaA(px) > 128 then
    local x = it.x + cel.position.x
    local y = it.y + cel.position.y
    if x < minX then minX = x end
    if x > maxX then maxX = x end
    if y < minY then minY = y end
    if y > maxY then maxY = y end
    local r = rows[y]
    if r then
      r.n = r.n + 1
      if x < r.lo then r.lo = x end
      if x > r.hi then r.hi = x end
    end
  end
end
print(string.format("CANVAS=%dx%d BBOX x:%d-%d y:%d-%d  W=%d H=%d", W, H, minX, maxX, minY, maxY, maxX-minX+1, maxY-minY+1))
for y = minY, maxY do
  local r = rows[y]
  if r.n > 0 then
    print(string.format("y=%2d  x:%2d-%2d  w=%2d  n=%d", y, r.lo, r.hi, r.hi-r.lo+1, r.n))
  end
end
