local path = app.params["ref"]
local spr = app.open(path)
local cel = spr.cels[1]
local img = cel.image
local ox, oy = cel.position.x, cel.position.y
-- brightness -> glyph ramp
local ramp = {" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"}
local grid = {}
for y = 0, spr.height-1 do
  grid[y] = {}
  for x = 0, spr.width-1 do grid[y][x] = " " end
end
for it in img:pixels() do
  local px = it()
  local a = app.pixelColor.rgbaA(px)
  local x, y = it.x + ox, it.y + oy
  if a > 100 and grid[y] then
    local r = app.pixelColor.rgbaR(px)
    local g = app.pixelColor.rgbaG(px)
    local b = app.pixelColor.rgbaB(px)
    local lum = (0.299*r + 0.587*g + 0.114*b) / 255
    local idx = math.max(1, math.min(#ramp, math.floor(lum * (#ramp-1)) + 1))
    grid[y][x] = ramp[idx]
  end
end
local x0, x1 = tonumber(app.params["x0"]), tonumber(app.params["x1"])
local y0, y1 = tonumber(app.params["y0"]), tonumber(app.params["y1"])
for y = y0, y1 do
  local line = ""
  for x = x0, x1 do line = line .. grid[y][x] end
  print(string.format("%2d|%s|", y, line))
end
