-- Side-by-side comparison sheet, scaled up for review.
local a = app.params["a"]
local b = app.params["b"]
local out = app.params["out"]
local scale = tonumber(app.params["scale"] or "4")

local sa = app.open(a)
local ia = Image(sa.width, sa.height, ColorMode.RGB)
ia:drawSprite(sa, 1)
local sb = app.open(b)
local ib = Image(sb.width, sb.height, ColorMode.RGB)
ib:drawSprite(sb, 1)

local W = (sa.width + sb.width) * scale
local H = math.max(sa.height, sb.height) * scale
local dst = Sprite(W, H, ColorMode.RGB)
local img = dst.cels[1].image
-- checkerboard so transparency is visible
for y = 0, H-1 do for x = 0, W-1 do
  local c = (math.floor(x/8) + math.floor(y/8)) % 2 == 0 and 0x30 or 0x38
  img:putPixel(x, y, app.pixelColor.rgba(c, c, c, 255))
end end

local function blit(src, ox)
  for y = 0, src.height-1 do
    for x = 0, src.width-1 do
      local px = src:getPixel(x, y)
      if app.pixelColor.rgbaA(px) > 20 then
        for dy = 0, scale-1 do for dx = 0, scale-1 do
          img:putPixel(ox + x*scale + dx, y*scale + dy, px)
        end end
      end
    end
  end
end
blit(ia, 0)
blit(ib, sa.width * scale)
dst:saveCopyAs(out)
print("ok")
