-- Composites up to three same-size layer sheets (body/armor/weapon) on top of each other,
-- scales the result up with nearest-neighbour, and drops it on a checkerboard so transparency
-- is visible. Used only to produce human-viewable previews of generated sheets; not part of the
-- generation pipeline itself.
local scale = tonumber(app.params["scale"] or "5")
local paths = {}
for _, key in ipairs({ "l1", "l2", "l3" }) do
  if app.params[key] and app.params[key] ~= "" then table.insert(paths, app.params[key]) end
end

local first = app.open(paths[1])
local w, h = first.width, first.height
local merged = Image(w, h, ColorMode.RGB)

for _, p in ipairs(paths) do
  local s = app.open(p)
  local im = Image(w, h, ColorMode.RGB)
  im:drawSprite(s, 1)
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local px = im:getPixel(x, y)
      if app.pixelColor.rgbaA(px) > 20 then merged:putPixel(x, y, px) end
    end
  end
  s:close()
end

local dst = Sprite(w * scale, h * scale, ColorMode.RGB)
local img = dst.cels[1].image
for y = 0, dst.height - 1 do
  for x = 0, dst.width - 1 do
    local c = (math.floor(x / (8 * scale / 5)) + math.floor(y / (8 * scale / 5))) % 2 == 0 and 0x2C or 0x34
    img:putPixel(x, y, app.pixelColor.rgba(c, c, c, 255))
  end
end
for y = 0, h - 1 do
  for x = 0, w - 1 do
    local px = merged:getPixel(x, y)
    if app.pixelColor.rgbaA(px) > 20 then
      for dy = 0, scale - 1 do
        for dx = 0, scale - 1 do
          img:putPixel(x * scale + dx, y * scale + dy, px)
        end
      end
    end
  end
end
dst:saveCopyAs(app.params["out"])
print("ok " .. app.params["out"])
